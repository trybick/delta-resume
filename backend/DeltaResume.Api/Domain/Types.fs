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

[<RequireQualifiedAccess>]
type ResumeItemKind =
    | Paragraph
    | Bullet
    | Subheading

module ResumeItemKind =
    let toString (kind: ResumeItemKind) : string =
        match kind with
        | ResumeItemKind.Paragraph -> "paragraph"
        | ResumeItemKind.Bullet -> "bullet"
        | ResumeItemKind.Subheading -> "subheading"

    let tryParse (value: string) : ResumeItemKind option =
        match value with
        | "paragraph" -> Some ResumeItemKind.Paragraph
        | "bullet" -> Some ResumeItemKind.Bullet
        | "subheading" -> Some ResumeItemKind.Subheading
        | _ -> None

type ResumeItem =
    { Kind: ResumeItemKind
      Lines: int list }

type ResumeSection =
    { HeadingLine: int option
      Items: ResumeItem list }

type ResumeStructure =
    { HeaderLines: int list
      Sections: ResumeSection list }

module ResumeStructure =

    /// Keeps only line indexes that exist in the resume, dropping duplicates in
    /// document order. Returns None unless every known line ends up covered exactly
    /// once, so a partial structure can never silently drop resume content.
    let validate (validLineIndexes: Set<int>) (structure: ResumeStructure) : ResumeStructure option =
        let seen = System.Collections.Generic.HashSet<int>()

        let claim (lineIndex: int) : bool =
            validLineIndexes.Contains lineIndex && seen.Add lineIndex

        let headerLines = structure.HeaderLines |> List.filter claim

        let sections =
            structure.Sections
            |> List.map (fun section ->
                { HeadingLine = section.HeadingLine |> Option.filter claim
                  Items =
                    section.Items
                    |> List.map (fun item -> { item with Lines = item.Lines |> List.filter claim })
                    |> List.filter (fun item -> not (List.isEmpty item.Lines)) })
            |> List.filter (fun section -> section.HeadingLine.IsSome || not (List.isEmpty section.Items))

        if seen.Count = Set.count validLineIndexes && not (List.isEmpty sections) then
            Some
                { HeaderLines = headerLines
                  Sections = sections }
        else
            None

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
      Summary: string
      Changes: BulletChange list
      Structure: ResumeStructure option }

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
