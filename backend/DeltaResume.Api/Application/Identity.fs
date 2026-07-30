namespace DeltaResume.Application

open System
open System.Net
open System.Security.Claims
open System.Security.Cryptography
open System.Text
open Microsoft.AspNetCore.Http
open DeltaResume.Domain

type RequestIdentity =
    | AuthenticatedUser of userId: string * plan: CreditPlan
    | GuestVisitor of fingerprint: string option * ipHash: string

type ClerkPublicUser =
    { UserId: string
      PublicMetadataJson: string
      IsLifetimeFree: bool
      CreatedAt: DateTimeOffset option
      /// Current billing period start for an active/past-due pro subscription, as
      /// reported by Clerk. None when the user has no real subscription (e.g. a
      /// lifetime-free grant) or the lookup failed.
      ProPeriodStart: DateTimeOffset option }

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

    [<Literal>]
    let private ClerkPublicUserItemKey = "ClerkPublicUser"

    let private hashWithSalt (salt: string) (value: string) : string =
        HMACSHA256.HashData(Encoding.UTF8.GetBytes salt, Encoding.UTF8.GetBytes value)
        |> Convert.ToHexString

    let private sanitizeFingerprint (value: string) : string option =
        let trimmed = value.Trim()

        if trimmed.Length = 0 || trimmed.Length > 128 then
            None
        else
            Some trimmed

    /// Skips addresses that cannot belong to a real internet client. A proxy hop
    /// reporting its own address here would otherwise become one shared identity that
    /// every visitor lands in, handing them all the same exhausted credit bucket.
    let private isPublicClient (address: IPAddress) : bool =
        let bytes = address.GetAddressBytes()

        if IPAddress.IsLoopback address then false
        elif bytes.Length <> 4 then true
        else
            match bytes[0], bytes[1] with
            | 0uy, _
            | 10uy, _ -> false
            | 169uy, 254uy -> false
            | 172uy, second when second >= 16uy && second <= 31uy -> false
            | 192uy, 168uy -> false
            | 100uy, second when second >= 64uy && second <= 127uy -> false // CGNAT, used by Railway internally
            | _ -> true

    let private resolveClientIp (options: IdentityOptions) (ctx: HttpContext) : string =
        let connectionIp () =
            match ctx.Connection.RemoteIpAddress with
            | null -> "unknown"
            | address -> address.ToString()

        if not options.TrustForwardedHeaders then
            connectionIp ()
        else
            // Railway's edge puts the real client at the left of X-Forwarded-For and
            // recommends that header; X-Real-IP is a fallback because their CDN layer
            // has been seen overwriting it with an edge address.
            let forwarded =
                ctx.Request.Headers["X-Forwarded-For"].ToString()
                + ","
                + ctx.Request.Headers["X-Real-IP"].ToString()

            forwarded.Split(',', StringSplitOptions.RemoveEmptyEntries)
            |> Array.tryPick (fun value ->
                match IPEndPoint.TryParse(value.Trim()) with
                | true, endpoint when isPublicClient endpoint.Address -> Some(endpoint.Address.ToString())
                | _ -> None)
            |> Option.defaultWith connectionIp

    let private claimValue (user: ClaimsPrincipal) (claimType: string) : string option =
        user.Claims
        |> Seq.tryFind (fun claim -> claim.Type = claimType)
        |> Option.map (fun claim -> claim.Value)
        |> Option.filter (String.IsNullOrWhiteSpace >> not)

    let tryGetAuthenticatedUserId (user: ClaimsPrincipal) : string option =
        if not (isNull user) && not (isNull user.Identity) && user.Identity.IsAuthenticated then
            [ "sub"; ClaimTypes.NameIdentifier ]
            |> List.tryPick (fun claimType ->
                user.FindFirstValue claimType
                |> Option.ofObj
                |> Option.filter (String.IsNullOrWhiteSpace >> not))
        else
            None

    /// Email from the Clerk session JWT when present. Guests have none; signed-in
    /// users only have it if the session token template includes the email claim.
    let tryGetEmail (user: ClaimsPrincipal) : string option =
        if isNull user then
            None
        else
            [ ClaimTypes.Email; "email"; "email_address" ]
            |> List.tryPick (claimValue user)
            |> Option.map (fun value -> value.Trim())
            |> Option.filter (fun value -> value.Length > 0 && value.Length <= 320)

    let tryGetClerkPublicUser (ctx: HttpContext) : ClerkPublicUser option =
        match ctx.Items.TryGetValue ClerkPublicUserItemKey with
        | true, (:? ClerkPublicUser as publicUser) -> Some publicUser
        | _ -> None

    let setClerkPublicUser (ctx: HttpContext) (publicUser: ClerkPublicUser) : unit =
        ctx.Items[ClerkPublicUserItemKey] <- publicUser

    let private hasProPlanClaim (user: ClaimsPrincipal) : bool =
        let planClaim =
            claimValue user "pla" |> Option.defaultValue ""

        planClaim.Contains "pro"

    let private resolveUserPlan (user: ClaimsPrincipal) (isLifetimeFree: bool) : CreditPlan =
        if hasProPlanClaim user || isLifetimeFree then ProPlan else FreePlan

    /// Whether the session JWT claims a pro plan. Used to decide whether it's
    /// worth looking up the user's real Clerk billing period; lifetime-free grants
    /// are also pro but have no subscription to look up.
    let claimsProPlan (ctx: HttpContext) : bool = hasProPlanClaim ctx.User

    let guestIdentifiers (options: IdentityOptions) (ctx: HttpContext) : string option * string =
        let fingerprint =
            ctx.Request.Headers[FingerprintHeader].ToString() |> sanitizeFingerprint

        fingerprint, hashWithSalt options.IpHashSalt (resolveClientIp options ctx)

    let resolve (options: IdentityOptions) (ctx: HttpContext) : RequestIdentity =
        let user = ctx.User

        match tryGetAuthenticatedUserId user with
        | Some id ->
            let isLifetimeFree =
                tryGetClerkPublicUser ctx
                |> Option.map (fun publicUser -> publicUser.IsLifetimeFree)
                |> Option.defaultValue false

            AuthenticatedUser(id, resolveUserPlan user isLifetimeFree)
        | None ->
            let fingerprint, ipHash = guestIdentifiers options ctx
            GuestVisitor(fingerprint, ipHash)

    let plan (identity: RequestIdentity) : CreditPlan =
        match identity with
        | AuthenticatedUser(_, plan) -> plan
        | GuestVisitor _ -> GuestPlan

    /// The credit-usage period a pro user is currently in. Prefers the real Clerk
    /// subscription's billing-period start (kept in sync with renewals) and falls
    /// back to an anchor on the user's signup day, then finally the calendar month
    /// if neither is known.
    let currentProPeriod (ctx: HttpContext) : UsagePeriod =
        match tryGetClerkPublicUser ctx with
        | Some { ProPeriodStart = Some periodStart } -> UsagePeriod.ofSubscriptionPeriodStart periodStart
        | Some { CreatedAt = Some createdAt } -> UsagePeriod.ofSignupAnchor createdAt
        | _ -> UsagePeriod.currentCalendarMonth ()

    let ownerKey (identity: RequestIdentity) : OwnerKey =
        match identity with
        | AuthenticatedUser(userId, _) -> OwnerKey.forUser userId
        | GuestVisitor(Some fingerprint, _) -> OwnerKey.forFingerprint fingerprint
        | GuestVisitor(None, ipHash) -> OwnerKey.forIpHash ipHash

    let rateLimitKey (options: IdentityOptions) (ctx: HttpContext) : string =
        sprintf "ip:%s" (hashWithSalt options.IpHashSalt (resolveClientIp options ctx))
