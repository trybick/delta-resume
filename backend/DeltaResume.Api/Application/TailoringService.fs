namespace DeltaResume.Application

open System
open System.Threading
open System.Threading.Tasks
open DeltaResume.Domain

type TailorOutcome =
    { Result: Result<TailorRun, TailorError>
      Usage: LlmUsage option }

type TailoringService(engine: TailoringEngine) =

    member _.ValidateInputs
        (resumeText: string, jobDescription: string, resumeName: string option)
        : Result<unit, TailorError> =
        match InputValidation.validate resumeText jobDescription resumeName with
        | Error message -> Error(InvalidInput message)
        | Ok() when resumeText |> Bullets.extract |> List.isEmpty ->
            Error(
                InvalidInput
                    "Could not find any tailorable content in the resume. Add a few sentences or bullet points describing your experience."
            )
        | Ok() -> Ok()

    member _.TailorResume
        (
            resumeText: string,
            jobDescription: string,
            existingDocument: ResumeDocument option,
            cancellationToken: CancellationToken
        ) : Task<TailorOutcome> =
        task {
            let bullets = Bullets.extract resumeText

            let validatedExisting =
                existingDocument
                |> Option.bind (fun document ->
                    let validLineIndexes = bullets |> List.map _.LineIndex |> Set.ofList
                    ResumeDocument.validate validLineIndexes document)

            let! engineOutcome =
                engine.ProposeChanges(bullets, jobDescription, validatedExisting, cancellationToken)

            match engineOutcome.Result with
            | Error message ->
                return
                    { Result = Error(EngineFailure message)
                      Usage = engineOutcome.Usage }
            | Ok proposal ->
                let document =
                    match validatedExisting with
                    | Some existing -> Some existing
                    | None -> proposal.Document

                let changes = Bullets.toChanges bullets document proposal.Changes

                let run =
                    { Id = RunId(Guid.NewGuid())
                      ResumeText = resumeText
                      JobDescription = jobDescription
                      CreatedAt = DateTimeOffset.UtcNow
                      Summary = proposal.Summary
                      Changes = changes
                      Requirements = proposal.Requirements
                      Document = document }

                return
                    { Result = Ok run
                      Usage = engineOutcome.Usage }
        }
