namespace DeltaResume.Domain

open System
open System.Text.RegularExpressions

module Bullets =

    let private bulletPattern =
        Regex(@"^(\s*(?:[-–—•‣◦▪▫·∙●○*+>]|\d{1,2}[.)])\s+)(.*\S)\s*$", RegexOptions.Compiled)

    let isBulletLine (line: string) : bool =
        bulletPattern.IsMatch line

    /// Returns every non-blank line of the resume, indexed by its position in the
    /// original text. Classification of what is worth changing (and whether a change
    /// targets a bullet or a skills line) is delegated to the tailoring engine; the
    /// line index + exact-original-match validation below is what keeps it honest.
    let extract (resumeText: string) : BulletLine list =
        resumeText.Split('\n')
        |> Array.mapi (fun lineIndex line -> { LineIndex = lineIndex; Text = line })
        |> Array.filter (fun line -> not (String.IsNullOrWhiteSpace line.Text))
        |> Array.toList

    let private contentOf (line: string) : string =
        let markerMatch = bulletPattern.Match line
        if markerMatch.Success then markerMatch.Groups[2].Value.Trim() else line.Trim()

    let validateProposals (bullets: BulletLine list) (proposals: ProposedChange list) : ProposedChange list =
        let bulletsByIndex =
            bullets
            |> List.map (fun bullet -> bullet.LineIndex, bullet.Text)
            |> Map.ofList

        proposals
        |> List.filter (fun proposal ->
            match Map.tryFind proposal.LineIndex bulletsByIndex with
            | Some actualLine ->
                String.Equals(contentOf actualLine, contentOf proposal.Original, StringComparison.Ordinal)
                && not (String.IsNullOrWhiteSpace proposal.Tailored)
                && contentOf proposal.Tailored <> contentOf actualLine
            | None -> false)
        |> List.distinctBy (fun proposal -> proposal.LineIndex)

    let private normalizeTailored (original: string) (tailored: string) : string =
        if bulletPattern.IsMatch tailored then
            tailored
        else
            let markerMatch = bulletPattern.Match original
            if markerMatch.Success then
                markerMatch.Groups[1].Value + tailored.Trim()
            else
                tailored

    [<Literal>]
    let MaxBulletChanges = 4

    [<Literal>]
    let MaxParagraphChanges = 1

    let private sectionNames =
        set
            [ "summary"
              "profile"
              "objective"
              "about"
              "about me"
              "skills"
              "technical skills"
              "core competencies"
              "experience"
              "work experience"
              "professional experience"
              "employment history"
              "education"
              "projects"
              "certifications"
              "certificates"
              "awards"
              "publications"
              "volunteering"
              "volunteer experience"
              "languages"
              "interests" ]

    let private isHeadingLike (line: string) : bool =
        let trimmed = line.Trim()

        if trimmed.Length = 0 || trimmed.Length > 48 || isBulletLine trimmed then
            false
        else
            let withoutColon = trimmed.TrimEnd ':'

            sectionNames.Contains(withoutColon.ToLowerInvariant())
            || (trimmed |> Seq.exists Char.IsUpper
                && trimmed = trimmed.ToUpperInvariant()
                && not (trimmed.Contains ",")
                && withoutColon.Split([| ' ' |], StringSplitOptions.RemoveEmptyEntries).Length <= 3)

    let private itemContaining (structure: ResumeStructure option) (lineIndex: int) : ResumeItem option =
        structure
        |> Option.bind (fun resumeStructure ->
            resumeStructure.Sections
            |> List.collect (fun section -> section.Items)
            |> List.tryFind (fun item -> List.contains lineIndex item.Lines))

    /// Walks from the anchor in one direction, consuming physically adjacent lines
    /// (a missing index means a blank line, which ends the block) that read like
    /// wrapped continuations rather than new bullets or section headings.
    let private wrappedContinuationsFrom (bulletsByIndex: Map<int, string>) (anchor: int) (step: int) : int list =
        anchor
        |> List.unfold (fun index ->
            let next = index + step

            match Map.tryFind next bulletsByIndex with
            | Some text when not (isBulletLine text) && not (isHeadingLike text) -> Some(next, next)
            | _ -> None)

    /// Text extraction often hard-wraps one visual bullet or paragraph across several
    /// physical lines. A change must consume every line of the block it rewrites, or
    /// the resume is left showing the block's tail as untouched original text. The
    /// model's structure is the primary source for that grouping; paragraphs also get
    /// a contiguity fallback because the summary rewrite is the change most often
    /// affected and the model cannot be trusted to group or anchor it correctly.
    let private lineIndexesFor
        (structure: ResumeStructure option)
        (bulletsByIndex: Map<int, string>)
        (proposal: ProposedChange)
        : int list =
        match proposal.Kind with
        | Skill -> [ proposal.LineIndex ]
        | Bullet ->
            match itemContaining structure proposal.LineIndex with
            | Some item when item.Kind = ResumeItemKind.Bullet -> List.sort item.Lines
            | Some _ -> [ proposal.LineIndex ]
            | None ->
                proposal.LineIndex :: wrappedContinuationsFrom bulletsByIndex proposal.LineIndex 1
                |> List.sort
        | Paragraph ->
            let structureLines =
                itemContaining structure proposal.LineIndex
                |> Option.map (fun item -> item.Lines)
                |> Option.defaultValue []

            let contiguousLines =
                wrappedContinuationsFrom bulletsByIndex proposal.LineIndex -1
                @ (proposal.LineIndex :: wrappedContinuationsFrom bulletsByIndex proposal.LineIndex 1)

            structureLines @ contiguousLines |> List.distinct |> List.sort

    let toChanges
        (bullets: BulletLine list)
        (structure: ResumeStructure option)
        (proposals: ProposedChange list)
        : BulletChange list =
        let bulletsByIndex =
            bullets
            |> List.map (fun bullet -> bullet.LineIndex, bullet.Text)
            |> Map.ofList

        let validated = validateProposals bullets proposals

        // The engine is asked to list bullet changes most-relevant-first, so truncating
        // keeps the best ones when the model exceeds the limit anyway.
        let cappedBullets =
            validated
            |> List.filter (fun proposal -> proposal.Kind = Bullet)
            |> List.truncate MaxBulletChanges

        let skillProposals =
            validated |> List.filter (fun proposal -> proposal.Kind = Skill)

        let cappedParagraphs =
            validated
            |> List.filter (fun proposal -> proposal.Kind = Paragraph)
            |> List.truncate MaxParagraphChanges

        let _, changes =
            cappedBullets @ skillProposals @ cappedParagraphs
            |> List.fold
                (fun (consumed: Set<int>, changes) proposal ->
                    let lineIndexes = lineIndexesFor structure bulletsByIndex proposal

                    if lineIndexes |> List.exists consumed.Contains then
                        consumed, changes
                    else
                        let original =
                            match lineIndexes with
                            | [ single ] -> bulletsByIndex[single]
                            | _ ->
                                lineIndexes
                                |> List.choose (fun lineIndex -> Map.tryFind lineIndex bulletsByIndex)
                                |> List.map _.Trim()
                                |> String.concat " "

                        let change =
                            { Id = ChangeId(Guid.NewGuid())
                              LineIndex = List.min lineIndexes
                              LineIndexes = lineIndexes
                              Original = original
                              Tailored = normalizeTailored original proposal.Tailored
                              Kind = proposal.Kind }

                        Set.union consumed (Set.ofList lineIndexes), change :: changes)
                (Set.empty, [])

        changes |> List.sortBy (fun change -> change.LineIndex)
