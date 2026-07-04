namespace DeltaResume.Api

open System
open DeltaResume.Domain

[<CLIMutable>]
type TailorRequestDto =
    { ResumeText: string
      JobDescription: string
      ResumeName: string option }

[<CLIMutable>]
type DecisionRequestDto = { Decision: string }

[<CLIMutable>]
type RenameResumeRequestDto = { Name: string }

type SavedResumeDto =
    { Id: Guid
      Name: string
      ResumeText: string
      CreatedAt: DateTimeOffset }

type BulletChangeDto =
    { Id: Guid
      LineIndex: int
      Original: string
      Tailored: string }

type TailorResponseDto =
    { RunId: Guid
      ResumeText: string
      Changes: BulletChangeDto list }

type ErrorResponseDto = { Message: string }

module Mapping =
    let toChangeDto (change: BulletChange) : BulletChangeDto =
        let (ChangeId id) = change.Id

        { Id = id
          LineIndex = change.LineIndex
          Original = change.Original
          Tailored = change.Tailored }

    let toResponseDto (run: TailorRun) : TailorResponseDto =
        let (RunId runId) = run.Id

        { RunId = runId
          ResumeText = run.ResumeText
          Changes = run.Changes |> List.map toChangeDto }

    let toSavedResumeDto (resume: SavedResume) : SavedResumeDto =
        let (SavedResumeId id) = resume.Id

        { Id = id
          Name = resume.Name
          ResumeText = resume.ResumeText
          CreatedAt = resume.CreatedAt }
