namespace DeltaResume.Application

open System.Threading.Tasks
open DeltaResume.Domain

type TailoringEngine =
    abstract member ProposeChanges:
        bullets: BulletLine list * jobDescription: string -> Task<Result<ProposedChange list, string>>

type TailorRunRepository =
    abstract member SaveRun: run: TailorRun -> Task<unit>
    abstract member UpdateDecision: changeId: ChangeId * decision: Decision -> Task<bool>

type CreditUsageEntry =
    { IdentityKey: string
      Kind: string
      Period: string }

type CreditStore =
    abstract member CountUsage: identityKey: string * period: string -> Task<int>
    abstract member RecordUsage: entries: CreditUsageEntry list -> Task<unit>
