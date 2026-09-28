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
      IsAuthenticated: bool
      FreeAccountTotal: int }

type CreditService(store: CreditStore, options: IdentityOptions) =

    let truncateUserAgent (ctx: HttpContext) : string option =
        let raw = ctx.Request.Headers.UserAgent.ToString()

        if String.IsNullOrWhiteSpace raw then
            None
        elif raw.Length <= 256 then
            Some raw
        else
            Some(raw.Substring(0, 256))

    let period (ctx: HttpContext) (identity: RequestIdentity) : UsagePeriod =
        match identity with
        | AuthenticatedUser(_, ProPlan) -> Identity.currentProPeriod ctx
        | _ -> Lifetime

    let counters (ctx: HttpContext) (identity: RequestIdentity) : CreditCounter list =
        match identity with
        | AuthenticatedUser(userId, ProPlan) -> [ ByUser(userId, Identity.currentProPeriod ctx) ]
        | AuthenticatedUser(userId, _) ->
            let fingerprint, _ = Identity.guestIdentifiers options ctx

            [ ByUser(userId, Lifetime)
              yield! fingerprint |> Option.map ByFingerprint |> Option.toList ]
        | GuestVisitor(fingerprint, ipHash) ->
            [ yield! fingerprint |> Option.map ByFingerprint |> Option.toList
              ByGuestIp ipHash ]

    let charge
        (ctx: HttpContext)
        (identity: RequestIdentity)
        (feature: CreditFeature)
        (runId: Guid option)
        : CreditCharge =
        let fingerprint, ipHash = Identity.guestIdentifiers options ctx

        { UserId =
            match identity with
            | AuthenticatedUser(userId, _) -> Some userId
            | GuestVisitor _ -> None
          Period = period ctx identity
          Email = Identity.tryGetEmail ctx.User
          Plan = Identity.plan identity
          Feature = feature
          IpHash = ipHash
          Fingerprint = fingerprint
          UserAgent = truncateUserAgent ctx
          RunId = runId }

    let isUnlimited (identity: RequestIdentity) : bool =
        options.UnlimitedGuestCredits && Identity.plan identity <> ProPlan

    let isAuthenticated (identity: RequestIdentity) : bool =
        match identity with
        | AuthenticatedUser _ -> true
        | GuestVisitor _ -> false

    let toOutcome (usage: LlmUsage option) (durationMs: int) : CreditUsageOutcome =
        { InputTokens = usage |> Option.map _.InputTokens
          OutputTokens = usage |> Option.map _.OutputTokens
          DurationMs = durationMs }

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
                      IsAuthenticated = isAuthenticated identity
                      FreeAccountTotal = CreditPlan.freeAccountTotal }
            else

            let! used = store.CountUsage(counters ctx identity, cancellationToken)
            let total = CreditPlan.creditLimit plan

            return
                { Remaining = max 0 (total - used)
                  Total = total
                  Plan = plan
                  IsAuthenticated = isAuthenticated identity
                  FreeAccountTotal = CreditPlan.freeAccountTotal }
        }

    member _.TrySpend
        (ctx: HttpContext, feature: CreditFeature, runId: Guid option, cancellationToken: CancellationToken)
        : Task<CreditSpendResult> =
        let identity = Identity.resolve options ctx

        if isUnlimited identity then
            Task.FromResult(SpendRecorded(OperationId.create ()))
        else
            store.TryRecordUsage(
                charge ctx identity feature runId,
                counters ctx identity,
                CreditPlan.creditLimit (Identity.plan identity),
                cancellationToken
            )

    member _.Refund(operationId: OperationId, cancellationToken: CancellationToken) : Task<unit> =
        store.MarkRefunded(operationId, cancellationToken)

    member _.RecordResumeOutcome
        (operationId: OperationId, usage: LlmUsage option, durationMs: int, cancellationToken: CancellationToken)
        : Task<unit> =
        store.RecordResumeOutcome(operationId, toOutcome usage durationMs, cancellationToken)

    member _.RecordCoverLetterOutcome
        (runId: Guid, usage: LlmUsage option, durationMs: int, cancellationToken: CancellationToken)
        : Task<unit> =
        store.RecordCoverLetterOutcome(runId, toOutcome usage durationMs, cancellationToken)
