namespace ResumeTailor.Application

open System.Threading.Tasks
open ResumeTailor.Domain

type TailoringEngine =
    abstract member ProposeChanges:
        bullets: BulletLine list * jobDescription: string -> Task<Result<ProposedChange list, string>>

type TailorRunRepository =
    abstract member SaveRun: run: TailorRun -> Task<unit>
    abstract member UpdateDecision: changeId: ChangeId * decision: Decision -> Task<bool>
