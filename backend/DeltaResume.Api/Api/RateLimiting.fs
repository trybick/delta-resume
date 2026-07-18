namespace DeltaResume.Api

open System
open System.Threading.RateLimiting
open Giraffe
open Microsoft.AspNetCore.Http
open DeltaResume.Application

type RateLimiters(options: IdentityOptions, disabled: bool) =

    let tailorLimiter =
        PartitionedRateLimiter.Create<string, string>(fun key ->
            RateLimitPartition.GetSlidingWindowLimiter(
                key,
                fun _ ->
                    SlidingWindowRateLimiterOptions(
                        PermitLimit = 4,
                        Window = TimeSpan.FromMinutes 1.0,
                        SegmentsPerWindow = 4,
                        QueueLimit = 0,
                        AutoReplenishment = true
                    )
            ))

    let convertLimiter =
        PartitionedRateLimiter.Create<string, string>(fun key ->
            RateLimitPartition.GetSlidingWindowLimiter(
                key,
                fun _ ->
                    SlidingWindowRateLimiterOptions(
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes 1.0,
                        SegmentsPerWindow = 4,
                        QueueLimit = 0,
                        AutoReplenishment = true
                    )
            ))

    let looseLimiter =
        PartitionedRateLimiter.Create<string, string>(fun key ->
            RateLimitPartition.GetFixedWindowLimiter(
                key,
                fun _ ->
                    FixedWindowRateLimiterOptions(
                        PermitLimit = 60,
                        Window = TimeSpan.FromMinutes 1.0,
                        QueueLimit = 0,
                        AutoReplenishment = true
                    )
            ))

    member _.IdentityOptions = options
    member _.Disabled = disabled
    member _.Tailor = tailorLimiter
    member _.Convert = convertLimiter
    member _.Loose = looseLimiter

module RateLimit =

    let private tooManyRequests (lease: RateLimitLease) : HttpHandler =
        let retryAfterSeconds =
            match lease.TryGetMetadata MetadataName.RetryAfter with
            | true, retryAfter -> max 1 (int (ceil retryAfter.TotalSeconds))
            | false, _ -> 60

        setHttpHeader "Retry-After" (string retryAfterSeconds)
        >=> setStatusCode StatusCodes.Status429TooManyRequests
        >=> json
                {| Code = "rate_limited"
                   Message = sprintf "Too many requests. Please try again in %d seconds." retryAfterSeconds |}

    let private limitWith (selectLimiter: RateLimiters -> PartitionedRateLimiter<string>) : HttpHandler =
        fun next ctx ->
            task {
                let limiters = ctx.GetService<RateLimiters>()

                if limiters.Disabled then
                    return! next ctx
                else
                    let identityKey =
                        Identity.resolve limiters.IdentityOptions ctx |> Identity.ownerKey

                    use lease = (selectLimiter limiters).AttemptAcquire identityKey

                    if lease.IsAcquired then
                        return! next ctx
                    else
                        return! tooManyRequests lease next ctx
            }

    let tailorPolicy: HttpHandler = limitWith (fun limiters -> limiters.Tailor)

    let convertPolicy: HttpHandler = limitWith (fun limiters -> limiters.Convert)

    let loosePolicy: HttpHandler = limitWith (fun limiters -> limiters.Loose)
