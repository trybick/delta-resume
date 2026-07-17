namespace DeltaResume.Api

open System
open DeltaResume.Application
open DeltaResume.Domain

[<CLIMutable>]
type TailorRequestDto =
    { ResumeText: string
      JobDescription: string
      ResumeName: string option }

[<CLIMutable>]
type RenameSavedResumeRequestDto = { Name: string }

[<CLIMutable>]
type CoverLetterRequestDto =
    { ResumeText: string
      JobDescription: string
      CandidateName: string option }

type CoverLetterResponseDto =
    { JobTitle: string
      CompanyName: string
      Letter: string }

[<CLIMutable>]
type CoverLetterSettingsDto =
    { Length: string
      Tone: string }

[<CLIMutable>]
type UserSettingsDto =
    { CoverLetter: CoverLetterSettingsDto }

type SavedResumeDto =
    { Id: Guid
      Name: string
      ResumeText: string
      CreatedAt: DateTimeOffset }

type BulletChangeDto =
    { Id: Guid
      LineIndex: int
      Original: string
      Tailored: string
      Kind: string }

type ResumeItemDto =
    { Kind: string
      Lines: int list }

type ResumeSectionDto =
    { HeadingLine: int option
      Items: ResumeItemDto list }

type ResumeStructureDto =
    { HeaderLines: int list
      Sections: ResumeSectionDto list }

type JobRequirementDto =
    { Text: string
      Importance: string
      SatisfiedBy: int list
      SatisfiedByChanges: int list
      GapHint: string option
      DraftBullet: string option
      InsertAfterLine: int option }

type TailorResponseDto =
    { RunId: Guid
      ResumeText: string
      Summary: string
      Changes: BulletChangeDto list
      Requirements: JobRequirementDto list
      Structure: ResumeStructureDto option }

type ErrorResponseDto = { Message: string }

module Mapping =
    let toChangeDto (change: BulletChange) : BulletChangeDto =
        let (ChangeId id) = change.Id

        { Id = id
          LineIndex = change.LineIndex
          Original = change.Original
          Tailored = change.Tailored
          Kind = LineKind.toString change.Kind }

    let toStructureDto (structure: ResumeStructure) : ResumeStructureDto =
        { HeaderLines = structure.HeaderLines
          Sections =
            structure.Sections
            |> List.map (fun section ->
                { HeadingLine = section.HeadingLine
                  Items =
                    section.Items
                    |> List.map (fun item ->
                        { Kind = ResumeItemKind.toString item.Kind
                          Lines = item.Lines }) }) }

    let toRequirementDto (requirement: JobRequirement) : JobRequirementDto =
        { Text = requirement.Text
          Importance = RequirementImportance.toString requirement.Importance
          SatisfiedBy = requirement.SatisfiedBy
          SatisfiedByChanges = requirement.SatisfiedByChanges
          GapHint = requirement.GapHint
          DraftBullet = requirement.DraftBullet
          InsertAfterLine = requirement.InsertAfterLine }

    let toResponseDto (run: TailorRun) : TailorResponseDto =
        let (RunId runId) = run.Id

        { RunId = runId
          ResumeText = run.ResumeText
          Summary = run.Summary
          Changes = run.Changes |> List.map toChangeDto
          Requirements = run.Requirements |> List.map toRequirementDto
          Structure = run.Structure |> Option.map toStructureDto }

    let toUserSettingsDto (settings: UserSettings) : UserSettingsDto =
        { CoverLetter =
            { Length = settings.CoverLetter.Length
              Tone = settings.CoverLetter.Tone } }

    let toSavedResumeDto (resume: SavedResume) : SavedResumeDto =
        let (SavedResumeId id) = resume.Id

        { Id = id
          Name = resume.Name
          ResumeText = resume.ResumeText
          CreatedAt = resume.CreatedAt }
