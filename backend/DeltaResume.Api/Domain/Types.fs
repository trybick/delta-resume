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

type LineKind =
    | Bullet
    | Skill

module LineKind =
    let toString (kind: LineKind) : string =
        match kind with
        | Bullet -> "bullet"
        | Skill -> "skill"

type BulletLine =
    { LineIndex: int
      Text: string
      Kind: LineKind }

type ProposedChange =
    { LineIndex: int
      Original: string
      Tailored: string
      Kind: LineKind }

type BulletChange =
    { Id: ChangeId
      LineIndex: int
      Original: string
      Tailored: string
      Decision: Decision
      Kind: LineKind }

type TailorRun =
    { Id: RunId
      ResumeText: string
      JobDescription: string
      CreatedAt: DateTimeOffset
      Changes: BulletChange list }

type SavedResumeId = SavedResumeId of Guid

type SavedResume =
    { Id: SavedResumeId
      OwnerKey: string
      Name: string
      ResumeText: string
      ContentHash: string
      CreatedAt: DateTimeOffset }

type TailorError =
    | InvalidInput of message: string
    | EngineFailure of message: string
    | NotFound of message: string
