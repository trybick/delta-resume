namespace DeltaResume.Infrastructure

open System
open System.Net.Http
open System.Net.Http.Headers
open System.Text.Json
open System.Threading
open System.Threading.Tasks
open Microsoft.Extensions.Caching.Memory
open Microsoft.Extensions.Logging
open DeltaResume.Application

type ClerkUsers
    (
        httpClientFactory: IHttpClientFactory,
        cache: IMemoryCache,
        logger: ILogger<ClerkUsers>,
        secretKey: string option
    ) =

    let cacheExpiration = TimeSpan.FromMinutes 30.0

    let cacheKey (userId: string) = sprintf "clerk-public-user:%s" userId

    let tryGetCached (userId: string) : ClerkPublicUser option =
        if String.IsNullOrWhiteSpace userId then
            None
        else
            match cache.TryGetValue(cacheKey userId) with
            | true, (:? ClerkPublicUser as cached) -> Some cached
            | _ -> None

    let isTruthyLifetimeFreeFlag (value: string) : bool =
        not (isNull value)
        && value.Equals("true", StringComparison.OrdinalIgnoreCase)

    let readIsLifetimeFree (metadata: JsonElement) : bool =
        match metadata.TryGetProperty "isLifetimeFree" with
        | true, element when element.ValueKind = JsonValueKind.True -> true
        | true, element when element.ValueKind = JsonValueKind.String ->
            isTruthyLifetimeFreeFlag (element.GetString())
        | _ -> false

    let epochMillisToOffset (millis: int64) : DateTimeOffset =
        DateTimeOffset.FromUnixTimeMilliseconds millis

    let readCreatedAt (root: JsonElement) : DateTimeOffset option =
        match root.TryGetProperty "created_at" with
        | true, element when element.ValueKind = JsonValueKind.Number -> Some(epochMillisToOffset (element.GetInt64()))
        | _ -> None

    let parsePublicUser (userId: string) (json: string) : ClerkPublicUser =
        use document = JsonDocument.Parse json
        let root = document.RootElement
        let createdAt = readCreatedAt root

        match root.TryGetProperty "public_metadata" with
        | true, metadata when metadata.ValueKind = JsonValueKind.Object ->
            { UserId = userId
              PublicMetadataJson = metadata.GetRawText()
              IsLifetimeFree = readIsLifetimeFree metadata
              CreatedAt = createdAt
              ProPeriodStart = None }
        | _ ->
            { UserId = userId
              PublicMetadataJson = "{}"
              IsLifetimeFree = false
              CreatedAt = createdAt
              ProPeriodStart = None }

    /// The subscription item Clerk considers the user's active pro plan, mirroring
    /// the frontend's `useSubscription` filter (see App.tsx).
    let tryFindActiveProItem (subscriptionJson: string) : DateTimeOffset option =
        use document = JsonDocument.Parse subscriptionJson
        let root = document.RootElement

        match root.TryGetProperty "subscription_items" with
        | true, items when items.ValueKind = JsonValueKind.Array ->
            items.EnumerateArray()
            |> Seq.tryPick (fun item ->
                let slug =
                    match item.TryGetProperty "plan" with
                    | true, plan when plan.ValueKind = JsonValueKind.Object ->
                        match plan.TryGetProperty "slug" with
                        | true, slugEl when slugEl.ValueKind = JsonValueKind.String -> slugEl.GetString()
                        | _ -> null
                    | _ -> null

                let status =
                    match item.TryGetProperty "status" with
                    | true, statusEl when statusEl.ValueKind = JsonValueKind.String -> statusEl.GetString()
                    | _ -> null

                let periodStart =
                    match item.TryGetProperty "period_start" with
                    | true, psEl when psEl.ValueKind = JsonValueKind.Number -> Some(psEl.GetInt64())
                    | _ -> None

                match slug, status, periodStart with
                | "pro", ("active" | "past_due"), Some millis -> Some(epochMillisToOffset millis)
                | _ -> None)
        | _ -> None

    member _.IsConfigured: bool = secretKey.IsSome

    member private _.FetchProPeriodStart
        (userId: string, cancellationToken: CancellationToken)
        : Task<DateTimeOffset option> =
        task {
            match secretKey with
            | None -> return None
            | Some key ->
                try
                    let httpClient = httpClientFactory.CreateClient("clerk")

                    use request =
                        new HttpRequestMessage(
                            HttpMethod.Get,
                            sprintf
                                "https://api.clerk.com/v1/users/%s/billing/subscription"
                                (Uri.EscapeDataString userId)
                        )

                    request.Headers.Authorization <- AuthenticationHeaderValue("Bearer", key)

                    use! response = httpClient.SendAsync(request, cancellationToken)

                    if not response.IsSuccessStatusCode then
                        let! body = response.Content.ReadAsStringAsync(cancellationToken)

                        logger.LogWarning(
                            "Clerk getUserBillingSubscription failed userId={UserId} status={StatusCode} body={Body}",
                            userId,
                            int response.StatusCode,
                            body
                        )

                        return None
                    else
                        let! body = response.Content.ReadAsStringAsync(cancellationToken)
                        return tryFindActiveProItem body
                with ex ->
                    logger.LogWarning(ex, "Clerk getUserBillingSubscription error userId={UserId}", userId)
                    return None
        }

    /// Looks up the user's Clerk profile (for lifetime-free status and account
    /// creation date) and, when `needsProPeriod` is true, their active pro
    /// subscription's current billing-period start. `needsProPeriod` should come
    /// from the session JWT's plan claim, so free/guest requests skip the extra
    /// billing lookup entirely.
    member this.GetPublicUser
        (userId: string, needsProPeriod: bool, cancellationToken: CancellationToken)
        : Task<ClerkPublicUser option> =
        task {
            if String.IsNullOrWhiteSpace userId then
                return None
            else
                match secretKey with
                | None -> return None
                | Some key ->
                    match tryGetCached userId with
                    | Some cached -> return Some cached
                    | None ->
                        try
                            let httpClient = httpClientFactory.CreateClient("clerk")

                            use request =
                                new HttpRequestMessage(
                                    HttpMethod.Get,
                                    sprintf "https://api.clerk.com/v1/users/%s" (Uri.EscapeDataString userId)
                                )

                            request.Headers.Authorization <- AuthenticationHeaderValue("Bearer", key)

                            use! response = httpClient.SendAsync(request, cancellationToken)

                            if not response.IsSuccessStatusCode then
                                let! body = response.Content.ReadAsStringAsync(cancellationToken)

                                logger.LogWarning(
                                    "Clerk getUser failed userId={UserId} status={StatusCode} body={Body}",
                                    userId,
                                    int response.StatusCode,
                                    body
                                )

                                return None
                            else
                                let! body = response.Content.ReadAsStringAsync(cancellationToken)
                                let publicUser = parsePublicUser userId body

                                let! proPeriodStart =
                                    if needsProPeriod then
                                        this.FetchProPeriodStart(userId, cancellationToken)
                                    else
                                        Task.FromResult None

                                let publicUser =
                                    { publicUser with
                                        ProPeriodStart = proPeriodStart }

                                cache.Set(cacheKey userId, publicUser, cacheExpiration) |> ignore
                                return Some publicUser
                        with ex ->
                            logger.LogWarning(ex, "Clerk getUser error userId={UserId}", userId)
                            return None
        }
