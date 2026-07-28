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
    | Cycle of label: string

module UsagePeriod =
    let toString (period: UsagePeriod) : string =
        match period with
        | Lifetime -> "lifetime"
        | Cycle label -> label

    /// Fallback when we have no real billing anchor (e.g. Clerk billing lookup
    /// failed). Resets on the 1st of the calendar month rather than the user's
    /// actual signup/subscription day.
    let currentCalendarMonth () : UsagePeriod =
        Cycle("calendar:" + DateTime.UtcNow.ToString "yyyy-MM")

    /// A subscription's current billing period start, as reported by Clerk. Clerk
    /// itself advances this value at renewal, so using it directly (rather than
    /// recomputing month boundaries) keeps credit resets in sync with real billing.
    let ofSubscriptionPeriodStart (periodStart: DateTimeOffset) : UsagePeriod =
        Cycle("sub:" + periodStart.ToString "yyyy-MM-ddTHH:mm:ssZ")

    /// For pro access without a real subscription (e.g. lifetime-free grants),
    /// anchor the monthly reset to the day-of-month the user signed up on -
    /// e.g. signing up Jan 15th resets credits on the 15th of every month -
    /// instead of resetting on the 1st of the calendar month.
    let ofSignupAnchor (signedUpAt: DateTimeOffset) : UsagePeriod =
        let now = DateTimeOffset.UtcNow
        let monthsElapsed = (now.Year - signedUpAt.Year) * 12 + (now.Month - signedUpAt.Month)
        let candidateStart = signedUpAt.AddMonths monthsElapsed

        let cycleStart =
            if candidateStart > now then
                signedUpAt.AddMonths(monthsElapsed - 1)
            else
                candidateStart

        Cycle("anchor:" + cycleStart.ToString "yyyy-MM-ddTHH:mm:ssZ")

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
