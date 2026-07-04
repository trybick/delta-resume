namespace DeltaResume.Application

open System
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

    member _.GetStatus(ctx: HttpContext) : Task<CreditStatus> =
        task {
            let identity = Identity.resolve options ctx
            let plan = Identity.plan identity

            let isUnlimitedGuest =
                options.UnlimitedGuestCredits
                && (match identity with
                    | GuestVisitor _ -> true
                    | AuthenticatedUser _ -> false)

            if isUnlimitedGuest then
                return
                    { Remaining = 3
                      Total = 3
                      Plan = CreditPlan.toString plan
                      IsAuthenticated = false }
            else

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
            Identity.resolve options ctx
            |> usageKeys
            |> List.map (fun (identityKey, kind, period) ->
                { IdentityKey = identityKey
                  Kind = kind
                  Period = period })

        store.RecordUsage entries
