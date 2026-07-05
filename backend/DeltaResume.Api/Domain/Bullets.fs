namespace DeltaResume.Domain

open System
open System.Text.RegularExpressions

module Bullets =

    let private bulletPattern =
        Regex(@"^(\s*(?:[-–—•‣◦▪▫·∙●○*+>]|\d{1,2}[.)])\s+)(.*\S)\s*$", RegexOptions.Compiled)

    let private sectionHeaderPattern =
        Regex(@"^\s*[A-Z][A-Z\s&/-]{1,40}:?\s*$", RegexOptions.Compiled)

    let private skillsHeaderKeywords =
        [| "SKILL"; "COMPETENC"; "TECHNOLOG"; "EXPERTISE"; "PROFICIENC"; "TECH STACK" |]

    /// Loose header shape: a short line of words (any casing) optionally ending with ":".
    let private headerShapePattern =
        Regex(@"^[A-Za-z][A-Za-z\s&/-]{0,40}:?$", RegexOptions.Compiled)

    let private normalizeHeader (line: string) : string =
        line.Trim().TrimEnd(':').Trim().ToUpperInvariant()

    let private knownSectionNames =
        set
            [ "SUMMARY"
              "PROFILE"
              "OBJECTIVE"
              "ABOUT"
              "ABOUT ME"
              "EXPERIENCE"
              "WORK EXPERIENCE"
              "PROFESSIONAL EXPERIENCE"
              "EMPLOYMENT"
              "EMPLOYMENT HISTORY"
              "EDUCATION"
              "PROJECT"
              "PROJECTS"
              "PERSONAL PROJECTS"
              "CERTIFICATION"
              "CERTIFICATIONS"
              "CERTIFICATES"
              "AWARDS"
              "HONORS"
              "PUBLICATIONS"
              "VOLUNTEER"
              "VOLUNTEERING"
              "INTERESTS"
              "REFERENCES"
              "ACTIVITIES"
              "LEADERSHIP" ]

    let private isSkillsHeaderLine (line: string) : bool =
        let trimmed = line.Trim()

        headerShapePattern.IsMatch trimmed
        && (let upper = normalizeHeader trimmed
            skillsHeaderKeywords |> Array.exists upper.Contains)

    /// A non-skills section header that ends the skills section. Matched by known section
    /// names in any casing (single short all-caps lines like "AWS" or "CI/CD" inside a
    /// skills list must not count as headers).
    let private isSkillsSectionEnd (line: string) : bool =
        let trimmed = line.Trim()

        headerShapePattern.IsMatch trimmed
        && Set.contains (normalizeHeader trimmed) knownSectionNames

    let isBulletLine (line: string) : bool =
        bulletPattern.IsMatch line

    let private isProseLine (line: string) : bool =
        let trimmed = line.Trim()
        let wordCount = trimmed.Split([| ' '; '\t' |], StringSplitOptions.RemoveEmptyEntries).Length

        wordCount >= 4
        && trimmed.Length >= 25
        && not (sectionHeaderPattern.IsMatch trimmed)
        && not (trimmed.Contains '@')

    /// Finds the lines belonging to a "Skills"-style section (e.g. "Skills", "TECHNICAL SKILLS",
    /// "Core Competencies"): everything after the header line up to the next known section header.
    let private findSkillsLines (allLines: BulletLine[]) : BulletLine list =
        allLines
        |> Array.tryFindIndex (fun line -> isSkillsHeaderLine line.Text)
        |> Option.map (fun headerIndex ->
            allLines
            |> Array.skip (headerIndex + 1)
            |> Array.takeWhile (fun line -> not (isSkillsSectionEnd line.Text))
            |> Array.filter (fun line -> not (String.IsNullOrWhiteSpace(line.Text.Trim())))
            |> Array.map (fun line -> { line with Kind = Skill })
            |> Array.toList)
        |> Option.defaultValue []

    let extract (resumeText: string) : BulletLine list =
        let allLines =
            resumeText.Split('\n')
            |> Array.mapi (fun lineIndex line -> { LineIndex = lineIndex; Text = line; Kind = Bullet })

        let skillsLines = findSkillsLines allLines
        let skillsIndexes = skillsLines |> List.map (fun line -> line.LineIndex) |> Set.ofList

        let candidateLines =
            allLines |> Array.filter (fun line -> not (Set.contains line.LineIndex skillsIndexes))

        let markedBullets =
            candidateLines |> Array.filter (fun bullet -> isBulletLine bullet.Text) |> Array.toList

        let bulletLines =
            if not (List.isEmpty markedBullets) then
                markedBullets
            else
                candidateLines
                |> Array.filter (fun bullet -> isProseLine bullet.Text)
                |> Array.toList

        bulletLines @ skillsLines |> List.sortBy (fun line -> line.LineIndex)

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
            |> List.map (fun bullet -> bullet.LineIndex, bullet)
            |> Map.ofList

        validateProposals bullets proposals
        |> List.map (fun proposal ->
            let originalLine = bulletsByIndex[proposal.LineIndex]

            { Id = ChangeId(Guid.NewGuid())
              LineIndex = proposal.LineIndex
              Original = originalLine.Text
              Tailored = normalizeTailored originalLine.Text proposal.Tailored
              Decision = Pending
              Kind = originalLine.Kind })
        |> List.sortBy (fun change -> change.LineIndex)
