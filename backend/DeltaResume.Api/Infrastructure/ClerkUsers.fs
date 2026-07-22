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

    let parsePublicUser (userId: string) (json: string) : ClerkPublicUser =
        use document = JsonDocument.Parse json
        let root = document.RootElement

        match root.TryGetProperty "public_metadata" with
        | true, metadata when metadata.ValueKind = JsonValueKind.Object ->
            { UserId = userId
              PublicMetadataJson = metadata.GetRawText()
              IsLifetimeFree = readIsLifetimeFree metadata }
        | _ ->
            { UserId = userId
              PublicMetadataJson = "{}"
              IsLifetimeFree = false }

    member _.IsConfigured: bool = secretKey.IsSome

    member _.GetPublicUser(userId: string, cancellationToken: CancellationToken) : Task<ClerkPublicUser option> =
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

                                cache.Set(cacheKey userId, publicUser, cacheExpiration) |> ignore
                                return Some publicUser
                        with ex ->
                            logger.LogWarning(ex, "Clerk getUser error userId={UserId}", userId)
                            return None
        }
