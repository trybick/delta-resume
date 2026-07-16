namespace DeltaResume.Application

open System
open System.Threading
open System.Threading.Tasks
open Microsoft.AspNetCore.Http

type CreditStatus =
    { Remaining: int
      Total: int
      Plan: string
      IsAuthenticated: bool }

type CreditService(store: CreditStore, options: IdentityOptions) =

    [<Literal>]
    let LifetimePeriod = "lifetime"

    let currentMonthPeriod () = DateTime.UtcNow.ToString "yyyy-MM"

    let usageKeys (identity: RequestIdentity) : (string * string * string) list =
        match identity with
        | AuthenticatedUser(userId, ProPlan) -> [ sprintf "user:%s" userId, "user", currentMonthPeriod () ]
        | AuthenticatedUser(userId, _) -> [ sprintf "user:%s" userId, "user", LifetimePeriod ]
        | GuestVisitor(fingerprint, ipHash) ->
            [ match fingerprint with
              | Some fp -> yield sprintf "fp:%s" fp, "fp", LifetimePeriod
              | None -> ()
              yield sprintf "ip:%s" ipHash, "ip", LifetimePeriod ]

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
                      Plan = CreditPlan.toString plan
                      IsAuthenticated = isAuthenticated identity }
            else

            let mutable used = 0

            for identityKey, _, period in usageKeys identity do
                let! count = store.CountUsage(identityKey, period, cancellationToken)
                used <- max used count

            let total = CreditPlan.creditLimit plan

            return
                { Remaining = max 0 (total - used)
                  Total = total
                  Plan = CreditPlan.toString plan
                  IsAuthenticated = isAuthenticated identity }
        }

    member _.TrySpend
        (
            ctx: HttpContext,
            idempotencyKey: string,
            requestHash: string,
            cancellationToken: CancellationToken
        ) : Task<CreditSpendResult> =
        let identity = Identity.resolve options ctx

        if isUnlimited identity then
            Task.FromResult SpendRecorded
        else
            let entries =
                identity
                |> usageKeys
                |> List.map (fun (identityKey, kind, period) ->
                    { IdentityKey = identityKey
                      Kind = kind
                      Period = period })

            store.TryRecordUsage(
                entries,
                Identity.ownerKey identity,
                CreditPlan.creditLimit (Identity.plan identity),
                idempotencyKey,
                requestHash,
                cancellationToken
            )
