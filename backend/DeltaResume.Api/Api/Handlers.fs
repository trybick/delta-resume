namespace DeltaResume.Api

open System
open Giraffe
open Microsoft.AspNetCore.Http
open DeltaResume.Application
open DeltaResume.Domain

module Handlers =

    let private errorResponse (statusCode: int) (message: string) : HttpHandler =
        setStatusCode statusCode >=> json { Message = message }

    let private tailorErrorToResponse (error: TailorError) : HttpHandler =
        match error with
        | InvalidInput message -> errorResponse StatusCodes.Status400BadRequest message
        | EngineFailure message -> errorResponse StatusCodes.Status502BadGateway message
        | NotFound message -> errorResponse StatusCodes.Status404NotFound message

    let health: HttpHandler = json {| Status = "ok" |}

    let credits: HttpHandler =
        fun next ctx ->
            task {
                let creditService = ctx.GetService<CreditService>()
                let! status = creditService.GetStatus ctx
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
                let creditService = ctx.GetService<CreditService>()
                let! creditStatus = creditService.GetStatus ctx

                if creditStatus.Remaining <= 0 then
                    return! creditsExhaustedResponse creditStatus next ctx
                else
                    let service = ctx.GetService<TailoringService>()
                    let! request = ctx.BindJsonAsync<TailorRequestDto>()
                    let! result = service.TailorResume(request.ResumeText, request.JobDescription)

                    match result with
                    | Ok run ->
                        do! creditService.RecordSpend ctx

                        try
                            let savedResumeService = ctx.GetService<SavedResumeService>()
                            do! savedResumeService.AutoSave(ctx, request.ResumeText, request.ResumeName)
                        with ex ->
                            eprintfn "Failed to auto-save resume: %s" ex.Message

                        return! json (Mapping.toResponseDto run) next ctx
                    | Error error -> return! tailorErrorToResponse error next ctx
            }

    let listResumes: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.GetService<SavedResumeService>()
                let! resumes = service.List ctx
                return! json (resumes |> List.map Mapping.toSavedResumeDto) next ctx
            }

    let renameResume (resumeId: string) : HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.GetService<SavedResumeService>()
                let! request = ctx.BindJsonAsync<RenameResumeRequestDto>()

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
            }

    let deleteResume (resumeId: string) : HttpHandler =
        fun next ctx ->
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
            }

    let updateDecision (changeId: string) : HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.GetService<TailoringService>()
                let! request = ctx.BindJsonAsync<DecisionRequestDto>()

                match Guid.TryParse changeId, Decision.tryParse request.Decision with
                | (false, _), _ ->
                    return! errorResponse StatusCodes.Status400BadRequest "Invalid change id." next ctx
                | _, None ->
                    return!
                        errorResponse
                            StatusCodes.Status400BadRequest
                            "Decision must be 'pending', 'accepted', or 'rejected'."
                            next
                            ctx
                | (true, id), Some decision ->
                    let! result = service.RecordDecision(ChangeId id, decision)

                    match result with
                    | Ok() -> return! setStatusCode StatusCodes.Status204NoContent next ctx
                    | Error error -> return! tailorErrorToResponse error next ctx
            }
