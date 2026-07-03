namespace ResumeTailor.Application

open System
open System.Security.Claims
open System.Security.Cryptography
open System.Text
open System.Threading.Tasks
open Microsoft.AspNetCore.Http

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

type CreditStatus =
    { Remaining: int
      Total: int
      Plan: string
      IsAuthenticated: bool }

type private CreditIdentity =
    | AuthenticatedUser of userId: string * plan: CreditPlan
    | GuestVisitor of fingerprint: string option * ipHash: string

type CreditServiceOptions =
    { IpHashSalt: string
      TrustForwardedHeaders: bool }

module CreditServiceOptions =
    let fromEnvironment () : CreditServiceOptions =
        let salt =
            Environment.GetEnvironmentVariable "IP_HASH_SALT"
            |> Option.ofObj
            |> Option.filter (String.IsNullOrWhiteSpace >> not)
            |> Option.defaultValue "resume-tailor-default-salt"

        let trustForwarded =
            Environment.GetEnvironmentVariable "TRUST_FORWARDED_HEADERS"
            |> Option.ofObj
            |> Option.map (fun value -> value.Equals("true", StringComparison.OrdinalIgnoreCase))
            |> Option.defaultValue false

        { IpHashSalt = salt
          TrustForwardedHeaders = trustForwarded }

type CreditService(store: CreditStore, options: CreditServiceOptions) =

    [<Literal>]
    let LifetimePeriod = "lifetime"

    let fingerprintHeader = "X-Guest-Fingerprint"

    let currentMonthPeriod () = DateTime.UtcNow.ToString "yyyy-MM"

    let hashWithSalt (value: string) : string =
        Encoding.UTF8.GetBytes(options.IpHashSalt + value)
        |> SHA256.HashData
        |> Convert.ToHexString

    let sanitizeFingerprint (value: string) : string option =
        let trimmed = value.Trim()

        if trimmed.Length = 0 || trimmed.Length > 128 then
            None
        else
            Some trimmed

    let resolveClientIp (ctx: HttpContext) : string =
        let forwarded =
            if options.TrustForwardedHeaders then
                ctx.Request.Headers["X-Forwarded-For"].ToString()
            else
                ""

        if not (String.IsNullOrWhiteSpace forwarded) then
            forwarded.Split(',').[0].Trim()
        else
            match ctx.Connection.RemoteIpAddress with
            | null -> "unknown"
            | ip -> ip.ToString()

    let resolveUserPlan (user: ClaimsPrincipal) : CreditPlan =
        let planClaim =
            user.Claims
            |> Seq.tryFind (fun claim -> claim.Type = "pla")
            |> Option.map (fun claim -> claim.Value)
            |> Option.defaultValue ""

        if planClaim.Contains "pro" then ProPlan else FreePlan

    let resolveIdentity (ctx: HttpContext) : CreditIdentity =
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
            let fingerprint =
                ctx.Request.Headers[fingerprintHeader].ToString() |> sanitizeFingerprint

            GuestVisitor(fingerprint, hashWithSalt (resolveClientIp ctx))

    let usageKeys (identity: CreditIdentity) : (string * string * string) list =
        match identity with
        | AuthenticatedUser(userId, ProPlan) -> [ sprintf "user:%s" userId, "user", currentMonthPeriod () ]
        | AuthenticatedUser(userId, _) -> [ sprintf "user:%s" userId, "user", LifetimePeriod ]
        | GuestVisitor(fingerprint, ipHash) ->
            [ match fingerprint with
              | Some fp -> yield sprintf "fp:%s" fp, "fp", LifetimePeriod
              | None -> ()
              yield sprintf "ip:%s" ipHash, "ip", LifetimePeriod ]

    member _.GetStatus(ctx: HttpContext) : Task<CreditStatus> =
        task {
            let identity = resolveIdentity ctx

            let plan =
                match identity with
                | AuthenticatedUser(_, plan) -> plan
                | GuestVisitor _ -> GuestPlan

            let mutable used = 0

            for identityKey, _, period in usageKeys identity do
                let! count = store.CountUsage(identityKey, period)
                used <- max used count

            let total = CreditPlan.creditLimit plan

            return
                { Remaining = max 0 (total - used)
                  Total = total
                  Plan = CreditPlan.toString plan
                  IsAuthenticated =
                    match identity with
                    | AuthenticatedUser _ -> true
                    | GuestVisitor _ -> false }
        }

    member _.RecordSpend(ctx: HttpContext) : Task<unit> =
        let entries =
            resolveIdentity ctx
            |> usageKeys
            |> List.map (fun (identityKey, kind, period) ->
                { IdentityKey = identityKey
                  Kind = kind
                  Period = period })

        store.RecordUsage entries
