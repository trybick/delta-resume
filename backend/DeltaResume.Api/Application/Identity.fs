namespace DeltaResume.Application

open System
open System.Security.Claims
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Microsoft.AspNetCore.Http
open DeltaResume.Domain

type CreditPlan =
    | GuestPlan
    | FreePlan
    | ProPlan

module CreditPlan =
    let toString (plan: CreditPlan) : string =
        match plan with
        | GuestPlan -> "guest"
        | FreePlan -> "free"
        | ProPlan -> "pro"

    let creditLimit (plan: CreditPlan) : int =
        match plan with
        | GuestPlan
        | FreePlan -> 3
        | ProPlan -> 100

    let savedResumeLimit (plan: CreditPlan) : int =
        match plan with
        | GuestPlan
        | FreePlan -> 1
        | ProPlan -> 10

type RequestIdentity =
    | AuthenticatedUser of userId: string * plan: CreditPlan
    | GuestVisitor of fingerprint: string option * ipHash: string

type IdentityOptions =
    { IpHashSalt: string
      TrustForwardedHeaders: bool
      UnlimitedGuestCredits: bool }

module IdentityOptions =
    let fromEnvironment () : IdentityOptions =
        let salt =
            Environment.GetEnvironmentVariable "IP_HASH_SALT"
            |> Option.ofObj
            |> Option.filter (String.IsNullOrWhiteSpace >> not)
            |> Option.defaultWith (fun () -> failwith "IP_HASH_SALT environment variable is required")

        let runningLocally = LocalDev.isRunningLocally ()

        let readBool (name: string) =
            Environment.GetEnvironmentVariable name
            |> Option.ofObj
            |> Option.map (fun value -> value.Equals("true", StringComparison.OrdinalIgnoreCase))
            |> Option.defaultValue false

        { IpHashSalt = salt
          TrustForwardedHeaders =
            if runningLocally then false
            else readBool "TRUST_FORWARDED_HEADERS"
          UnlimitedGuestCredits = runningLocally }

module Identity =

    [<Literal>]
    let FingerprintHeader = "X-Guest-Fingerprint"

    let private hashWithSalt (salt: string) (value: string) : string =
        HMACSHA256.HashData(Encoding.UTF8.GetBytes salt, Encoding.UTF8.GetBytes value)
        |> Convert.ToHexString

    let private sanitizeFingerprint (value: string) : string option =
        let trimmed = value.Trim()

        if trimmed.Length = 0 || trimmed.Length > 128 then
            None
        else
            Some trimmed

    let private firstNonEmptyHeader (ctx: HttpContext) (name: string) : string option =
        let value = ctx.Request.Headers[name].ToString().Trim()

        if String.IsNullOrWhiteSpace value then None else Some value

    let private resolveClientIp (options: IdentityOptions) (ctx: HttpContext) : string =
        if options.TrustForwardedHeaders then
            match firstNonEmptyHeader ctx "X-Real-IP" with
            | Some realIp -> realIp.Split(',').[0].Trim()
            | None ->
                match firstNonEmptyHeader ctx "X-Forwarded-For" with
                | Some forwarded -> forwarded.Split(',').[0].Trim()
                | None ->
                    match ctx.Connection.RemoteIpAddress with
                    | null -> "unknown"
                    | ip -> ip.ToString()
        else
            match ctx.Connection.RemoteIpAddress with
            | null -> "unknown"
            | ip -> ip.ToString()

    let private isTruthyLifetimeFreeFlag (value: string) : bool =
        not (isNull value)
        && value.Equals("true", StringComparison.OrdinalIgnoreCase)

    let private tryReadLifetimeFreeFromJson (json: string) : bool =
        if String.IsNullOrWhiteSpace json then
            false
        else
            try
                use document = JsonDocument.Parse json

                match document.RootElement.TryGetProperty "isLifetimeFree" with
                | true, element when element.ValueKind = JsonValueKind.String ->
                    isTruthyLifetimeFreeFlag (element.GetString())
                | true, element when element.ValueKind = JsonValueKind.True -> true
                | _ -> false
            with _ ->
                false

    let private claimValue (user: ClaimsPrincipal) (claimType: string) : string option =
        user.Claims
        |> Seq.tryFind (fun claim -> claim.Type = claimType)
        |> Option.map (fun claim -> claim.Value)
        |> Option.filter (String.IsNullOrWhiteSpace >> not)

    let private hasLifetimeFree (user: ClaimsPrincipal) : bool =
        match claimValue user "isLifetimeFree" with
        | Some value when isTruthyLifetimeFreeFlag value -> true
        | Some value when tryReadLifetimeFreeFromJson value -> true
        | _ ->
            [ "metadata"; "public_metadata"; "publicMetadata" ]
            |> List.exists (fun claimType ->
                claimValue user claimType
                |> Option.map tryReadLifetimeFreeFromJson
                |> Option.defaultValue false)

    let private resolveUserPlan (user: ClaimsPrincipal) : CreditPlan =
        let planClaim =
            claimValue user "pla" |> Option.defaultValue ""

        if planClaim.Contains "pro" || hasLifetimeFree user then ProPlan else FreePlan

    let guestIdentifiers (options: IdentityOptions) (ctx: HttpContext) : string option * string =
        let fingerprint =
            ctx.Request.Headers[FingerprintHeader].ToString() |> sanitizeFingerprint

        fingerprint, hashWithSalt options.IpHashSalt (resolveClientIp options ctx)

    let resolve (options: IdentityOptions) (ctx: HttpContext) : RequestIdentity =
        let user = ctx.User

        let userId =
            if not (isNull user) && not (isNull user.Identity) && user.Identity.IsAuthenticated then
                [ "sub"; ClaimTypes.NameIdentifier ]
                |> List.tryPick (fun claimType ->
                    user.FindFirstValue claimType
                    |> Option.ofObj
                    |> Option.filter (String.IsNullOrWhiteSpace >> not))
            else
                None

        match userId with
        | Some id -> AuthenticatedUser(id, resolveUserPlan user)
        | None ->
            let fingerprint, ipHash = guestIdentifiers options ctx
            GuestVisitor(fingerprint, ipHash)

    let plan (identity: RequestIdentity) : CreditPlan =
        match identity with
        | AuthenticatedUser(_, plan) -> plan
        | GuestVisitor _ -> GuestPlan

    let ownerKey (identity: RequestIdentity) : OwnerKey =
        match identity with
        | AuthenticatedUser(userId, _) -> OwnerKey.forUser userId
        | GuestVisitor(Some fingerprint, _) -> OwnerKey.forFingerprint fingerprint
        | GuestVisitor(None, ipHash) -> OwnerKey.forIpHash ipHash

    let rateLimitKey (options: IdentityOptions) (ctx: HttpContext) : string =
        sprintf "ip:%s" (hashWithSalt options.IpHashSalt (resolveClientIp options ctx))
