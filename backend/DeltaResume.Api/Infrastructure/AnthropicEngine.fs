namespace DeltaResume.Infrastructure

open System
open System.Net.Http
open System.Net.Http.Headers
open System.Text
open System.Text.Json
open System.Threading
open System.Threading.Tasks
open DeltaResume.Application
open DeltaResume.Domain

type AnthropicEngine(httpClient: HttpClient) =

    let model = "claude-sonnet-4-6"

    let apiKey =
        Environment.GetEnvironmentVariable "ANTHROPIC_API_KEY"
        |> Option.ofObj
        |> Option.filter (fun key -> not (String.IsNullOrWhiteSpace key))

    let jsonOptions = JsonSerializerOptions(PropertyNameCaseInsensitive = true)

    let assistantPrefill = """{"changes":["""

    // Shared identity, rewrite, summary, and requirements rules. Sent as its own
    // cached system block so both modes hit the same prompt cache prefix.
    let systemPromptCore =
        """You are Delta Resume, a resume tailoring assistant. You are given a complete resume, one line per lineIndex, inside <resume_lines>, and a job description inside <job_description>. You rewrite specific resume lines so they better match the job description's language, keywords, and priorities.

You may change exactly three kinds of lines, and you must classify each change:
- "bullet": an experience or project bullet/sentence describing what the person did.
- "skill": a line in a skills-type section (skills, technologies, tools, competencies). Skills sections come in many formats: comma or pipe separated lists, "Category: item, item" lines, one skill per line under category labels, etc.
- "paragraph": the resume's summary/objective/profile paragraph near the top of the resume.

Never change any other kind of line: names, contact info, links, section headers, job titles, company names, dates, education entries, or category labels (e.g. a line that is just "Frontend:"). If unsure whether a line is safe to change, leave it alone.

Rules for bullet changes:
- Rewrite only the bullets most relevant to the job description. Your response must contain AT MOST 4 bullet changes; if more than 4 bullets seem relevant, pick only the 4 where a rewrite adds the most value. List bullet changes in order of relevance, most relevant first.
- Do not rewrite a bullet that already matches the job description well.
- Never invent metrics, technologies, or responsibilities. Never add keywords the original bullet does not support.
- Length is a hard constraint: each rewritten bullet must stay within about 20% of the original bullet's word count. Prefer swapping or tightening words over adding new clauses, and never stack multiple new qualifiers onto one bullet. If you cannot improve fit without growing the bullet past that limit, skip the change.
- If a bullet's text was hard-wrapped across multiple lines in <resume_lines> (or, when a <resume_document> is supplied, spans multiple sourceLines of one bullet), treat all of those lines as ONE bullet: use the FIRST line's lineIndex for the change, write "tailored" as the complete rewritten bullet on a single line. Never anchor a change to a continuation line, and never rewrite only part of a hard-wrapped bullet.
- If a line starts with a bullet marker, preserve that exact marker and leading indentation; if it does not, keep it as plain text with the same indentation.

Rules for skill changes:
- The ONLY allowed skill change is adding a missing skill to an existing skills list line. Never reorder or remove existing skills; keep every skills line's existing items in their original order.
- You may add a skill ONLY if both are true: (1) it is clearly evidenced elsewhere in the resume, and (2) it is relevant to the job description. Never invent a skill with no supporting evidence.
- Append the added skill to the most fitting category's list line, preserving that line's label/prefix and separator style exactly. Never add a skill as a new line.
- If no evidenced, relevant skill is missing, make no skill changes at all.

Rules for paragraph changes:
- Only the summary/objective/profile paragraph qualifies. Never treat any other prose as a "paragraph" change.
- You may make AT MOST 1 paragraph change. If text extraction hard-wrapped the paragraph across multiple lines, treat all of those lines as ONE paragraph: use the FIRST line's lineIndex for the change, write "tailored" as the complete rewritten paragraph on a single line. Never anchor a paragraph change to a middle line, and never rewrite only part of a hard-wrapped paragraph.
- Rewrite the paragraph to foreground the experience, strengths, and keywords most relevant to the job description, reusing the job description's language where the resume genuinely supports it.
- Keep the rewrite grounded in the rest of the resume: never claim experience, seniority, technologies, or metrics the resume does not show.
- Length is a hard constraint: the tailored paragraph must stay within about 10% of the original word count; never expand it into a longer profile. Prefer swapping or tightening words over adding new clauses. If you cannot improve fit without growing the paragraph, skip the change.
- Skip the change if the existing paragraph already matches the job description well.

General rules:
- Keep every rewrite truthful to the original meaning.
- Never use em dashes (—) or en dashes (–) anywhere in any rewritten text. Use a comma, a period, or a colon instead. Also rewrite them away if the original line contained one.
- Write like a person, not like AI. Avoid AI-flavored vocabulary such as "leverage", "spearheaded", "utilize", "seamless", "robust", "cutting-edge", "delve", "foster", "streamline", and "synergy" unless the original line already used the word. Prefer plain, concrete verbs (built, led, cut, shipped, ran).
- Do not force the "verb X, achieving Y" or "X, resulting in Y" template onto every bullet; vary sentence shapes and keep the resume's existing voice.
- Prefer the job description's own wording when the original meaning supports it.
- Do not invent employers, titles, degrees, or dates.
- Leave lines you are not rewriting out of "changes".

After the changes, you must return a "summary" of exactly 1-2 concise sentences. Explain what the job description emphasizes and the overall approach taken in the suggested changes. Mention concrete priorities, skills, or themes from the job description and the corresponding resume content that was strengthened. Do not list or explain changes individually.

You must also return "requirements": the most important requirements from the job description and how the resume covers them.

Requirements rules:
- Extract 8-12 of the job description's most important requirements: specific skills, technologies, experience areas, and responsibilities. Phrase each in under 12 words. Skip generic filler like "team player" or "strong communication" unless the job clearly centers on it.
- "importance": "must" for core or required qualifications, "nice" for preferred or bonus ones.
- "satisfiedBy": lineIndexes of resume lines that genuinely demonstrate the requirement. A requirement is satisfied when the experience exists even if it is worded differently from the job description (e.g. "built SPAs with Next.js" satisfies "React experience"). Use an empty array only when the resume does not demonstrate it at all.
- "satisfiedByChanges": lineIndexes of your "changes" whose tailored text newly demonstrates a requirement the original line did not clearly show. Usually an empty array.
- "gapHint": for requirements where both arrays are empty, one short sentence naming where in the resume a bullet about it would fit (e.g. "Would fit under your Acme Corp role"). Never suggest inventing experience. Use null when the requirement is satisfied.
- "draftBullet": for requirements where both arrays are empty, a template bullet the candidate could add IF they have this experience. Write it in the same style, tense, and voice as the resume's existing bullets, and start it with the same bullet marker and indentation the resume's bullets use (or no marker if they use none). Because the resume shows no evidence for this requirement, you must NOT assert specifics as fact: put every unverifiable specific (metrics, scale, tools beyond the requirement itself, project names) in square brackets as placeholders the candidate fills in, e.g. "- Provisioned [cloud environment] infrastructure with Terraform, cutting setup time by [X%]". Use null when the requirement is satisfied.
- "insertAfterLine": for requirements with a "draftBullet", the lineIndex of the existing resume line the new bullet should be inserted directly after -- typically the last bullet of the role or section named in "gapHint". Must be a lineIndex that exists in <resume_lines>. Use null when the requirement is satisfied."""

    // First tailor (no saved typed document yet): Claude both rewrites and extracts
    // structure into "document", which we persist so later runs can skip extraction.
    let extractModeInstructions =
        """You must also return the resume's typed document as "document", so the app can rebuild a cleanly formatted file. Reference lines ONLY by lineIndex in "sourceLines"; never repeat line text. Do not invent ids.
When a hard-wrapped bullet or paragraph spans multiple lines, put every one of those lineIndexes in one block in "document"; never split one bullet or paragraph across blocks.

Document rules:
- "header":
  - "name": { "sourceLines": [lineIndex of the candidate name] }
  - "contact": array of { "sourceLines": [...] } for each remaining header/contact/link line, in order.
- "sections": remaining content in document order. Each section:
  - "kind": one of "summary", "skills", "experience", "education", "projects", "other"
  - "heading": { "sourceLines": [heading lineIndex] } or null if the section has no heading
  - "blocks": ordered content blocks. Each block has "kind" and "sourceLines" (or nested bullets):
    - "paragraph": one prose paragraph. Hard-wrapped lines belong in one block.
    - "bullet": a standalone bullet not under an entry. Hard-wrapped lines belong in one block.
    - "skillsGroup": a skills category/list line. Optional "label" when the line starts with a category label (e.g. "Languages").
    - "entry": a role/project/degree block with optional typed fields:
      - "title", "organization", "location": strings or null when unknown
      - "dates": { "start", "end", "text" } or null. "text" is the date range as written; "end" may be "Present".
      - "headingSourceLines": lineIndexes of the title/company/date line(s)
      - "bullets": array of { "sourceLines": [...] }, one per bullet under the entry. A hard-wrapped bullet's lines all belong to that one bullet's "sourceLines"
- Typed fields are optional: omit or null any field you cannot confidently extract. Never invent title/company/dates.
- Every lineIndex in <resume_lines> must appear exactly once across header and section sourceLines. Never drop or duplicate a lineIndex.

Respond with ONLY a JSON object in exactly this shape, no prose, no code fences:
{"changes":[{"lineIndex":0,"kind":"bullet","tailored":"<the rewritten line>"}],"summary":"<1-2 sentences>","requirements":[{"text":"<short requirement>","importance":"must","satisfiedBy":[4],"satisfiedByChanges":[],"gapHint":null,"draftBullet":null,"insertAfterLine":null}],"document":{"header":{"name":{"sourceLines":[0]},"contact":[{"sourceLines":[1]}]},"sections":[{"kind":"experience","heading":{"sourceLines":[2]},"blocks":[{"kind":"entry","title":"Engineer","organization":"Acme","location":null,"dates":{"start":"2021","end":"Present","text":"2021 - Present"},"headingSourceLines":[3],"bullets":[{"sourceLines":[4]}]}]}]}}"""

    // Subsequent tailor: a validated typed document is already supplied in
    // <resume_document>, so Claude only rewrites and covers requirements. Skipping
    // re-extraction keeps node ids and layout stable across runs.
    let reuseModeInstructions =
        """A validated typed document is also supplied inside <resume_document>. It already describes the resume's structure; do NOT return a "document" field. Only return changes, summary, and requirements.

Respond with ONLY a JSON object in exactly this shape, no prose, no code fences:
{"changes":[{"lineIndex":0,"kind":"bullet","tailored":"<the rewritten line>"}],"summary":"<1-2 sentences>","requirements":[{"text":"<short requirement>","importance":"must","satisfiedBy":[4],"satisfiedByChanges":[],"gapHint":null,"draftBullet":null,"insertAfterLine":null}]}"""

    let buildResumeContent (bullets: BulletLine list) : string =
        let resumeLines =
            bullets
            |> List.map (fun line -> sprintf "lineIndex %d: %s" line.LineIndex line.Text)
            |> String.concat "\n"

        sprintf "<resume_lines>\n%s\n</resume_lines>" resumeLines

    let buildJobDescriptionContent (jobDescription: string) : string =
        sprintf "<job_description>\n%s\n</job_description>" jobDescription

    let stripCodeFences (text: string) : string =
        let trimmed = text.Trim()

        if trimmed.StartsWith "```" then
            let withoutFirst =
                match trimmed.IndexOf '\n' with
                | -1 -> trimmed
                | newlineIndex -> trimmed.Substring(newlineIndex + 1)

            match withoutFirst.LastIndexOf "```" with
            | -1 -> withoutFirst.Trim()
            | fenceIndex -> withoutFirst.Substring(0, fenceIndex).Trim()
        else
            trimmed

    let parseIntList (element: JsonElement) : int list =
        if element.ValueKind = JsonValueKind.Array then
            element.EnumerateArray()
            |> Seq.choose (fun value ->
                if value.ValueKind = JsonValueKind.Number then
                    Some(value.GetInt32())
                else
                    None)
            |> Seq.toList
        else
            []

    let tryGetString (element: JsonElement) (name: string) : string option =
        match element.TryGetProperty name with
        | true, value when value.ValueKind = JsonValueKind.String ->
            value.GetString()
            |> Option.ofObj
            |> Option.map _.Trim()
            |> Option.filter (fun text -> not (String.IsNullOrWhiteSpace text))
        | _ -> None

    let parseSourceLines (element: JsonElement) : int list =
        match element.TryGetProperty "sourceLines" with
        | true, linesElement -> parseIntList linesElement
        | false, _ -> []

    let parseOptionalSourceNode (element: JsonElement) (name: string) (id: string) : ResumeSourceNode option =
        match element.TryGetProperty name with
        | true, nodeElement when nodeElement.ValueKind = JsonValueKind.Object ->
            let lines = parseSourceLines nodeElement
            if List.isEmpty lines then None else Some { Id = id; SourceLines = lines }
        | _ -> None

    let parseDateRange (element: JsonElement) : ResumeDateRange option =
        match element.TryGetProperty "dates" with
        | true, datesElement when datesElement.ValueKind = JsonValueKind.Object ->
            let start = tryGetString datesElement "start"
            let endDate = tryGetString datesElement "end"
            let text = tryGetString datesElement "text"

            if start.IsNone && endDate.IsNone && text.IsNone then
                None
            else
                Some { Start = start; End = endDate; Text = text }
        | _ -> None

    let parseDocument (bullets: BulletLine list) (root: JsonElement) : ResumeDocument option =
        match root.TryGetProperty "document" with
        | false, _ -> None
        | true, documentElement when documentElement.ValueKind <> JsonValueKind.Object -> None
        | true, documentElement ->
            match documentElement.TryGetProperty "header" with
            | false, _ -> None
            | true, headerElement when headerElement.ValueKind <> JsonValueKind.Object -> None
            | true, headerElement ->
                match parseOptionalSourceNode headerElement "name" "h.name" with
                | None -> None
                | Some nameNode ->
                    let contact: ResumeSourceNode list =
                        match headerElement.TryGetProperty "contact" with
                        | true, contactElement when contactElement.ValueKind = JsonValueKind.Array ->
                            contactElement.EnumerateArray()
                            |> Seq.mapi (fun index item ->
                                if item.ValueKind <> JsonValueKind.Object then
                                    None
                                else
                                    let lines = parseSourceLines item

                                    if List.isEmpty lines then
                                        None
                                    else
                                        Some
                                            ({ Id = sprintf "h.contact.%d" index
                                               SourceLines = lines }
                                            : ResumeSourceNode))
                            |> Seq.choose id
                            |> Seq.toList
                        | _ -> []

                    let sections =
                        match documentElement.TryGetProperty "sections" with
                        | true, sectionsElement when sectionsElement.ValueKind = JsonValueKind.Array ->
                            sectionsElement.EnumerateArray()
                            |> Seq.mapi (fun sectionIndex sectionElement ->
                                if sectionElement.ValueKind <> JsonValueKind.Object then
                                    None
                                else
                                    let sectionId = sprintf "s.%d" sectionIndex

                                    let kind =
                                        tryGetString sectionElement "kind"
                                        |> Option.defaultValue "other"

                                    let heading =
                                        parseOptionalSourceNode
                                            sectionElement
                                            "heading"
                                            (sprintf "%s.heading" sectionId)

                                    let blocks =
                                        match sectionElement.TryGetProperty "blocks" with
                                        | true, blocksElement when blocksElement.ValueKind = JsonValueKind.Array ->
                                            blocksElement.EnumerateArray()
                                            |> Seq.mapi (fun blockIndex blockElement ->
                                                if blockElement.ValueKind <> JsonValueKind.Object then
                                                    None
                                                else
                                                    let blockKind =
                                                        tryGetString blockElement "kind"
                                                        |> Option.defaultValue "paragraph"

                                                    let blockId = sprintf "%s.b.%d" sectionId blockIndex

                                                    match blockKind with
                                                    | "entry" ->
                                                        let headingLines =
                                                            match blockElement.TryGetProperty "headingSourceLines" with
                                                            | true, linesElement -> parseIntList linesElement
                                                            | false, _ -> parseSourceLines blockElement

                                                        let entryBullets: ResumeBulletNode list =
                                                            match blockElement.TryGetProperty "bullets" with
                                                            | true, bulletsElement when
                                                                bulletsElement.ValueKind = JsonValueKind.Array
                                                                ->
                                                                bulletsElement.EnumerateArray()
                                                                |> Seq.mapi (fun bulletIndex bulletElement ->
                                                                    if bulletElement.ValueKind <> JsonValueKind.Object then
                                                                        None
                                                                    else
                                                                        let lines = parseSourceLines bulletElement

                                                                        if List.isEmpty lines then
                                                                            None
                                                                        else
                                                                            Some
                                                                                ({ Id =
                                                                                    sprintf "%s.bullet.%d" blockId bulletIndex
                                                                                   SourceLines = lines }
                                                                                : ResumeBulletNode))
                                                                |> Seq.choose id
                                                                |> Seq.toList
                                                            | _ -> []

                                                        Some(
                                                            ResumeBlock.Entry
                                                                { Id = blockId
                                                                  Title = tryGetString blockElement "title"
                                                                  Organization = tryGetString blockElement "organization"
                                                                  Location = tryGetString blockElement "location"
                                                                  Dates = parseDateRange blockElement
                                                                  HeadingSourceLines = headingLines
                                                                  Bullets = entryBullets }
                                                        )
                                                    | "skillsGroup" ->
                                                        let lines = parseSourceLines blockElement

                                                        if List.isEmpty lines then
                                                            None
                                                        else
                                                            Some(
                                                                ResumeBlock.SkillsGroup
                                                                    ({ Id = blockId
                                                                       Label = tryGetString blockElement "label"
                                                                       SourceLines = lines }
                                                                    : ResumeSkillsGroup)
                                                            )
                                                    | "bullet" ->
                                                        let lines = parseSourceLines blockElement

                                                        if List.isEmpty lines then
                                                            None
                                                        else
                                                            Some(
                                                                ResumeBlock.Bullet
                                                                    ({ Id = blockId
                                                                       SourceLines = lines }
                                                                    : ResumeBulletNode)
                                                            )
                                                    | _ ->
                                                        let lines = parseSourceLines blockElement

                                                        if List.isEmpty lines then
                                                            None
                                                        else
                                                            Some(
                                                                ResumeBlock.Paragraph
                                                                    ({ Id = blockId
                                                                       SourceLines = lines }
                                                                    : ResumeParagraphNode)
                                                            ))
                                            |> Seq.choose id
                                            |> Seq.toList
                                        | _ -> []

                                    Some
                                        ({ Id = sectionId
                                           Kind = kind
                                           Heading = heading
                                           Blocks = blocks }
                                        : ResumeSection))
                            |> Seq.choose id
                            |> Seq.toList
                        | _ -> []

                    let validLineIndexes =
                        bullets |> List.map (fun bullet -> bullet.LineIndex) |> Set.ofList

                    ResumeDocument.validate
                        validLineIndexes
                        { Version = ResumeDocument.CurrentVersion
                          Header =
                            { Name = nameNode
                              Contact = contact }
                          Sections = sections }

    /// When a line maps to no typed node (or no document exists at all), fall back
    /// to a positional "line.N" id so requirement coverage and gap anchors keep
    /// working in degraded mode. Bullets.toChanges uses the same fallback shape.
    let mapLineIndexesToNodeIds (document: ResumeDocument option) (lineIndexes: int list) : ResumeNodeId list =
        lineIndexes
        |> List.map (fun lineIndex ->
            document
            |> Option.bind (fun doc -> ResumeDocument.tryFindNodeIdByLine doc lineIndex)
            |> Option.defaultValue (sprintf "line.%d" lineIndex))
        |> List.distinct

    let parseRequirements
        (bullets: BulletLine list)
        (document: ResumeDocument option)
        (root: JsonElement)
        : JobRequirement list =
        match root.TryGetProperty "requirements" with
        | true, requirementsElement when requirementsElement.ValueKind = JsonValueKind.Array ->
            let validLineIndexes =
                bullets |> List.map (fun bullet -> bullet.LineIndex) |> Set.ofList

            requirementsElement.EnumerateArray()
            |> Seq.filter (fun element -> element.ValueKind = JsonValueKind.Object)
            |> Seq.choose (fun element ->
                match element.TryGetProperty "text" with
                | true, textElement when textElement.ValueKind = JsonValueKind.String ->
                    textElement.GetString()
                    |> Option.ofObj
                    |> Option.map _.Trim()
                    |> Option.filter (fun text -> not (String.IsNullOrWhiteSpace text))
                    |> Option.map (fun text ->
                        let importance =
                            match element.TryGetProperty "importance" with
                            | true, importanceElement when importanceElement.ValueKind = JsonValueKind.String ->
                                importanceElement.GetString()
                                |> RequirementImportance.tryParse
                                |> Option.defaultValue Must
                            | _ -> Must

                        let parseLineIndexes (propertyName: string) : int list =
                            match element.TryGetProperty propertyName with
                            | true, linesElement ->
                                parseIntList linesElement |> List.filter validLineIndexes.Contains
                            | false, _ -> []

                        let parseTrimmedString (propertyName: string) : string option =
                            match element.TryGetProperty propertyName with
                            | true, stringElement when stringElement.ValueKind = JsonValueKind.String ->
                                stringElement.GetString()
                                |> Option.ofObj
                                |> Option.map _.Trim()
                                |> Option.filter (fun value -> not (String.IsNullOrWhiteSpace value))
                            | _ -> None

                        let insertAfterLine =
                            match element.TryGetProperty "insertAfterLine" with
                            | true, lineElement when lineElement.ValueKind = JsonValueKind.Number ->
                                Some(lineElement.GetInt32())
                                |> Option.filter validLineIndexes.Contains
                            | _ -> None

                        let insertAfterId =
                            insertAfterLine
                            |> Option.map (fun lineIndex ->
                                document
                                |> Option.bind (fun doc -> ResumeDocument.tryFindNodeIdByLine doc lineIndex)
                                |> Option.defaultValue (sprintf "line.%d" lineIndex))

                        let draftBullet =
                            parseTrimmedString "draftBullet"
                            |> Option.filter (fun _ -> insertAfterId.IsSome)

                        { Text = text
                          Importance = importance
                          SatisfiedBy = mapLineIndexesToNodeIds document (parseLineIndexes "satisfiedBy")
                          SatisfiedByChanges =
                            mapLineIndexesToNodeIds document (parseLineIndexes "satisfiedByChanges")
                          GapHint = parseTrimmedString "gapHint"
                          DraftBullet = draftBullet
                          InsertAfterId = insertAfterId |> Option.filter (fun _ -> draftBullet.IsSome) })
                | _ -> None)
            |> Seq.toList
        | _ -> []

    let parseProposals
        (bullets: BulletLine list)
        (existingDocument: ResumeDocument option)
        (content: string)
        : Result<EngineProposal, string> =
        let originalsByIndex =
            bullets
            |> List.map (fun bullet -> bullet.LineIndex, bullet.Text)
            |> Map.ofList

        try
            let stripped = stripCodeFences content

            use document =
                try
                    JsonDocument.Parse(assistantPrefill + stripped)
                with :? JsonException ->
                    JsonDocument.Parse stripped

            let summary =
                match document.RootElement.TryGetProperty "summary" with
                | true, summaryElement when summaryElement.ValueKind = JsonValueKind.String ->
                    summaryElement.GetString()
                    |> Option.ofObj
                    |> Option.map _.Trim()
                    |> Option.filter (fun value -> not (String.IsNullOrWhiteSpace value))
                | _ -> None

            match summary, document.RootElement.TryGetProperty "changes" with
            | None, _ -> Error "Claude response was missing a non-empty 'summary' field."
            | Some _, (false, _) -> Error "Claude response was missing the 'changes' field."
            | Some summary, (true, changesElement) ->
                let changes =
                    changesElement.EnumerateArray()
                    |> Seq.choose (fun element ->
                        let hasLineIndex, lineIndexElement = element.TryGetProperty "lineIndex"
                        let hasTailored, tailoredElement = element.TryGetProperty "tailored"

                        if hasLineIndex && hasTailored then
                            let lineIndex = lineIndexElement.GetInt32()

                            let kind =
                                match element.TryGetProperty "kind" with
                                | true, kindElement ->
                                    kindElement.GetString()
                                    |> LineKind.tryParse
                                    |> Option.defaultValue Bullet
                                | false, _ -> Bullet

                            originalsByIndex
                            |> Map.tryFind lineIndex
                            |> Option.map (fun original ->
                                { LineIndex = lineIndex
                                  Original = original
                                  Tailored = tailoredElement.GetString()
                                  Kind = kind })
                        else
                            None)
                    |> Seq.toList

                let parsedDocument =
                    match existingDocument with
                    | Some existing -> Some existing
                    | None -> parseDocument bullets document.RootElement

                Ok
                    { Summary = summary
                      Changes = changes
                      Requirements = parseRequirements bullets parsedDocument document.RootElement
                      Document = parsedDocument }
        with ex ->
            Error(sprintf "Failed to parse Claude response as JSON: %s" ex.Message)

    interface TailoringEngine with

        member _.ProposeChanges
            (
                bullets: BulletLine list,
                jobDescription: string,
                existingDocument: ResumeDocument option,
                cancellationToken: CancellationToken
            ) : Task<Result<EngineProposal, string>> =
            task {
                match apiKey with
                | None -> return Error "ANTHROPIC_API_KEY is not set on the server."
                | Some apiKey ->
                    let modeInstructions =
                        if existingDocument.IsSome then
                            reuseModeInstructions
                        else
                            extractModeInstructions

                    let systemContent: obj[] =
                        [| box
                               {| ``type`` = "text"
                                  text = systemPromptCore
                                  cache_control = {| ``type`` = "ephemeral" |} |}
                           box
                               {| ``type`` = "text"
                                  text = modeInstructions |} |]

                    let userContent: obj[] =
                        match existingDocument with
                        | Some document ->
                            [| box
                                   {| ``type`` = "text"
                                      text = buildResumeContent bullets
                                      cache_control = {| ``type`` = "ephemeral" |} |}
                               box
                                   {| ``type`` = "text"
                                      text =
                                       sprintf
                                           "<resume_document>\n%s\n</resume_document>"
                                           (ResumeDocumentJson.serialize document) |}
                               box
                                   {| ``type`` = "text"
                                      text = buildJobDescriptionContent jobDescription |} |]
                        | None ->
                            [| box
                                   {| ``type`` = "text"
                                      text = buildResumeContent bullets
                                      cache_control = {| ``type`` = "ephemeral" |} |}
                               box
                                   {| ``type`` = "text"
                                      text = buildJobDescriptionContent jobDescription |} |]

                    let requestBody =
                        {| model = model
                           max_tokens = 10240
                           temperature = 0.2
                           system = systemContent
                           messages =
                            [| {| role = "user"
                                  content = box userContent |}
                               {| role = "assistant"
                                  content = box assistantPrefill |} |] |}

                    use request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
                    request.Headers.Add("x-api-key", apiKey)
                    request.Headers.Add("anthropic-version", "2023-06-01")

                    request.Content <-
                        new StringContent(
                            JsonSerializer.Serialize(requestBody, jsonOptions),
                            Encoding.UTF8,
                            MediaTypeHeaderValue "application/json"
                        )

                    try
                        use! response = httpClient.SendAsync(request, cancellationToken)
                        let! body = response.Content.ReadAsStringAsync(cancellationToken)

                        if not response.IsSuccessStatusCode then
                            let statusCode = int response.StatusCode
                            let bodyPreview = body.Substring(0, min body.Length 500)
                            ClaudeSentry.captureApiFailure "tailor" statusCode bodyPreview

                            return Error(sprintf "Claude API returned %d: %s" statusCode bodyPreview)
                        else
                            use document = JsonDocument.Parse body

                            let textContent =
                                document.RootElement.GetProperty("content").EnumerateArray()
                                |> Seq.tryPick (fun block ->
                                    match block.TryGetProperty "text" with
                                    | true, textElement -> Some(textElement.GetString())
                                    | false, _ -> None)

                            match textContent with
                            | None -> return Error "Claude response contained no text content."
                            | Some text -> return parseProposals bullets existingDocument text
                    with
                    | :? OperationCanceledException as ex when cancellationToken.IsCancellationRequested ->
                        return raise ex
                    | ex ->
                        ClaudeSentry.captureApiException "tailor" ex
                        return Error(sprintf "Failed to reach the Claude API: %s" ex.Message)
            }
