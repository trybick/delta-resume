namespace DeltaResume.Application

open System
open System.Threading
open System.Threading.Tasks
open Microsoft.AspNetCore.Http
open DeltaResume.Domain

type CreditStatus =
    { Remaining: int
      Total: int
      Plan: CreditPlan
      IsAuthenticated: bool }

type CreditService(store: CreditStore, options: IdentityOptions) =

    let truncateUserAgent (ctx: HttpContext) : string option =
        let raw = ctx.Request.Headers.UserAgent.ToString()

        if String.IsNullOrWhiteSpace raw then
            None
        elif raw.Length <= 256 then
            Some raw
        else
            Some(raw.Substring(0, 256))

    let baseEntry
        (identityKey: OwnerKey)
        (kind: CreditKind)
        (period: UsagePeriod)
        (plan: CreditPlan)
        (feature: CreditFeature)
        (email: string option)
        (fingerprint: string option)
        (ipHash: string)
        (userAgent: string option)
        : CreditUsageEntry =
        { IdentityKey = identityKey
          Kind = kind
          Period = period
          Email = email
          Plan = plan
          Feature = feature
          IpHash = ipHash
          Fingerprint = fingerprint
          UserAgent = userAgent }

    let guestUsageEntries
        (ctx: HttpContext)
        (feature: CreditFeature)
        (fingerprint: string option)
        (ipHash: string)
        : CreditUsageEntry list =
        let userAgent = truncateUserAgent ctx

        [ match fingerprint with
          | Some fp ->
              baseEntry
                  (OwnerKey.forFingerprint fp)
                  Fingerprint
                  Lifetime
                  GuestPlan
                  feature
                  None
                  fingerprint
                  ipHash
                  userAgent
          | None -> ()
          baseEntry
              (OwnerKey.forIpHash ipHash)
              Ip
              Lifetime
              GuestPlan
              feature
              None
              fingerprint
              ipHash
              userAgent ]

    let usageEntries (ctx: HttpContext) (identity: RequestIdentity) (feature: CreditFeature) : CreditUsageEntry list =
        match identity with
        | AuthenticatedUser(userId, ProPlan) ->
            let fingerprint, ipHash = Identity.guestIdentifiers options ctx
            let email = Identity.tryGetEmail ctx.User
            let userAgent = truncateUserAgent ctx

            [ baseEntry
                  (OwnerKey.forUser userId)
                  User
                  (Identity.currentProPeriod ctx)
                  ProPlan
                  feature
                  email
                  fingerprint
                  ipHash
                  userAgent ]
        | AuthenticatedUser(userId, plan) ->
            let fingerprint, ipHash = Identity.guestIdentifiers options ctx
            let email = Identity.tryGetEmail ctx.User
            let userAgent = truncateUserAgent ctx

            [ yield
                  baseEntry
                      (OwnerKey.forUser userId)
                      User
                      Lifetime
                      plan
                      feature
                      email
                      fingerprint
                      ipHash
                      userAgent
              match fingerprint with
              | Some fp ->
                  yield
                      baseEntry
                          (OwnerKey.forFingerprint fp)
                          Fingerprint
                          Lifetime
                          plan
                          feature
                          email
                          fingerprint
                          ipHash
                          userAgent
              | None -> () ]
        | GuestVisitor(fingerprint, ipHash) -> guestUsageEntries ctx feature fingerprint ipHash

    let isUnlimited (identity: RequestIdentity) : bool =
        options.UnlimitedGuestCredits && Identity.plan identity <> ProPlan

    let isAuthenticated (identity: RequestIdentity) : bool =
        match identity with
        | AuthenticatedUser _ -> true
        | GuestVisitor _ -> false

    member _.GetStatus(ctx: HttpContext, cancellationToken: CancellationToken) : Task<CreditStatus> =
        task {
            let identity = Identity.resolve options ctx
            let plan = Identity.plan identity

            if isUnlimited identity then
                let total = CreditPlan.creditLimit plan

                return
                    { Remaining = total
                      Total = total
                      Plan = plan
                      IsAuthenticated = isAuthenticated identity }
            else

            let mutable used = 0

            for entry in usageEntries ctx identity Tailor do
                let! count = store.CountUsage(entry.IdentityKey, entry.Period, cancellationToken)
                used <- max used count

            let total = CreditPlan.creditLimit plan

            return
                { Remaining = max 0 (total - used)
                  Total = total
                  Plan = plan
                  IsAuthenticated = isAuthenticated identity }
        }

    member _.TrySpend
        (ctx: HttpContext, feature: CreditFeature, cancellationToken: CancellationToken)
        : Task<CreditSpendResult> =
        let identity = Identity.resolve options ctx

        if isUnlimited identity then
            Task.FromResult(SpendRecorded(OperationId.create ()))
        else
            store.TryRecordUsage(
                usageEntries ctx identity feature,
                CreditPlan.creditLimit (Identity.plan identity),
                cancellationToken
            )

    member _.Refund(operationId: OperationId, cancellationToken: CancellationToken) : Task<unit> =
        store.MarkRefunded(operationId, cancellationToken)
