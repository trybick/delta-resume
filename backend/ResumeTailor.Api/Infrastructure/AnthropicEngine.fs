namespace ResumeTailor.Infrastructure

open System
open System.Net.Http
open System.Net.Http.Headers
open System.Text
open System.Text.Json
open System.Threading.Tasks
open ResumeTailor.Application
open ResumeTailor.Domain

type AnthropicOptions =
    { ApiKey: string option
      Model: string }

module AnthropicOptions =
    let fromEnvironment () : AnthropicOptions =
        let apiKey =
            Environment.GetEnvironmentVariable "ANTHROPIC_API_KEY"
            |> Option.ofObj
            |> Option.filter (fun key -> not (String.IsNullOrWhiteSpace key))

        let model =
            Environment.GetEnvironmentVariable "ANTHROPIC_MODEL"
            |> Option.ofObj
            |> Option.filter (fun value -> not (String.IsNullOrWhiteSpace value))
            |> Option.defaultValue "claude-sonnet-4-5"

        { ApiKey = apiKey; Model = model }

type AnthropicEngine(httpClient: HttpClient, options: AnthropicOptions) =

    let jsonOptions = JsonSerializerOptions(PropertyNameCaseInsensitive = true)

    let buildPrompt (bullets: BulletLine list) (jobDescription: string) : string =
        let bulletList =
            bullets
            |> List.map (fun bullet -> sprintf "lineIndex %d: %s" bullet.LineIndex bullet.Text)
            |> String.concat "\n"

        sprintf
            """You are a resume tailoring assistant. Given resume bullet lines and a job description, rewrite the 3-5 bullets most relevant to the job description so they better match its language, keywords, and priorities. Keep rewrites truthful to the original meaning; do not invent metrics that change the substance of the claim. If a line starts with a bullet marker, preserve that exact marker and indentation; if it does not, keep the line as plain text with the same indentation.

Resume bullet lines (with their line indexes):
%s

Job description:
%s

Respond with ONLY a JSON object in exactly this shape, no prose, no code fences:
{"changes":[{"lineIndex":0,"original":"<the exact original line>","tailored":"<the rewritten line>"}]}"""
            bulletList
            jobDescription

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

    let parseProposals (content: string) : Result<ProposedChange list, string> =
        try
            let json = stripCodeFences content
            use document = JsonDocument.Parse json

            match document.RootElement.TryGetProperty "changes" with
            | false, _ -> Error "Claude response was missing the 'changes' field."
            | true, changesElement ->
                changesElement.EnumerateArray()
                |> Seq.choose (fun element ->
                    let hasLineIndex, lineIndexElement = element.TryGetProperty "lineIndex"
                    let hasOriginal, originalElement = element.TryGetProperty "original"
                    let hasTailored, tailoredElement = element.TryGetProperty "tailored"

                    if hasLineIndex && hasOriginal && hasTailored then
                        Some
                            { LineIndex = lineIndexElement.GetInt32()
                              Original = originalElement.GetString()
                              Tailored = tailoredElement.GetString() }
                    else
                        None)
                |> Seq.toList
                |> Ok
        with ex ->
            Error(sprintf "Failed to parse Claude response as JSON: %s" ex.Message)

    interface TailoringEngine with

        member _.ProposeChanges
            (bullets: BulletLine list, jobDescription: string)
            : Task<Result<ProposedChange list, string>> =
            task {
                match options.ApiKey with
                | None -> return Error "ANTHROPIC_API_KEY is not set on the server."
                | Some apiKey ->
                    let requestBody =
                        {| model = options.Model
                           max_tokens = 2048
                           messages =
                            [| {| role = "user"
                                  content = buildPrompt bullets jobDescription |} |] |}

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
                        use! response = httpClient.SendAsync request
                        let! body = response.Content.ReadAsStringAsync()

                        if not response.IsSuccessStatusCode then
                            return
                                Error(
                                    sprintf
                                        "Claude API returned %d: %s"
                                        (int response.StatusCode)
                                        (body.Substring(0, min body.Length 500))
                                )
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
                            | Some text -> return parseProposals text
                    with ex ->
                        return Error(sprintf "Failed to reach the Claude API: %s" ex.Message)
            }
