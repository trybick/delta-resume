namespace DeltaResume.Application

open System
open System.Security.Claims
open System.Security.Cryptography
open System.Text
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
        | ProPlan -> 200

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

    let private resolveClientIp (options: IdentityOptions) (ctx: HttpContext) : string =
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

    let private resolveUserPlan (user: ClaimsPrincipal) : CreditPlan =
        let planClaim =
            user.Claims
            |> Seq.tryFind (fun claim -> claim.Type = "pla")
            |> Option.map (fun claim -> claim.Value)
            |> Option.defaultValue ""

        if planClaim.Contains "pro" then ProPlan else FreePlan

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
            let fingerprint =
                ctx.Request.Headers[FingerprintHeader].ToString() |> sanitizeFingerprint

            GuestVisitor(fingerprint, hashWithSalt options.IpHashSalt (resolveClientIp options ctx))

    let plan (identity: RequestIdentity) : CreditPlan =
        match identity with
        | AuthenticatedUser(_, plan) -> plan
        | GuestVisitor _ -> GuestPlan

    let ownerKey (identity: RequestIdentity) : string =
        match identity with
        | AuthenticatedUser(userId, _) -> sprintf "user:%s" userId
        | GuestVisitor(Some fingerprint, _) -> sprintf "fp:%s" fingerprint
        | GuestVisitor(None, ipHash) -> sprintf "ip:%s" ipHash
