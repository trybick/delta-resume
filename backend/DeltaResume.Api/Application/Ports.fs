namespace DeltaResume.Application

open System
open System.Threading.Tasks
open DeltaResume.Domain

type EngineProposal =
    { Summary: string
      Changes: ProposedChange list
      Structure: ResumeStructure option }

type TailoringEngine =
    abstract member ProposeChanges:
        bullets: BulletLine list * jobDescription: string -> Task<Result<EngineProposal, string>>

type CoverLetterDraft =
    { JobTitle: string
      CompanyName: string
      Letter: string }

type CoverLetterEngine =
    abstract member GenerateCoverLetter:
        resumeText: string * jobDescription: string * candidateName: string option ->
            Task<Result<CoverLetterDraft, string>>

type CreditUsageEntry =
    { IdentityKey: string
      Kind: string
      Period: string }

type CreditStore =
    abstract member CountUsage: identityKey: string * period: string -> Task<int>
    abstract member RecordUsage: entries: CreditUsageEntry list -> Task<unit>

type SavedResumeRepository =
    abstract member ListByOwner: ownerKey: string -> Task<SavedResume list>
    abstract member FindByHash: ownerKey: string * contentHash: string -> Task<SavedResume option>
    abstract member Insert: resume: SavedResume -> Task<unit>
    abstract member Rename: id: SavedResumeId * ownerKey: string * name: string -> Task<bool>
    abstract member Delete: id: SavedResumeId * ownerKey: string -> Task<bool>
    abstract member DeleteLeastRecentlyUsed: ownerKey: string * keepCount: int -> Task<unit>
