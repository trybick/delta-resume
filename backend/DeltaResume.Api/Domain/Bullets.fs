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

    let toChanges (bullets: BulletLine list) (proposals: ProposedChange list) : BulletChange list =
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

        cappedBullets @ skillProposals
        |> List.map (fun proposal ->
            let original = bulletsByIndex[proposal.LineIndex]

            { Id = ChangeId(Guid.NewGuid())
              LineIndex = proposal.LineIndex
              Original = original
              Tailored = normalizeTailored original proposal.Tailored
              Kind = proposal.Kind
              Reason = proposal.Reason })
        |> List.sortBy (fun change -> change.LineIndex)
