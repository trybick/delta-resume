namespace DeltaResume.Application

open System
open System.Threading
open System.Threading.Tasks
open DeltaResume.Domain

type EngineProposal =
    { Summary: string
      Changes: ProposedChange list
      Requirements: JobRequirement list
      Structure: ResumeStructure option }

type TailoringEngine =
    abstract member ProposeChanges:
        bullets: BulletLine list * jobDescription: string * cancellationToken: CancellationToken ->
            Task<Result<EngineProposal, string>>

type CoverLetterDraft =
    { JobTitle: string
      CompanyName: string
      Letter: string }

type CoverLetterSettings =
    { Length: string
      Tone: string }

type UserSettings =
    { CoverLetter: CoverLetterSettings }

module UserSettings =
    let allowedLengths = [ "short"; "standard"; "long" ]

    let allowedTones = [ "professional"; "friendly"; "enthusiastic"; "formal" ]

    let defaults: UserSettings =
        { CoverLetter =
            { Length = "standard"
              Tone = "professional" } }

type UserSettingsRepository =
    abstract member Get: ownerKey: string -> Task<UserSettings option>
    abstract member Upsert: ownerKey: string * settings: UserSettings -> Task<unit>

type CoverLetterEngine =
    abstract member GenerateCoverLetter:
        resumeText: string *
        jobDescription: string *
        candidateName: string option *
        settings: CoverLetterSettings *
        cancellationToken: CancellationToken ->
            Task<Result<CoverLetterDraft, string>>

type CreditUsageEntry =
    { IdentityKey: string
      Kind: string
      Period: string }

type CreditSpendResult =
    | SpendRecorded of operationId: string
    | SpendExhausted

type CreditStore =
    abstract member CountUsage:
        identityKey: string * period: string * cancellationToken: CancellationToken -> Task<int>

    abstract member TryRecordUsage:
        entries: CreditUsageEntry list * creditLimit: int * cancellationToken: CancellationToken ->
            Task<CreditSpendResult>

    abstract member DeleteUsageByOperation:
        operationId: string * cancellationToken: CancellationToken -> Task<unit>

type SavedResumeRepository =
    abstract member ListByOwner: ownerKey: string -> Task<SavedResume list>
    abstract member FindByHash: ownerKey: string * contentHash: string -> Task<SavedResume option>
    abstract member Insert: resume: SavedResume -> Task<unit>
    abstract member Rename: id: SavedResumeId * ownerKey: string * name: string -> Task<bool>
    abstract member Delete: id: SavedResumeId * ownerKey: string -> Task<bool>
    abstract member DeleteLeastRecentlyUsed: ownerKey: string * keepCount: int -> Task<unit>
