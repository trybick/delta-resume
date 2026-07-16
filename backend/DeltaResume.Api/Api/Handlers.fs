namespace DeltaResume.Api

open System
open System.Security.Cryptography
open System.Text
open Giraffe
open Microsoft.AspNetCore.Http
open DeltaResume.Application
open DeltaResume.Domain

module Handlers =

    [<Literal>]
    let private IdempotencyHeader = "Idempotency-Key"

    let private errorResponse (statusCode: int) (message: string) : HttpHandler =
        setStatusCode statusCode >=> json { Message = message }

    let private codedErrorResponse (statusCode: int) (code: string) (message: string) : HttpHandler =
        setStatusCode statusCode >=> json {| Code = code; Message = message |}

    let private requireSignedIn (innerHandler: HttpHandler) : HttpHandler =
        fun next ctx ->
            let identityOptions = ctx.GetService<IdentityOptions>()

            match Identity.resolve identityOptions ctx with
            | AuthenticatedUser _ -> innerHandler next ctx
            | GuestVisitor _ ->
                codedErrorResponse
                    StatusCodes.Status401Unauthorized
                    "auth_required"
                    "Sign in to manage saved resumes."
                    next
                    ctx

    let private requestHash (request: TailorRequestDto) : string =
        let resumeName =
            request.ResumeName
            |> Option.bind Option.ofObj
            |> Option.defaultValue ""

        String.concat "\u001F" [ request.ResumeText; request.JobDescription; resumeName ]
        |> Encoding.UTF8.GetBytes
        |> SHA256.HashData
        |> Convert.ToHexString

    let private tailorErrorToResponse (error: TailorError) : HttpHandler =
        match error with
        | InvalidInput message ->
            codedErrorResponse StatusCodes.Status400BadRequest "invalid_input" message
        | EngineFailure message -> errorResponse StatusCodes.Status502BadGateway message
        | NotFound message -> errorResponse StatusCodes.Status404NotFound message

    let health: HttpHandler = json {| Status = "ok" |}

    let credits: HttpHandler =
        fun next ctx ->
            task {
                let creditService = ctx.GetService<CreditService>()
                let! status = creditService.GetStatus(ctx, ctx.RequestAborted)
                return! json status next ctx
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
                        "You've used your 3 free credits. Sign up to continue." |}

    let tailor: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.GetService<TailoringService>()
                let! request = ctx.BindJsonAsync<TailorRequestDto>()

                match service.ValidateInputs(request.ResumeText, request.JobDescription, request.ResumeName) with
                | Error error -> return! tailorErrorToResponse error next ctx
                | Ok() ->
                    let idempotencyValue = ctx.Request.Headers[IdempotencyHeader].ToString()

                    match Guid.TryParse idempotencyValue with
                    | false, _ ->
                        return!
                            codedErrorResponse
                                StatusCodes.Status400BadRequest
                                "invalid_idempotency_key"
                                "A valid Idempotency-Key header is required."
                                next
                                ctx
                    | true, _ ->
                        let creditService = ctx.GetService<CreditService>()

                        let! spendResult =
                            creditService.TrySpend(
                                ctx,
                                idempotencyValue,
                                requestHash request,
                                ctx.RequestAborted
                            )

                        match spendResult with
                        | SpendExhausted ->
                            let! creditStatus = creditService.GetStatus(ctx, ctx.RequestAborted)
                            return! creditsExhaustedResponse creditStatus next ctx
                        | SpendDuplicate ->
                            return!
                                codedErrorResponse
                                    StatusCodes.Status409Conflict
                                    "duplicate_tailor_request"
                                    "This tailoring request was already submitted."
                                    next
                                    ctx
                        | SpendConflict ->
                            return!
                                codedErrorResponse
                                    StatusCodes.Status409Conflict
                                    "idempotency_key_reused"
                                    "This Idempotency-Key was already used for different inputs."
                                    next
                                    ctx
                        | SpendRecorded ->
                            let! result =
                                service.TailorResume(
                                    request.ResumeText,
                                    request.JobDescription,
                                    ctx.RequestAborted
                                )

                            match result with
                            | Ok run ->
                                ctx.RequestAborted.ThrowIfCancellationRequested()

                                try
                                    let savedResumeService = ctx.GetService<SavedResumeService>()
                                    do! savedResumeService.AutoSave(ctx, request.ResumeText, request.ResumeName)
                                with ex ->
                                    eprintfn "Failed to auto-save resume: %s" ex.Message

                                return! json (Mapping.toResponseDto run) next ctx
                            | Error error -> return! tailorErrorToResponse error next ctx
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
                    let! request = ctx.BindJsonAsync<CoverLetterRequestDto>()

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

                        let! result =
                            engine.GenerateCoverLetter(
                                request.ResumeText,
                                request.JobDescription,
                                request.CandidateName,
                                ctx.RequestAborted
                            )

                        match result with
                        | Ok draft ->
                            let response: CoverLetterResponseDto =
                                { JobTitle = draft.JobTitle
                                  CompanyName = draft.CompanyName
                                  Letter = draft.Letter }

                            return! json response next ctx
                        | Error message -> return! errorResponse StatusCodes.Status502BadGateway message next ctx
            }

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
                let! request = ctx.BindJsonAsync<RenameSavedResumeRequestDto>()

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
