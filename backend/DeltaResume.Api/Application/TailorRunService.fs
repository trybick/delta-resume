namespace DeltaResume.Application

open System
open System.Threading.Tasks
open Microsoft.AspNetCore.Http
open DeltaResume.Domain

module TailorRunDecisions =
    [<Literal>]
    let EmptyJson = """{"decisions":{},"addedBullets":[]}"""

type TailorRunListResult =
    { Runs: TailorRunRecord list
      HiddenOlderCount: int }

type ClaimRunResult =
    | Claimed of TailorRunRecord
    | AlreadyOwned of TailorRunRecord
    | Conflict
    | GuestUser

type TailorRunService(repository: TailorRunRepository, options: IdentityOptions) =

    let ownerIdentity (ctx: HttpContext) =
        match Identity.resolve options ctx with
        | GuestVisitor _ -> None
        | AuthenticatedUser _ as identity -> Some(Identity.ownerKey identity, Identity.plan identity)

    member _.SaveAfterTailor(ctx: HttpContext, record: TailorRunRecord) : Task<unit> =
        task {
            match ownerIdentity ctx with
            | None -> ()
            | Some _ -> do! repository.Upsert record
        }

    member _.SaveCoverLetter
        (
            ctx: HttpContext,
            runId: Guid,
            coverLetterJson: string,
            companyName: string option,
            jobTitle: string option
        )
        : Task<unit> =
        task {
            match ownerIdentity ctx with
            | None -> ()
            | Some(ownerKey, _) ->
                do!
                    repository.UpsertCoverLetter(
                        runId,
                        ownerKey,
                        coverLetterJson,
                        companyName,
                        jobTitle
                    )
        }

    member _.List(ctx: HttpContext) : Task<TailorRunListResult option> =
        task {
            match ownerIdentity ctx with
            | None -> return None
            | Some(ownerKey, plan) ->
                let! records = repository.ListByOwner ownerKey

                match CreditPlan.historyVisibleLimit plan with
                | None ->
                    return
                        Some
                            { Runs = records
                              HiddenOlderCount = 0 }
                | Some limit ->
                    return
                        Some
                            { Runs = records |> List.truncate limit
                              HiddenOlderCount = max 0 (records.Length - limit) }
        }

    member _.Get(ctx: HttpContext, id: Guid) : Task<TailorRunRecord option> =
        match ownerIdentity ctx with
        | None -> Task.FromResult None
        | Some(ownerKey, _) -> repository.GetById(id, ownerKey)

    member _.UpdateDecisions(ctx: HttpContext, id: Guid, decisionsJson: string) : Task<bool> =
        match ownerIdentity ctx with
        | None -> Task.FromResult false
        | Some(ownerKey, _) -> repository.UpdateDecisions(id, ownerKey, decisionsJson)

    member _.Delete(ctx: HttpContext, id: Guid) : Task<bool> =
        match ownerIdentity ctx with
        | None -> Task.FromResult false
        | Some(ownerKey, _) -> repository.Delete(id, ownerKey)

    member _.Claim(ctx: HttpContext, record: TailorRunRecord) : Task<ClaimRunResult> =
        task {
            match ownerIdentity ctx with
            | None -> return GuestUser
            | Some(ownerKey, _) ->
                let claimed = { record with OwnerKey = ownerKey }
                let! existing = repository.GetById(claimed.Id, ownerKey)

                match existing with
                | Some owned -> return AlreadyOwned owned
                | None ->
                    do! repository.Upsert claimed
                    let! saved = repository.GetById(claimed.Id, ownerKey)

                    match saved with
                    | Some owned -> return Claimed owned
                    | None -> return Conflict
        }
