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
      InsertAfterLine: int option
      Locked: bool }

type TailorResponseDto =
    { RunId: Guid
      ResumeText: string
      Summary: string
      Changes: BulletChangeDto list
      Requirements: JobRequirementDto list
      Structure: ResumeStructureDto option }

type ErrorResponseDto = { Message: string }

type CreditStatusDto =
    { Remaining: int
      Total: int
      Plan: string
      IsAuthenticated: bool }

module Mapping =
    let toCreditStatusDto (status: CreditStatus) : CreditStatusDto =
        { Remaining = status.Remaining
          Total = status.Total
          Plan = CreditPlan.toString status.Plan
          IsAuthenticated = status.IsAuthenticated }

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
          InsertAfterLine = requirement.InsertAfterLine
          Locked = false }

    let private toLockedRequirementDto (requirement: JobRequirement) : JobRequirementDto =
        { Text = ""
          Importance = RequirementImportance.toString requirement.Importance
          SatisfiedBy = []
          SatisfiedByChanges = []
          GapHint = None
          DraftBullet = None
          InsertAfterLine = None
          Locked = true }

    // Free/guest plans only get the first uncovered requirement in full; the rest
    // are stripped server-side so gap details never leave the API for non-Pro users.
    let private toGatedRequirementDtos (run: TailorRun) : JobRequirementDto list =
        let changeLines =
            run.Changes |> List.map (fun change -> change.LineIndex) |> Set.ofList

        let isCovered (requirement: JobRequirement) =
            not (List.isEmpty requirement.SatisfiedBy)
            || requirement.SatisfiedByChanges |> List.exists changeLines.Contains

        run.Requirements
        |> List.mapFold
            (fun uncoveredSeen requirement ->
                if isCovered requirement then
                    toRequirementDto requirement, uncoveredSeen
                elif uncoveredSeen = 0 then
                    toRequirementDto requirement, 1
                else
                    toLockedRequirementDto requirement, uncoveredSeen + 1)
            0
        |> fst

    let toResponseDto (isProPlan: bool) (run: TailorRun) : TailorResponseDto =
        let (RunId runId) = run.Id

        { RunId = runId
          ResumeText = run.ResumeText
          Summary = run.Summary
          Changes = run.Changes |> List.map toChangeDto
          Requirements =
            if isProPlan then
                run.Requirements |> List.map toRequirementDto
            else
                toGatedRequirementDtos run
          Structure = run.Structure |> Option.map toStructureDto }

    let toUserSettingsDto (settings: UserSettings) : UserSettingsDto =
        { CoverLetter =
            { Length = CoverLetterLength.toString settings.CoverLetter.Length
              Tone = CoverLetterTone.toString settings.CoverLetter.Tone } }

    let toSavedResumeDto (resume: SavedResume) : SavedResumeDto =
        let (SavedResumeId id) = resume.Id

        { Id = id
          Name = resume.Name
          ResumeText = resume.ResumeText
          CreatedAt = resume.CreatedAt }
