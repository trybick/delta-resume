namespace ResumeTailor.Domain

open System
open System.Text.RegularExpressions

module Bullets =

    let private bulletPattern = Regex(@"^(\s*[-•*]\s+)(.*\S)\s*$", RegexOptions.Compiled)

    let isBulletLine (line: string) : bool =
        bulletPattern.IsMatch line

    let extract (resumeText: string) : BulletLine list =
        resumeText.Split('\n')
        |> Array.mapi (fun lineIndex line -> { LineIndex = lineIndex; Text = line })
        |> Array.filter (fun bullet -> isBulletLine bullet.Text)
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

    let toChanges (bullets: BulletLine list) (proposals: ProposedChange list) : BulletChange list =
        let bulletsByIndex =
            bullets
            |> List.map (fun bullet -> bullet.LineIndex, bullet.Text)
            |> Map.ofList

        validateProposals bullets proposals
        |> List.map (fun proposal ->
            let original = bulletsByIndex[proposal.LineIndex]

            { Id = ChangeId(Guid.NewGuid())
              LineIndex = proposal.LineIndex
              Original = original
              Tailored = normalizeTailored original proposal.Tailored
              Decision = Pending })
        |> List.sortBy (fun change -> change.LineIndex)
