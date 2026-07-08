namespace DeltaResume.Application

open System
open System.Threading.Tasks
open DeltaResume.Domain

type TailoringService(engine: TailoringEngine) =

    member _.TailorResume(resumeText: string, jobDescription: string) : Task<Result<TailorRun, TailorError>> =
        task {
            if String.IsNullOrWhiteSpace resumeText then
                return Error(InvalidInput "Resume text is required.")
            elif String.IsNullOrWhiteSpace jobDescription then
                return Error(InvalidInput "Job description is required.")
            else
                let bullets = Bullets.extract resumeText

                if List.isEmpty bullets then
                    return Error(InvalidInput "Could not find any tailorable content in the resume. Add a few sentences or bullet points describing your experience.")
                else
                    let! engineResult = engine.ProposeChanges(bullets, jobDescription)

                    match engineResult with
                    | Error message -> return Error(EngineFailure message)
                    | Ok proposal ->
                        let changes = Bullets.toChanges bullets proposal.Changes

                        let run =
                            { Id = RunId(Guid.NewGuid())
                              ResumeText = resumeText
                              JobDescription = jobDescription
                              CreatedAt = DateTimeOffset.UtcNow
                              Changes = changes
                              Structure = proposal.Structure }

                        return Ok run
        }
