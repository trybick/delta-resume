namespace DeltaResume.Application

open System
open System.Threading
open System.Threading.Tasks
open DeltaResume.Domain

type EngineProposal =
    { Summary: string
      Changes: ProposedChange list
      Requirements: JobRequirement list
      Document: ResumeDocument option }

type TailoringEngine =
    abstract member ProposeChanges:
        bullets: BulletLine list *
        jobDescription: string *
        existingDocument: ResumeDocument option *
        cancellationToken: CancellationToken ->
            Task<Result<EngineProposal, string>>

type CoverLetterDraft =
    { JobTitle: string
      CompanyName: string
      Letter: string }

type CoverLetterLength =
    | Short
    | Standard
    | Long

module CoverLetterLength =
    let toString (length: CoverLetterLength) : string =
        match length with
        | Short -> "short"
        | Standard -> "standard"
        | Long -> "long"

    let tryParse (value: string) : CoverLetterLength option =
        match value with
        | "short" -> Some Short
        | "standard" -> Some Standard
        | "long" -> Some Long
        | _ -> None

type CoverLetterTone =
    | Professional
    | Friendly
    | Enthusiastic
    | Formal

module CoverLetterTone =
    let toString (tone: CoverLetterTone) : string =
        match tone with
        | Professional -> "professional"
        | Friendly -> "friendly"
        | Enthusiastic -> "enthusiastic"
        | Formal -> "formal"

    let tryParse (value: string) : CoverLetterTone option =
        match value with
        | "professional" -> Some Professional
        | "friendly" -> Some Friendly
        | "enthusiastic" -> Some Enthusiastic
        | "formal" -> Some Formal
        | _ -> None

type CoverLetterSettings =
    { Length: CoverLetterLength
      Tone: CoverLetterTone }

type UserSettings =
    { CoverLetter: CoverLetterSettings }

module UserSettings =
    let defaults: UserSettings =
        { CoverLetter =
            { Length = Standard
              Tone = Professional } }

type UserSettingsRepository =
    abstract member Get: ownerKey: OwnerKey -> Task<UserSettings option>
    abstract member Upsert: ownerKey: OwnerKey * settings: UserSettings -> Task<unit>

type CoverLetterEngine =
    abstract member GenerateCoverLetter:
        resumeText: string *
        jobDescription: string *
        candidateName: string option *
        settings: CoverLetterSettings *
        cancellationToken: CancellationToken ->
            Task<Result<CoverLetterDraft, string>>

type CreditKind =
    | User
    | Fingerprint
    | Ip

module CreditKind =
    let toString (kind: CreditKind) : string =
        match kind with
        | User -> "user"
        | Fingerprint -> "fp"
        | Ip -> "ip"

type UsagePeriod =
    | Lifetime
    | Monthly of yearMonth: string

module UsagePeriod =
    let toString (period: UsagePeriod) : string =
        match period with
        | Lifetime -> "lifetime"
        | Monthly yearMonth -> yearMonth

    let currentMonth () : UsagePeriod =
        Monthly(DateTime.UtcNow.ToString "yyyy-MM")

type OperationId = OperationId of Guid

module OperationId =
    let create () = OperationId(Guid.NewGuid())

    let value (OperationId id) = id

type CreditUsageEntry =
    { IdentityKey: OwnerKey
      Kind: CreditKind
      Period: UsagePeriod
      Email: string option }

type CreditSpendResult =
    | SpendRecorded of OperationId
    | SpendExhausted

type CreditStore =
    abstract member CountUsage:
        identityKey: OwnerKey * period: UsagePeriod * cancellationToken: CancellationToken -> Task<int>

    abstract member TryRecordUsage:
        entries: CreditUsageEntry list * creditLimit: int * cancellationToken: CancellationToken ->
            Task<CreditSpendResult>

    abstract member DeleteUsageByOperation:
        operationId: OperationId * cancellationToken: CancellationToken -> Task<unit>

type SavedResumeRepository =
    abstract member ListByOwner: ownerKey: OwnerKey -> Task<SavedResume list>
    abstract member FindByHash: ownerKey: OwnerKey * contentHash: string -> Task<SavedResume option>
    abstract member Insert: resume: SavedResume -> Task<unit>
    abstract member UpdateDocument:
        id: SavedResumeId * ownerKey: OwnerKey * document: ResumeDocument option -> Task<unit>
    abstract member Rename: id: SavedResumeId * ownerKey: OwnerKey * name: string -> Task<bool>
    abstract member Delete: id: SavedResumeId * ownerKey: OwnerKey -> Task<bool>
    abstract member DeleteLeastRecentlyUsed: ownerKey: OwnerKey * keepCount: int -> Task<unit>
