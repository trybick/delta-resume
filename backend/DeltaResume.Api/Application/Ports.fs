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

type CoverLetterEngine =
    abstract member GenerateCoverLetter:
        resumeText: string *
        jobDescription: string *
        candidateName: string option *
        cancellationToken: CancellationToken ->
            Task<Result<CoverLetterDraft, string>>

type CreditUsageEntry =
    { IdentityKey: string
      Kind: string
      Period: string }

type CreditSpendResult =
    | SpendRecorded
    | SpendDuplicate
    | SpendConflict
    | SpendExhausted

type CreditStore =
    abstract member CountUsage:
        identityKey: string * period: string * cancellationToken: CancellationToken -> Task<int>

    abstract member TryRecordUsage:
        entries: CreditUsageEntry list *
        ownerKey: string *
        creditLimit: int *
        idempotencyKey: string *
        requestHash: string *
        cancellationToken: CancellationToken ->
            Task<CreditSpendResult>

type SavedResumeRepository =
    abstract member ListByOwner: ownerKey: string -> Task<SavedResume list>
    abstract member FindByHash: ownerKey: string * contentHash: string -> Task<SavedResume option>
    abstract member Insert: resume: SavedResume -> Task<unit>
    abstract member Rename: id: SavedResumeId * ownerKey: string * name: string -> Task<bool>
    abstract member Delete: id: SavedResumeId * ownerKey: string -> Task<bool>
    abstract member DeleteLeastRecentlyUsed: ownerKey: string * keepCount: int -> Task<unit>
