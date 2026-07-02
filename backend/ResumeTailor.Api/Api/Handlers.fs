namespace ResumeTailor.Api

open System
open Giraffe
open Microsoft.AspNetCore.Http
open ResumeTailor.Application
open ResumeTailor.Domain

module Handlers =

    let private errorResponse (statusCode: int) (message: string) : HttpHandler =
        setStatusCode statusCode >=> json { Message = message }

    let private tailorErrorToResponse (error: TailorError) : HttpHandler =
        match error with
        | InvalidInput message -> errorResponse StatusCodes.Status400BadRequest message
        | EngineFailure message -> errorResponse StatusCodes.Status502BadGateway message
        | NotFound message -> errorResponse StatusCodes.Status404NotFound message

    let health: HttpHandler = json {| Status = "ok" |}

    let tailor: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.GetService<TailoringService>()
                let! request = ctx.BindJsonAsync<TailorRequestDto>()
                let! result = service.TailorResume(request.ResumeText, request.JobDescription)

                match result with
                | Ok run -> return! json (Mapping.toResponseDto run) next ctx
                | Error error -> return! tailorErrorToResponse error next ctx
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
