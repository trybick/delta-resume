namespace DeltaResume.Application

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

    let guestUsageEntries (fingerprint: string option) (ipHash: string) : CreditUsageEntry list =
        [ match fingerprint with
          | Some fp ->
              { IdentityKey = OwnerKey.forFingerprint fp
                Kind = Fingerprint
                Period = Lifetime
                Email = None }
          | None -> ()
          { IdentityKey = OwnerKey.forIpHash ipHash
            Kind = Ip
            Period = Lifetime
            Email = None } ]

    let usageEntries (ctx: HttpContext) (identity: RequestIdentity) : CreditUsageEntry list =
        match identity with
        | AuthenticatedUser(userId, ProPlan) ->
            [ { IdentityKey = OwnerKey.forUser userId
                Kind = User
                Period = UsagePeriod.currentMonth ()
                Email = Identity.tryGetEmail ctx.User } ]
        | AuthenticatedUser(userId, _) ->
            let fingerprint, _ = Identity.guestIdentifiers options ctx
            let email = Identity.tryGetEmail ctx.User

            [ yield
                  { IdentityKey = OwnerKey.forUser userId
                    Kind = User
                    Period = Lifetime
                    Email = email }
              match fingerprint with
              | Some fp ->
                  yield
                      { IdentityKey = OwnerKey.forFingerprint fp
                        Kind = Fingerprint
                        Period = Lifetime
                        Email = email }
              | None -> () ]
        | GuestVisitor(fingerprint, ipHash) -> guestUsageEntries fingerprint ipHash

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

            for entry in usageEntries ctx identity do
                let! count = store.CountUsage(entry.IdentityKey, entry.Period, cancellationToken)
                used <- max used count

            let total = CreditPlan.creditLimit plan

            return
                { Remaining = max 0 (total - used)
                  Total = total
                  Plan = plan
                  IsAuthenticated = isAuthenticated identity }
        }

    member _.TrySpend(ctx: HttpContext, cancellationToken: CancellationToken) : Task<CreditSpendResult> =
        let identity = Identity.resolve options ctx

        if isUnlimited identity then
            Task.FromResult(SpendRecorded(OperationId.create ()))
        else
            store.TryRecordUsage(
                usageEntries ctx identity,
                CreditPlan.creditLimit (Identity.plan identity),
                cancellationToken
            )

    member _.Refund(operationId: OperationId, cancellationToken: CancellationToken) : Task<unit> =
        store.DeleteUsageByOperation(operationId, cancellationToken)
