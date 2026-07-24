namespace DeltaResume.Domain

open System

type RunId = RunId of Guid

type ChangeId = ChangeId of Guid

type LineKind =
    | Bullet
    | Skill
    | Paragraph

module LineKind =
    let toString (kind: LineKind) : string =
        match kind with
        | Bullet -> "bullet"
        | Skill -> "skill"
        | Paragraph -> "paragraph"

    let tryParse (value: string) : LineKind option =
        match value with
        | "bullet" -> Some Bullet
        | "skill" -> Some Skill
        | "paragraph" -> Some Paragraph
        | _ -> None

type BulletLine =
    { LineIndex: int
      Text: string }

type ProposedChange =
    { LineIndex: int
      Original: string
      Tailored: string
      Kind: LineKind }

type ResumeNodeId = string

type ResumeSourceNode =
    { Id: ResumeNodeId
      SourceLines: int list }

type ResumeDateRange =
    { Start: string option
      End: string option
      Text: string option }

type ResumeHeader =
    { Name: ResumeSourceNode
      Contact: ResumeSourceNode list }

type ResumeBulletNode =
    { Id: ResumeNodeId
      SourceLines: int list }

type ResumeEntry =
    { Id: ResumeNodeId
      Title: string option
      Organization: string option
      Location: string option
      Dates: ResumeDateRange option
      HeadingSourceLines: int list
      Bullets: ResumeBulletNode list }

type ResumeSkillsGroup =
    { Id: ResumeNodeId
      Label: string option
      SourceLines: int list }

type ResumeParagraphNode =
    { Id: ResumeNodeId
      SourceLines: int list }

[<RequireQualifiedAccess>]
type ResumeBlock =
    | Entry of ResumeEntry
    | Paragraph of ResumeParagraphNode
    | SkillsGroup of ResumeSkillsGroup
    | Bullet of ResumeBulletNode

module ResumeBlock =
    let toKindString (block: ResumeBlock) : string =
        match block with
        | ResumeBlock.Entry _ -> "entry"
        | ResumeBlock.Paragraph _ -> "paragraph"
        | ResumeBlock.SkillsGroup _ -> "skillsGroup"
        | ResumeBlock.Bullet _ -> "bullet"

type ResumeSection =
    { Id: ResumeNodeId
      Kind: string
      Heading: ResumeSourceNode option
      Blocks: ResumeBlock list }

type ResumeDocument =
    { Version: int
      Header: ResumeHeader
      Sections: ResumeSection list }

module ResumeDocument =

    [<Literal>]
    let CurrentVersion = 1

    let private claimLines (seen: System.Collections.Generic.HashSet<int>) (valid: Set<int>) (lines: int list) =
        lines
        |> List.filter (fun lineIndex -> valid.Contains lineIndex && seen.Add lineIndex)

    let private allSourceLines (document: ResumeDocument) : int list =
        let fromNode (node: ResumeSourceNode) = node.SourceLines
        let fromBullet (bullet: ResumeBulletNode) = bullet.SourceLines

        let fromBlock =
            function
            | ResumeBlock.Entry entry -> entry.HeadingSourceLines @ (entry.Bullets |> List.collect fromBullet)
            | ResumeBlock.Paragraph paragraph -> paragraph.SourceLines
            | ResumeBlock.SkillsGroup group -> group.SourceLines
            | ResumeBlock.Bullet bullet -> bullet.SourceLines

        fromNode document.Header.Name
        @ (document.Header.Contact |> List.collect fromNode)
        @ (document.Sections
           |> List.collect (fun section ->
               (section.Heading |> Option.map fromNode |> Option.defaultValue [])
               @ (section.Blocks |> List.collect fromBlock)))

    let private collectIds (document: ResumeDocument) : string list =
        let fromBlock =
            function
            | ResumeBlock.Entry entry ->
                entry.Id :: (entry.Bullets |> List.map (fun bullet -> bullet.Id))
            | ResumeBlock.Paragraph paragraph -> [ paragraph.Id ]
            | ResumeBlock.SkillsGroup group -> [ group.Id ]
            | ResumeBlock.Bullet bullet -> [ bullet.Id ]

        document.Header.Name.Id
        :: (document.Header.Contact |> List.map (fun item -> item.Id))
        @ (document.Sections
           |> List.collect (fun section ->
               let headingId = section.Heading |> Option.map (fun node -> node.Id) |> Option.toList
               section.Id :: headingId @ (section.Blocks |> List.collect fromBlock)))

    /// Keeps only line indexes that exist in the resume, dropping duplicates in
    /// document order. Returns None unless every known line ends up covered exactly
    /// once, so a partial structure can never silently drop resume content.
    let validate (validLineIndexes: Set<int>) (document: ResumeDocument) : ResumeDocument option =
        let seen = System.Collections.Generic.HashSet<int>()

        let claim = claimLines seen validLineIndexes

        let nameLines = claim document.Header.Name.SourceLines

        if List.isEmpty nameLines then
            None
        else
            let contact =
                document.Header.Contact
                |> List.choose (fun item ->
                    let lines = claim item.SourceLines
                    if List.isEmpty lines then None else Some { item with SourceLines = lines })

            let sections =
                document.Sections
                |> List.choose (fun section ->
                    let heading =
                        section.Heading
                        |> Option.bind (fun node ->
                            let lines = claim node.SourceLines
                            if List.isEmpty lines then None else Some { node with SourceLines = lines })

                    let blocks =
                        section.Blocks
                        |> List.choose (fun block ->
                            match block with
                            | ResumeBlock.Entry entry ->
                                let headingLines = claim entry.HeadingSourceLines

                                let bullets =
                                    entry.Bullets
                                    |> List.choose (fun bullet ->
                                        let lines = claim bullet.SourceLines

                                        if List.isEmpty lines then
                                            None
                                        else
                                            Some { bullet with SourceLines = lines })

                                if List.isEmpty headingLines && List.isEmpty bullets then
                                    None
                                else
                                    Some(
                                        ResumeBlock.Entry
                                            { entry with
                                                HeadingSourceLines = headingLines
                                                Bullets = bullets }
                                    )
                            | ResumeBlock.Paragraph paragraph ->
                                let lines = claim paragraph.SourceLines

                                if List.isEmpty lines then
                                    None
                                else
                                    Some(ResumeBlock.Paragraph { paragraph with SourceLines = lines })
                            | ResumeBlock.SkillsGroup group ->
                                let lines = claim group.SourceLines

                                if List.isEmpty lines then
                                    None
                                else
                                    Some(ResumeBlock.SkillsGroup { group with SourceLines = lines })
                            | ResumeBlock.Bullet bullet ->
                                let lines = claim bullet.SourceLines

                                if List.isEmpty lines then
                                    None
                                else
                                    Some(ResumeBlock.Bullet { bullet with SourceLines = lines }))

                    if heading.IsNone && List.isEmpty blocks then
                        None
                    else
                        Some
                            { section with
                                Heading = heading
                                Blocks = blocks })

            let ids = collectIds { Version = CurrentVersion; Header = { Name = { document.Header.Name with SourceLines = nameLines }; Contact = contact }; Sections = sections }
            let uniqueIds = ids |> List.distinct

            if
                seen.Count = Set.count validLineIndexes
                && not (List.isEmpty sections)
                && uniqueIds.Length = ids.Length
            then
                Some
                    { Version = CurrentVersion
                      Header =
                        { Name = { document.Header.Name with SourceLines = nameLines }
                          Contact = contact }
                      Sections = sections }
            else
                None

    let findNodeSourceLines (document: ResumeDocument) (nodeId: ResumeNodeId) : int list option =
        let matches (id: string) (lines: int list) = if id = nodeId then Some lines else None

        let fromBlock =
            function
            | ResumeBlock.Entry entry ->
                matches entry.Id entry.HeadingSourceLines
                |> Option.orElseWith (fun () ->
                    entry.Bullets
                    |> List.tryPick (fun bullet -> matches bullet.Id bullet.SourceLines))
            | ResumeBlock.Paragraph paragraph -> matches paragraph.Id paragraph.SourceLines
            | ResumeBlock.SkillsGroup group -> matches group.Id group.SourceLines
            | ResumeBlock.Bullet bullet -> matches bullet.Id bullet.SourceLines

        matches document.Header.Name.Id document.Header.Name.SourceLines
        |> Option.orElseWith (fun () ->
            document.Header.Contact
            |> List.tryPick (fun item -> matches item.Id item.SourceLines))
        |> Option.orElseWith (fun () ->
            document.Sections
            |> List.tryPick (fun section ->
                matches section.Id []
                |> Option.orElseWith (fun () ->
                    section.Heading
                    |> Option.bind (fun heading -> matches heading.Id heading.SourceLines))
                |> Option.orElseWith (fun () -> section.Blocks |> List.tryPick fromBlock)))

    let tryFindNodeIdByLine (document: ResumeDocument) (lineIndex: int) : ResumeNodeId option =
        let containsLine (lines: int list) = List.contains lineIndex lines

        let fromBlock =
            function
            | ResumeBlock.Entry entry ->
                if containsLine entry.HeadingSourceLines then
                    Some entry.Id
                else
                    entry.Bullets
                    |> List.tryPick (fun bullet ->
                        if containsLine bullet.SourceLines then Some bullet.Id else None)
            | ResumeBlock.Paragraph paragraph ->
                if containsLine paragraph.SourceLines then Some paragraph.Id else None
            | ResumeBlock.SkillsGroup group ->
                if containsLine group.SourceLines then Some group.Id else None
            | ResumeBlock.Bullet bullet ->
                if containsLine bullet.SourceLines then Some bullet.Id else None

        if containsLine document.Header.Name.SourceLines then
            Some document.Header.Name.Id
        else
            document.Header.Contact
            |> List.tryPick (fun item -> if containsLine item.SourceLines then Some item.Id else None)
            |> Option.orElseWith (fun () ->
                document.Sections
                |> List.tryPick (fun section ->
                    section.Heading
                    |> Option.bind (fun heading ->
                        if containsLine heading.SourceLines then Some heading.Id else None)
                    |> Option.orElseWith (fun () -> section.Blocks |> List.tryPick fromBlock)))

    let sourceLinesCovered (document: ResumeDocument) = allSourceLines document

type BulletChange =
    { Id: ChangeId
      TargetId: ResumeNodeId
      /// Every resume line consumed by this change, in order.
      SourceLines: int list
      Original: string
      Tailored: string
      Kind: LineKind }

type RequirementImportance =
    | Must
    | Nice

module RequirementImportance =
    let toString (importance: RequirementImportance) : string =
        match importance with
        | Must -> "must"
        | Nice -> "nice"

    let tryParse (value: string) : RequirementImportance option =
        match value with
        | "must" -> Some Must
        | "nice" -> Some Nice
        | _ -> None

type JobRequirement =
    { Text: string
      Importance: RequirementImportance
      SatisfiedBy: ResumeNodeId list
      SatisfiedByChanges: ResumeNodeId list
      GapHint: string option
      DraftBullet: string option
      InsertAfterId: ResumeNodeId option }

type TailorRun =
    { Id: RunId
      ResumeText: string
      JobDescription: string
      CreatedAt: DateTimeOffset
      Summary: string
      Changes: BulletChange list
      Requirements: JobRequirement list
      Document: ResumeDocument option }

type SavedResumeId = SavedResumeId of Guid

type OwnerKey = private OwnerKey of string

module OwnerKey =
    let value (OwnerKey key) = key

    let forUser (userId: string) = OwnerKey(sprintf "user:%s" userId)

    let forFingerprint (fingerprint: string) = OwnerKey(sprintf "fp:%s" fingerprint)

    let forIpHash (ipHash: string) = OwnerKey(sprintf "ip:%s" ipHash)

    let ofPersisted (key: string) = OwnerKey key

type SavedResume =
    { Id: SavedResumeId
      OwnerKey: OwnerKey
      Name: string
      ResumeText: string
      ResumeDocument: ResumeDocument option
      ContentHash: string
      CreatedAt: DateTimeOffset }

type TailorError =
    | InvalidInput of message: string
    | EngineFailure of message: string
    | NotFound of message: string
