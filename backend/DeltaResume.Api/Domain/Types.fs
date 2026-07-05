namespace DeltaResume.Domain

open System

type RunId = RunId of Guid

type ChangeId = ChangeId of Guid

type LineKind =
    | Bullet
    | Skill

module LineKind =
    let toString (kind: LineKind) : string =
        match kind with
        | Bullet -> "bullet"
        | Skill -> "skill"

    let tryParse (value: string) : LineKind option =
        match value with
        | "bullet" -> Some Bullet
        | "skill" -> Some Skill
        | _ -> None

type BulletLine =
    { LineIndex: int
      Text: string }

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
