namespace DeltaResume.Application

open System
open System.Security.Cryptography
open System.Text
open System.Threading.Tasks
open Microsoft.AspNetCore.Http
open DeltaResume.Domain

type SavedResumeService(repository: SavedResumeRepository, options: IdentityOptions) =

    let hashContent (resumeText: string) : string =
        SHA256.HashData(Encoding.UTF8.GetBytes(resumeText.Trim()))
        |> Convert.ToHexString

    let fallbackName (now: DateTimeOffset) : string =
        sprintf "Resume %s" (now.UtcDateTime.ToString "M/d/yy h:mm tt")

    let sanitizeName (value: string option) (now: DateTimeOffset) : string =
        value
        |> Option.map (fun name -> name.Trim())
        |> Option.filter (fun name -> name.Length > 0)
        |> Option.map (fun name ->
            if name.Length > InputLimits.MaxNameCharacters then
                name.Substring(0, InputLimits.MaxNameCharacters)
            else
                name)
        |> Option.defaultValue (fallbackName now)

    // Called after a successful tailor only - upload/paste never hits the server.
    // Formatting lives primarily in the browser: .docx originals are kept in IndexedDB
    // so export can restore layout. The backend only stores plain text, so it cannot
    // be the source of truth for formatting.
    // We still persist text here so the Saved list works across sessions/devices, and
    // so we can content-hash each resume to skip duplicates and trim oldest entries
    // when the plan's saved-resume limit is exceeded.
    member _.AutoSave(ctx: HttpContext, resumeText: string, requestedName: string option) : Task<unit> =
        task {
            let identity = Identity.resolve options ctx

            match identity with
            | GuestVisitor _ -> ()
            | AuthenticatedUser _ ->
                if not (String.IsNullOrWhiteSpace resumeText) then
                    let ownerKey = Identity.ownerKey identity
                    let limit = CreditPlan.savedResumeLimit (Identity.plan identity)
                    let contentHash = hashContent resumeText
                    let now = DateTimeOffset.UtcNow

                    let! existing = repository.FindByHash(ownerKey, contentHash)

                    match existing with
                    | Some _ -> ()
                    | None ->
                        do!
                            repository.Insert
                                { Id = SavedResumeId(Guid.NewGuid())
                                  OwnerKey = ownerKey
                                  Name = sanitizeName requestedName now
                                  ResumeText = resumeText
                                  ContentHash = contentHash
                                  CreatedAt = now }

                        do! repository.DeleteLeastRecentlyUsed(ownerKey, limit)
        }

    member _.List(ctx: HttpContext) : Task<SavedResume list> =
        let ownerKey = Identity.resolve options ctx |> Identity.ownerKey
        repository.ListByOwner ownerKey

    member _.Rename(ctx: HttpContext, id: SavedResumeId, name: string) : Task<bool> =
        task {
            let trimmed = if isNull name then "" else name.Trim()

            if trimmed.Length = 0 then
                return false
            else
                let ownerKey = Identity.resolve options ctx |> Identity.ownerKey
                return! repository.Rename(id, ownerKey, sanitizeName (Some trimmed) DateTimeOffset.UtcNow)
        }

    member _.Delete(ctx: HttpContext, id: SavedResumeId) : Task<bool> =
        let ownerKey = Identity.resolve options ctx |> Identity.ownerKey
        repository.Delete(id, ownerKey)
