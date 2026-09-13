namespace DeltaResume.Api

open System
open System.Diagnostics
open System.Threading.Tasks
open System.IO
open System.Threading
open Giraffe
open Microsoft.AspNetCore.Http
open Sentry
open DeltaResume.Application
open DeltaResume.Domain
open DeltaResume.Infrastructure

module Handlers =

    let private tailoringFailureMessage = "Tailoring failed, you weren't charged."

    let private errorResponse (statusCode: int) (message: string) : HttpHandler =
        setStatusCode statusCode >=> json { Message = message }

    let private codedErrorResponse (statusCode: int) (code: string) (message: string) : HttpHandler =
        setStatusCode statusCode >=> json {| Code = code; Message = message |}

    let private requireSignedInWithMessage (message: string) (innerHandler: HttpHandler) : HttpHandler =
        fun next ctx ->
            let identityOptions = ctx.GetService<IdentityOptions>()

            match Identity.resolve identityOptions ctx with
            | AuthenticatedUser _ -> innerHandler next ctx
            | GuestVisitor _ ->
                codedErrorResponse StatusCodes.Status401Unauthorized "auth_required" message next ctx

    let private requireSignedIn: HttpHandler -> HttpHandler =
        requireSignedInWithMessage "Sign in to manage saved resumes."

    let private requireSignedInForRuns: HttpHandler -> HttpHandler =
        requireSignedInWithMessage "Sign in to view your applications."

    let private sanitizeResumeName (value: string option) : string =
        value
        |> Option.map (fun name -> if isNull name then "" else name.Trim())
        |> Option.filter (fun name -> name.Length > 0)
        |> Option.map (fun name ->
            if name.Length > InputLimits.MaxNameCharacters then
                name.Substring(0, InputLimits.MaxNameCharacters)
            else
                name)
        |> Option.defaultValue ""

    let private persistTailorRun
        (ctx: HttpContext)
        (request: TailorRequestDto)
        (run: TailorRun)
        : Task<unit> =
        task {
            try
                let savedResumeService = ctx.GetService<SavedResumeService>()

                do!
                    savedResumeService.AutoSave(
                        ctx,
                        request.ResumeText,
                        request.ResumeName,
                        run.Document,
                        request.ResumeLayout
                    )

                let! savedResumeId = savedResumeService.FindIdByContent(ctx, request.ResumeText)
                let tailorRunService = ctx.GetService<TailorRunService>()
                let identityOptions = ctx.GetService<IdentityOptions>()
                let identity = Identity.resolve identityOptions ctx
                let now = DateTimeOffset.UtcNow
                let (RunId runId) = run.Id

                do!
                    tailorRunService.SaveAfterTailor(
                        ctx,
                        { Id = runId
                          OwnerKey = Identity.ownerKey identity
                          SavedResumeId = savedResumeId
                          ResumeName = sanitizeResumeName request.ResumeName
                          CompanyName = None
                          JobTitle = None
                          JobDescription = request.JobDescription
                          ResumeText = request.ResumeText
                          ResultJson =
                            Mapping.serializeStoredResult (
                                Mapping.toStoredResultDto request.ResumeLayout run
                            )
                          CoverLetterJson = None
                          DecisionsJson = TailorRunDecisions.EmptyJson
                          CreatedAt = run.CreatedAt
                          UpdatedAt = now }
                    )
            with ex ->
                SentrySdk.CaptureException(ex) |> ignore
        }

    let private requireFingerprintOrAuth (innerHandler: HttpHandler) : HttpHandler =
        fun next ctx ->
            let identityOptions = ctx.GetService<IdentityOptions>()

            match Identity.resolve identityOptions ctx with
            | AuthenticatedUser _ -> innerHandler next ctx
            | GuestVisitor(Some _, _) -> innerHandler next ctx
            | GuestVisitor(None, _) ->
                codedErrorResponse
                    StatusCodes.Status401Unauthorized
                    "identity_required"
                    "A guest fingerprint or signed-in session is required."
                    next
                    ctx

    let private tailorErrorToResponse (error: TailorError) : HttpHandler =
        match error with
        | InvalidInput message ->
            codedErrorResponse StatusCodes.Status400BadRequest "invalid_input" message
        | EngineFailure _ -> errorResponse StatusCodes.Status502BadGateway tailoringFailureMessage
        | NotFound message -> errorResponse StatusCodes.Status404NotFound message

    let health: HttpHandler =
        fun next ctx ->
            task {
                let databaseHealthCheck = ctx.GetService<DatabaseHealthCheck>()

                try
                    do! databaseHealthCheck.Check(ctx.RequestAborted)
                    return! json {| Status = "ok" |} next ctx
                with ex ->
                    SentrySdk.CaptureException(ex) |> ignore

                    return!
                        (setStatusCode StatusCodes.Status503ServiceUnavailable
                         >=> json {| Status = "unhealthy" |})
                            next
                            ctx
            }

    let private persistenceFailureResponse: HttpHandler =
        errorResponse StatusCodes.Status500InternalServerError "Something went wrong. Please try again."

    let hydrateClerkPublicUser: HttpHandler =
        fun next ctx ->
            task {
                match Identity.tryGetAuthenticatedUserId ctx.User with
                | None -> return! next ctx
                | Some userId ->
                    let clerkUsers = ctx.GetService<ClerkUsers>()

                    let! publicUser =
                        clerkUsers.GetPublicUser(userId, Identity.claimsProPlan ctx, ctx.RequestAborted)

                    let resolvedUser =
                        publicUser
                        |> Option.defaultValue
                            { UserId = userId
                              PublicMetadataJson = "{}"
                              IsLifetimeFree = false
                              CreatedAt = None
                              ProPeriodStart = None }

                    Identity.setClerkPublicUser ctx resolvedUser
                    return! next ctx
            }

    let credits: HttpHandler =
        fun next ctx ->
            task {
                let creditService = ctx.GetService<CreditService>()

                try
                    let! status = creditService.GetStatus(ctx, ctx.RequestAborted)
                    return! json (Mapping.toCreditStatusDto status) next ctx
                with
                | :? OperationCanceledException when ctx.RequestAborted.IsCancellationRequested ->
                    return! earlyReturn ctx
                | ex ->
                    SentrySdk.CaptureException(ex) |> ignore
                    return! persistenceFailureResponse next ctx
            }

    let private creditsExhaustedResponse (status: CreditStatus) : HttpHandler =
        setStatusCode StatusCodes.Status402PaymentRequired
        >=> json
                {| Code = "credits_exhausted"
                   RequiresAuth = not status.IsAuthenticated
                   Message =
                    if status.IsAuthenticated then
                        "You've used all your credits. Subscribe to Pro to keep tailoring."
                    else
                        $"You've used your free run. Create a free account for {CreditPlan.extraFreeRunsAfterSignup} more." |}

    let private tryBindJson<'T> (ctx: HttpContext) =
        task {
            try
                let! parsed = ctx.BindJsonAsync<'T>()
                return Some parsed
            with _ ->
                return None
        }

    let private invalidJsonResponse: HttpHandler =
        codedErrorResponse StatusCodes.Status400BadRequest "invalid_input" "Invalid request payload."

    let private refundCredit (creditService: CreditService) (operationId: OperationId) =
        task {
            try
                do! creditService.Refund(operationId, CancellationToken.None)
            with ex ->
                SentrySdk.CaptureException(ex) |> ignore
        }

    let private recordResumeOutcome
        (creditService: CreditService)
        (operationId: OperationId)
        (usage: LlmUsage option)
        (durationMs: int)
        =
        task {
            try
                do! creditService.RecordResumeOutcome(operationId, usage, durationMs, CancellationToken.None)
            with ex ->
                SentrySdk.CaptureException(ex) |> ignore
        }

    let private recordCoverLetterOutcome
        (creditService: CreditService)
        (runId: Guid)
        (usage: LlmUsage option)
        (durationMs: int)
        =
        task {
            try
                do! creditService.RecordCoverLetterOutcome(runId, usage, durationMs, CancellationToken.None)
            with ex ->
                SentrySdk.CaptureException(ex) |> ignore
        }

    let tailor: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.GetService<TailoringService>()
                let! request = tryBindJson<TailorRequestDto> ctx

                match request with
                | None -> return! invalidJsonResponse next ctx
                | Some request ->
                    match service.ValidateInputs(request.ResumeText, request.JobDescription, request.ResumeName) with
                    | Error error -> return! tailorErrorToResponse error next ctx
                    | Ok() ->
                        let creditService = ctx.GetService<CreditService>()

                        let! spendResult =
                            task {
                                try
                                    let! result =
                                        creditService.TrySpend(ctx, Tailor, request.RunId, ctx.RequestAborted)
                                    return Ok result
                                with
                                | :? OperationCanceledException when ctx.RequestAborted.IsCancellationRequested ->
                                    return Error None
                                | ex ->
                                    SentrySdk.CaptureException(ex) |> ignore
                                    return Error(Some persistenceFailureResponse)
                            }

                        match spendResult with
                        | Error None -> return! earlyReturn ctx
                        | Error(Some failureResponse) -> return! failureResponse next ctx
                        | Ok SpendExhausted ->
                            let! creditStatus =
                                task {
                                    try
                                        let! status = creditService.GetStatus(ctx, ctx.RequestAborted)
                                        return Some status
                                    with ex ->
                                        SentrySdk.CaptureException(ex) |> ignore
                                        return None
                                }

                            match creditStatus with
                            | Some status -> return! creditsExhaustedResponse status next ctx
                            | None -> return! persistenceFailureResponse next ctx
                        | Ok(SpendRecorded operationId) ->
                            let stopwatch = Stopwatch.StartNew()

                            try
                                let existingDocument =
                                    request.ResumeDocument
                                    |> Option.bind ResumeDocumentJson.tryParse

                                let! outcome =
                                    service.TailorResume(
                                        request.ResumeText,
                                        request.JobDescription,
                                        existingDocument,
                                        ctx.RequestAborted
                                    )

                                stopwatch.Stop()
                                do! recordResumeOutcome creditService operationId outcome.Usage (int stopwatch.ElapsedMilliseconds)

                                match outcome.Result with
                                | Ok run ->
                                    let persistedRun =
                                        match request.RunId with
                                        | Some runId -> { run with Id = RunId runId }
                                        | None -> run

                                    do! persistTailorRun ctx request persistedRun

                                    let identityOptions = ctx.GetService<IdentityOptions>()
                                    let identity = Identity.resolve identityOptions ctx
                                    let isProPlan = Identity.plan identity = ProPlan

                                    return! json (Mapping.toResponseDto isProPlan request.ResumeLayout persistedRun) next ctx
                                | Error error ->
                                    do! refundCredit creditService operationId
                                    return! tailorErrorToResponse error next ctx
                            with
                            | :? OperationCanceledException when ctx.RequestAborted.IsCancellationRequested ->
                                stopwatch.Stop()
                                do! recordResumeOutcome creditService operationId None (int stopwatch.ElapsedMilliseconds)
                                do! refundCredit creditService operationId
                                return! earlyReturn ctx
                            | ex ->
                                stopwatch.Stop()
                                do! recordResumeOutcome creditService operationId None (int stopwatch.ElapsedMilliseconds)
                                SentrySdk.CaptureException(ex) |> ignore
                                do! refundCredit creditService operationId
                                return! errorResponse StatusCodes.Status500InternalServerError tailoringFailureMessage next ctx
            }

    let coverLetter: HttpHandler =
        requireFingerprintOrAuth (fun next ctx ->
            task {
                let identityOptions = ctx.GetService<IdentityOptions>()
                let identity = Identity.resolve identityOptions ctx
                let! request = tryBindJson<CoverLetterRequestDto> ctx

                match request with
                | None -> return! invalidJsonResponse next ctx
                | Some request ->
                    match
                        InputValidation.validate
                            request.ResumeText
                            request.JobDescription
                            request.CandidateName
                    with
                    | Error message ->
                        return!
                            codedErrorResponse
                                StatusCodes.Status400BadRequest
                                "invalid_input"
                                message
                                next
                                ctx
                    | Ok() ->
                        let engine = ctx.GetService<CoverLetterEngine>()
                        let creditService = ctx.GetService<CreditService>()
                        let settingsRepository = ctx.GetService<UserSettingsRepository>()
                        let! storedSettings = settingsRepository.Get(Identity.ownerKey identity)

                        let settings =
                            if Identity.plan identity = ProPlan then
                                storedSettings |> Option.defaultValue UserSettings.defaults
                            else
                                UserSettings.defaults

                        let stopwatch = Stopwatch.StartNew()

                        let! outcome =
                            engine.GenerateCoverLetter(
                                request.ResumeText,
                                request.JobDescription,
                                request.CandidateName,
                                settings.CoverLetter,
                                ctx.RequestAborted
                            )

                        stopwatch.Stop()

                        match request.RunId with
                        | Some runId ->
                            do!
                                recordCoverLetterOutcome
                                    creditService
                                    runId
                                    outcome.Usage
                                    (int stopwatch.ElapsedMilliseconds)
                        | None -> ()

                        match outcome.Result with
                        | Ok draft ->
                            let response: CoverLetterResponseDto =
                                { JobTitle = draft.JobTitle
                                  CompanyName = draft.CompanyName
                                  Letter = draft.Letter }

                            match request.RunId with
                            | Some runId ->
                                try
                                    let tailorRunService = ctx.GetService<TailorRunService>()

                                    do!
                                        tailorRunService.SaveCoverLetter(
                                            ctx,
                                            runId,
                                            Mapping.serializeCoverLetter response,
                                            Some draft.CompanyName,
                                            Some draft.JobTitle
                                        )
                                with ex ->
                                    SentrySdk.CaptureException(ex) |> ignore
                            | None -> ()

                            return! json response next ctx
                        | Error message ->
                            eprintfn "Cover letter generation failed: %s" message

                            SentrySdk.CaptureMessage(
                                sprintf "Cover letter generation failed: %s" message,
                                SentryLevel.Error
                            )
                            |> ignore

                            return!
                                errorResponse
                                    StatusCodes.Status502BadGateway
                                    "Something went wrong while writing your cover letter."
                                    next
                                    ctx
            })

    // PDF-only: converts a client-built .docx to a real text-based PDF via LibreOffice.
    // Client-side screenshot PDFs have no text layer (ATS-unreadable), so export posts
    // the .docx here instead. Docx download stays fully client-side and never hits this.
    // Requires a signed-in user so anonymous callers cannot spawn soffice.
    let convertPdf: HttpHandler =
        requireSignedInWithMessage "Create a free account to export as PDF." (fun next ctx ->
            task {
                use bodyStream = new MemoryStream()
                do! ctx.Request.Body.CopyToAsync(bodyStream, ctx.RequestAborted)
                let docxBytes = bodyStream.ToArray()

                // .docx is a ZIP package (magic bytes "PK" / 0x50 0x4B). Cheap reject of
                // non-ZIP bodies before spawning LibreOffice — not a full DOCX validation.
                let isZipHeader =
                    docxBytes.Length > 4 && docxBytes[0] = 0x50uy && docxBytes[1] = 0x4Buy

                if not isZipHeader then
                    return!
                        codedErrorResponse
                            StatusCodes.Status400BadRequest
                            "invalid_input"
                            "Expected a .docx document in the request body."
                            next
                            ctx
                else
                    let converter = ctx.GetService<PdfConverter>()
                    let! result = converter.ConvertDocxToPdf(docxBytes, ctx.RequestAborted)

                    match result with
                    | Ok pdfBytes ->
                        ctx.SetContentType "application/pdf"
                        return! ctx.WriteBytesAsync pdfBytes
                    | Error ConverterBusy ->
                        return!
                            (setHttpHeader "Retry-After" "15"
                             >=> codedErrorResponse
                                     StatusCodes.Status503ServiceUnavailable
                                     "pdf_converter_busy"
                                     "PDF conversion is busy right now. Please try again in a moment.")
                                next
                                ctx
                    | Error ConverterUnavailable ->
                        return!
                            codedErrorResponse
                                StatusCodes.Status503ServiceUnavailable
                                "pdf_converter_unavailable"
                                "PDF conversion is not available on this server."
                                next
                                ctx
                    | Error (ConversionFailed message) ->
                        return! codedErrorResponse StatusCodes.Status502BadGateway "pdf_conversion_failed" message next ctx
            })

    let getSettings: HttpHandler =
        requireSignedInWithMessage "Sign in to manage your settings." (fun next ctx ->
            task {
                let identityOptions = ctx.GetService<IdentityOptions>()
                let identity = Identity.resolve identityOptions ctx
                let repository = ctx.GetService<UserSettingsRepository>()
                let! storedSettings = repository.Get(Identity.ownerKey identity)

                let settings =
                    storedSettings |> Option.defaultValue UserSettings.defaults

                return! json (Mapping.toUserSettingsDto settings) next ctx
            })

    let updateSettings: HttpHandler =
        requireSignedInWithMessage "Sign in to manage your settings." (fun next ctx ->
            task {
                let identityOptions = ctx.GetService<IdentityOptions>()
                let identity = Identity.resolve identityOptions ctx

                if Identity.plan identity <> ProPlan then
                    return!
                        codedErrorResponse
                            StatusCodes.Status403Forbidden
                            "pro_required"
                            "Cover letter settings are a Pro feature."
                            next
                            ctx
                else
                    let! request = tryBindJson<UserSettingsDto> ctx

                    let validated =
                        match request with
                        | None -> Error "Invalid settings payload."
                        | Some dto ->
                            if isNull (box dto.CoverLetter) then
                                Error "coverLetter settings are required."
                            else
                                match
                                    CoverLetterLength.tryParse dto.CoverLetter.Length,
                                    CoverLetterTone.tryParse dto.CoverLetter.Tone
                                with
                                | None, _ -> Error "Invalid cover letter length."
                                | _, None -> Error "Invalid cover letter tone."
                                | Some length, Some tone ->
                                    Ok { CoverLetter = { Length = length; Tone = tone } }

                    match validated with
                    | Error message ->
                        return! codedErrorResponse StatusCodes.Status400BadRequest "invalid_input" message next ctx
                    | Ok settings ->
                        let repository = ctx.GetService<UserSettingsRepository>()
                        do! repository.Upsert(Identity.ownerKey identity, settings)
                        return! json (Mapping.toUserSettingsDto settings) next ctx
            })

    let listSavedResumes: HttpHandler =
        requireSignedIn (fun next ctx ->
            task {
                let service = ctx.GetService<SavedResumeService>()
                let! resumes = service.List ctx
                return! json (resumes |> List.map Mapping.toSavedResumeDto) next ctx
            })

    let renameSavedResume (resumeId: string) : HttpHandler =
        requireSignedIn (fun next ctx ->
            task {
                let service = ctx.GetService<SavedResumeService>()
                let! request = tryBindJson<RenameSavedResumeRequestDto> ctx

                match request with
                | None -> return! invalidJsonResponse next ctx
                | Some request ->
                    match Guid.TryParse resumeId with
                    | false, _ -> return! errorResponse StatusCodes.Status400BadRequest "Invalid resume id." next ctx
                    | true, id ->
                        if String.IsNullOrWhiteSpace request.Name then
                            return! errorResponse StatusCodes.Status400BadRequest "Name is required." next ctx
                        else
                            let! renamed = service.Rename(ctx, SavedResumeId id, request.Name)

                            if renamed then
                                return! setStatusCode StatusCodes.Status204NoContent next ctx
                            else
                                return! errorResponse StatusCodes.Status404NotFound "Resume not found." next ctx
            })

    let deleteSavedResume (resumeId: string) : HttpHandler =
        requireSignedIn (fun next ctx ->
            task {
                let service = ctx.GetService<SavedResumeService>()

                match Guid.TryParse resumeId with
                | false, _ -> return! errorResponse StatusCodes.Status400BadRequest "Invalid resume id." next ctx
                | true, id ->
                    let! deleted = service.Delete(ctx, SavedResumeId id)

                    if deleted then
                        return! setStatusCode StatusCodes.Status204NoContent next ctx
                    else
                        return! errorResponse StatusCodes.Status404NotFound "Resume not found." next ctx
            })

    let listTailorRuns: HttpHandler =
        requireSignedInForRuns (fun next ctx ->
            task {
                let service = ctx.GetService<TailorRunService>()
                let! listed = service.List ctx

                match listed with
                | None ->
                    return!
                        codedErrorResponse
                            StatusCodes.Status401Unauthorized
                            "auth_required"
                            "Sign in to view your applications."
                            next
                            ctx
                | Some listed ->
                    let response: TailorRunListDto =
                        { Runs = listed.Runs |> List.map Mapping.toRunSummaryDto
                          HiddenOlderCount = listed.HiddenOlderCount }

                    return! json response next ctx
            })

    let getTailorRun (runId: string) : HttpHandler =
        requireSignedInForRuns (fun next ctx ->
            task {
                match Guid.TryParse runId with
                | false, _ -> return! errorResponse StatusCodes.Status400BadRequest "Invalid run id." next ctx
                | true, id ->
                    let service = ctx.GetService<TailorRunService>()
                    let! record = service.Get(ctx, id)

                    match record with
                    | None -> return! errorResponse StatusCodes.Status404NotFound "Application not found." next ctx
                    | Some record ->
                        let identityOptions = ctx.GetService<IdentityOptions>()
                        let identity = Identity.resolve identityOptions ctx
                        let isProPlan = Identity.plan identity = ProPlan

                        match Mapping.toRunDetailDto isProPlan record with
                        | None -> return! persistenceFailureResponse next ctx
                        | Some detail -> return! json detail next ctx
            })

    let patchTailorRun (runId: string) : HttpHandler =
        requireSignedInForRuns (fun next ctx ->
            task {
                let! request = tryBindJson<PatchRunDecisionsRequestDto> ctx

                match request with
                | None -> return! invalidJsonResponse next ctx
                | Some request when obj.ReferenceEquals(request.Decisions, null) ->
                    return! invalidJsonResponse next ctx
                | Some request ->
                    match Guid.TryParse runId with
                    | false, _ -> return! errorResponse StatusCodes.Status400BadRequest "Invalid run id." next ctx
                    | true, id ->
                        let service = ctx.GetService<TailorRunService>()
                        let! updated = service.UpdateDecisions(ctx, id, Mapping.serializeDecisions request.Decisions)

                        if updated then
                            return! setStatusCode StatusCodes.Status204NoContent next ctx
                        else
                            return! errorResponse StatusCodes.Status404NotFound "Application not found." next ctx
            })

    let deleteTailorRun (runId: string) : HttpHandler =
        requireSignedInForRuns (fun next ctx ->
            task {
                match Guid.TryParse runId with
                | false, _ -> return! errorResponse StatusCodes.Status400BadRequest "Invalid run id." next ctx
                | true, id ->
                    let service = ctx.GetService<TailorRunService>()
                    let! deleted = service.Delete(ctx, id)

                    if deleted then
                        return! setStatusCode StatusCodes.Status204NoContent next ctx
                    else
                        return! errorResponse StatusCodes.Status404NotFound "Application not found." next ctx
            })

    let claimTailorRun: HttpHandler =
        requireSignedInForRuns (fun next ctx ->
            task {
                let! request = tryBindJson<ClaimRunRequestDto> ctx

                match request with
                | None -> return! invalidJsonResponse next ctx
                | Some request when obj.ReferenceEquals(request.Result, null) ->
                    return! invalidJsonResponse next ctx
                | Some request ->
                    match InputValidation.validate request.ResumeText request.JobDescription request.ResumeName with
                    | Error message ->
                        return! codedErrorResponse StatusCodes.Status400BadRequest "invalid_input" message next ctx
                    | Ok() when request.RunId = Guid.Empty ->
                        return! codedErrorResponse StatusCodes.Status400BadRequest "invalid_input" "Run id is required." next ctx
                    | Ok() ->
                        let identityOptions = ctx.GetService<IdentityOptions>()
                        let identity = Identity.resolve identityOptions ctx
                        let now = DateTimeOffset.UtcNow
                        let coverLetter =
                            request.CoverLetter
                            |> Option.bind (fun letter -> if isNull (box letter) then None else Some letter)

                        let coverLetterJson = coverLetter |> Option.map Mapping.serializeCoverLetter

                        let decisions =
                            if obj.ReferenceEquals(request.Decisions, null) then
                                Mapping.emptyDecisions
                            else
                                request.Decisions

                        let visibleRequirements =
                            if obj.ReferenceEquals(request.Result.Requirements, null) then
                                []
                            else
                                request.Result.Requirements
                                |> List.filter (fun requirement ->
                                    not requirement.Locked && not (String.IsNullOrWhiteSpace requirement.Text))

                        let storedResult =
                            { request.Result with
                                Requirements = visibleRequirements }

                        let record: TailorRunRecord =
                            { Id = request.RunId
                              OwnerKey = Identity.ownerKey identity
                              SavedResumeId = None
                              ResumeName = sanitizeResumeName request.ResumeName
                              CompanyName = coverLetter |> Option.map _.CompanyName
                              JobTitle = coverLetter |> Option.map _.JobTitle
                              JobDescription = request.JobDescription
                              ResumeText = request.ResumeText
                              ResultJson = Mapping.serializeStoredResult storedResult
                              CoverLetterJson = coverLetterJson
                              DecisionsJson = Mapping.serializeDecisions decisions
                              CreatedAt = now
                              UpdatedAt = now }

                        let service = ctx.GetService<TailorRunService>()
                        let! claimed = service.Claim(ctx, record)

                        match claimed with
                        | GuestUser ->
                            return!
                                codedErrorResponse
                                    StatusCodes.Status401Unauthorized
                                    "auth_required"
                                    "Sign in to view your applications."
                                    next
                                    ctx
                        | Conflict ->
                            return! errorResponse StatusCodes.Status409Conflict "This application belongs to another account." next ctx
                        | Claimed saved
                        | AlreadyOwned saved ->
                            let isProPlan = Identity.plan identity = ProPlan

                            match Mapping.toRunDetailDto isProPlan saved with
                            | None -> return! persistenceFailureResponse next ctx
                            | Some detail -> return! json detail next ctx
            })
