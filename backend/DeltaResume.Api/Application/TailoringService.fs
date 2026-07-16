namespace DeltaResume.Application

open System
open System.Threading
open System.Threading.Tasks
open DeltaResume.Domain

type TailoringService(engine: TailoringEngine) =

    member _.ValidateInputs(resumeText: string, jobDescription: string) : Result<unit, TailorError> =
        if String.IsNullOrWhiteSpace resumeText then
            Error(InvalidInput "Resume text is required.")
        elif String.IsNullOrWhiteSpace jobDescription then
            Error(InvalidInput "Job description is required.")
        elif resumeText |> Bullets.extract |> List.isEmpty then
            Error(InvalidInput "Could not find any tailorable content in the resume. Add a few sentences or bullet points describing your experience.")
        else
            Ok()

    member this.TailorResume
        (resumeText: string, jobDescription: string, cancellationToken: CancellationToken)
        : Task<Result<TailorRun, TailorError>> =
        task {
            match this.ValidateInputs(resumeText, jobDescription) with
            | Error error -> return Error error
            | Ok() ->
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
