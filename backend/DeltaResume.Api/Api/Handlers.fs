namespace DeltaResume.Api

open System
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
        let freeCreditTotal = status.Total
        let freeCreditWord = if freeCreditTotal = 1 then "credit" else "credits"

        setStatusCode StatusCodes.Status402PaymentRequired
        >=> json
                {| Code = "credits_exhausted"
                   RequiresAuth = not status.IsAuthenticated
                   Message =
                    if status.IsAuthenticated then
                        "You've used all your credits. Subscribe to Pro to keep tailoring."
                    else
                        $"You've used your {freeCreditTotal} free {freeCreditWord}. Sign up to upgrade and continue." |}

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
                                    let! result = creditService.TrySpend(ctx, ctx.RequestAborted)
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
                            try
                                let existingDocument =
                                    request.ResumeDocument
                                    |> Option.bind ResumeDocumentJson.tryParse

                                let! result =
                                    service.TailorResume(
                                        request.ResumeText,
                                        request.JobDescription,
                                        existingDocument,
                                        ctx.RequestAborted
                                    )

                                match result with
                                | Ok run ->
                                    try
                                        let savedResumeService = ctx.GetService<SavedResumeService>()

                                        do!
                                            savedResumeService.AutoSave(
                                                ctx,
                                                request.ResumeText,
                                                request.ResumeName,
                                                run.Document
                                            )
                                    with ex ->
                                        SentrySdk.CaptureException(ex) |> ignore

                                    let identityOptions = ctx.GetService<IdentityOptions>()
                                    let identity = Identity.resolve identityOptions ctx
                                    let isProPlan = Identity.plan identity = ProPlan

                                    return! json (Mapping.toResponseDto isProPlan run) next ctx
                                | Error error ->
                                    do! refundCredit creditService operationId
                                    return! tailorErrorToResponse error next ctx
                            with
                            | :? OperationCanceledException when ctx.RequestAborted.IsCancellationRequested ->
                                do! refundCredit creditService operationId
                                return! earlyReturn ctx
                            | ex ->
                                SentrySdk.CaptureException(ex) |> ignore
                                do! refundCredit creditService operationId
                                return! errorResponse StatusCodes.Status500InternalServerError tailoringFailureMessage next ctx
            }

    let coverLetter: HttpHandler =
        fun next ctx ->
            task {
                let identityOptions = ctx.GetService<IdentityOptions>()
                let identity = Identity.resolve identityOptions ctx

                if Identity.plan identity <> ProPlan then
                    return!
                        (setStatusCode StatusCodes.Status403Forbidden
                         >=> json
                                 {| Code = "pro_required"
                                    Message = "Cover letters are a Pro feature. Upgrade to Pro to unlock them." |})
                            next
                            ctx
                else
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
                            let settingsRepository = ctx.GetService<UserSettingsRepository>()
                            let! storedSettings = settingsRepository.Get(Identity.ownerKey identity)

                            let settings =
                                storedSettings |> Option.defaultValue UserSettings.defaults

                            let! result =
                                engine.GenerateCoverLetter(
                                    request.ResumeText,
                                    request.JobDescription,
                                    request.CandidateName,
                                    settings.CoverLetter,
                                    ctx.RequestAborted
                                )

                            match result with
                            | Ok draft ->
                                let response: CoverLetterResponseDto =
                                    { JobTitle = draft.JobTitle
                                      CompanyName = draft.CompanyName
                                      Letter = draft.Letter }

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
            }

    // PDF-only: converts a client-built .docx to a real text-based PDF via LibreOffice.
    // Client-side screenshot PDFs have no text layer (ATS-unreadable), so export posts
    // the .docx here instead. Docx download stays fully client-side and never hits this.
    // Requires guest fingerprint or Clerk auth so anonymous scrapers cannot spawn soffice.
    let convertPdf: HttpHandler =
        requireFingerprintOrAuth (fun next ctx ->
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
                    let identityOptions = ctx.GetService<IdentityOptions>()
                    let identity = Identity.resolve identityOptions ctx
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
