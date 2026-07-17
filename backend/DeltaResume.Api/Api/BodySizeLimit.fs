namespace DeltaResume.Api

open System
open System.Text.Json
open System.Threading.Tasks
open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Http

module BodySizeLimit =

    let maxRequestBodyBytes = 256L * 1024L

    // Kestrel enforces the limit itself; this middleware only exists to turn the
    // resulting 413 into a JSON body the frontend can display.
    let useBodySizeLimit (jsonOptions: JsonSerializerOptions) (app: IApplicationBuilder) : IApplicationBuilder =
        app.Use(fun (context: HttpContext) (next: Func<Task>) ->
            task {
                let writePayloadTooLarge () =
                    task {
                        context.Response.StatusCode <- StatusCodes.Status413PayloadTooLarge
                        context.Response.ContentType <- "application/json; charset=utf-8"

                        do!
                            JsonSerializer.SerializeAsync(
                                context.Response.Body,
                                {| Code = "payload_too_large"
                                   Message = "Request body is too large." |},
                                jsonOptions
                            )
                    }

                let contentLength = context.Request.ContentLength

                if contentLength.HasValue && contentLength.Value > maxRequestBodyBytes then
                    do! writePayloadTooLarge ()
                else
                    try
                        do! next.Invoke()
                    with
                    | :? BadHttpRequestException as ex when
                        ex.StatusCode = StatusCodes.Status413PayloadTooLarge
                        ->
                        if not context.Response.HasStarted then
                            context.Response.Clear()
                            do! writePayloadTooLarge ()
                    | ex ->
                        System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(ex).Throw()
            }
            :> Task)
