namespace DeltaResume.Api

open System
open System.Text.Json
open System.Threading.Tasks
open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Http
open Microsoft.AspNetCore.Http.Features

module BodySizeLimit =

    let maxRequestBodyBytes = 256L * 1024L

    let convertPdfMaxBodyBytes = 10L * 1024L * 1024L

    let private limitForRequest (request: HttpRequest) =
        if String.Equals(request.Path.Value, "/api/convert-pdf", StringComparison.OrdinalIgnoreCase) then
            convertPdfMaxBodyBytes
        else
            maxRequestBodyBytes

    // Kestrel enforces the limit itself; this middleware only exists to turn the
    // resulting 413 into a JSON body the frontend can display, and to raise the
    // per-request limit for routes that legitimately accept larger bodies.
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

                let bodyLimit = limitForRequest context.Request

                if bodyLimit <> maxRequestBodyBytes then
                    let sizeFeature = context.Features.Get<IHttpMaxRequestBodySizeFeature>()

                    if not (isNull (box sizeFeature)) && not sizeFeature.IsReadOnly then
                        sizeFeature.MaxRequestBodySize <- Nullable bodyLimit

                let contentLength = context.Request.ContentLength

                if contentLength.HasValue && contentLength.Value > bodyLimit then
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
