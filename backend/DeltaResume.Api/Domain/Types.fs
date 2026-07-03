namespace DeltaResume.Domain

open System

type RunId = RunId of Guid

type ChangeId = ChangeId of Guid

type Decision =
    | Pending
    | Accepted
    | Rejected

module Decision =
    let toString (decision: Decision) : string =
        match decision with
        | Pending -> "pending"
        | Accepted -> "accepted"
        | Rejected -> "rejected"

    let tryParse (value: string) : Decision option =
        match value with
        | "pending" -> Some Pending
        | "accepted" -> Some Accepted
        | "rejected" -> Some Rejected
        | _ -> None

type BulletLine =
    { LineIndex: int
      Text: string }

type ProposedChange =
    { LineIndex: int
      Original: string
      Tailored: string }

type BulletChange =
    { Id: ChangeId
      LineIndex: int
      Original: string
      Tailored: string
      Decision: Decision }

type TailorRun =
    { Id: RunId
      ResumeText: string
      JobDescription: string
      CreatedAt: DateTimeOffset
      Changes: BulletChange list }

type TailorError =
    | InvalidInput of message: string
    | EngineFailure of message: string
    | NotFound of message: string
