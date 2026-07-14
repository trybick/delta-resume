module DeltaResume.Infrastructure.ClaudeSentry

open Sentry

let captureApiFailure (operation: string) (statusCode: int) (bodyPreview: string) =
    let message = sprintf "Claude API %s failed with HTTP %d" operation statusCode

    SentrySdk.CaptureMessage(
        message,
        (fun scope ->
            scope.SetTag("provider", "anthropic")
            scope.SetTag("operation", operation)
            scope.SetExtra("statusCode", statusCode)
            scope.SetExtra("bodyPreview", bodyPreview)),
        SentryLevel.Error)
    |> ignore

let captureApiException (operation: string) (ex: exn) =
    SentrySdk.CaptureException(
        ex,
        fun scope ->
            scope.SetTag("provider", "anthropic")
            scope.SetTag("operation", operation))
    |> ignore
