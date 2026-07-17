namespace DeltaResume.Application

open System
open System.Threading
open System.Threading.Tasks
open DeltaResume.Domain

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
        (resumeText: string, jobDescription: string, cancellationToken: CancellationToken)
        : Task<Result<TailorRun, TailorError>> =
        task {
            let bullets = Bullets.extract resumeText
            let! engineResult = engine.ProposeChanges(bullets, jobDescription, cancellationToken)

            match engineResult with
            | Error message -> return Error(EngineFailure message)
            | Ok proposal ->
                let changes = Bullets.toChanges bullets proposal.Changes

                let run =
                    { Id = RunId(Guid.NewGuid())
                      ResumeText = resumeText
                      JobDescription = jobDescription
                      CreatedAt = DateTimeOffset.UtcNow
                      Summary = proposal.Summary
                      Changes = changes
                      Requirements = proposal.Requirements
                      Structure = proposal.Structure }

                return Ok run
        }
