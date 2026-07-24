namespace DeltaResume.Api

open System
open DeltaResume.Application
open DeltaResume.Domain

[<CLIMutable>]
type TailorRequestDto =
    { ResumeText: string
      JobDescription: string
      ResumeName: string option
      ResumeDocument: string option }

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
      ResumeDocument: string option
      CreatedAt: DateTimeOffset }

type BulletChangeDto =
    { Id: Guid
      TargetId: string
      SourceLines: int list
      Original: string
      Tailored: string
      Kind: string }

type JobRequirementDto =
    { Text: string
      Importance: string
      SatisfiedBy: string list
      SatisfiedByChanges: string list
      GapHint: string option
      DraftBullet: string option
      InsertAfterId: string option
      Locked: bool }

type TailorResponseDto =
    { RunId: Guid
      ResumeText: string
      Summary: string
      Changes: BulletChangeDto list
      Requirements: JobRequirementDto list
      Document: string option }

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
          TargetId = change.TargetId
          SourceLines = change.SourceLines
          Original = change.Original
          Tailored = change.Tailored
          Kind = LineKind.toString change.Kind }

    let toRequirementDto (requirement: JobRequirement) : JobRequirementDto =
        { Text = requirement.Text
          Importance = RequirementImportance.toString requirement.Importance
          SatisfiedBy = requirement.SatisfiedBy
          SatisfiedByChanges = requirement.SatisfiedByChanges
          GapHint = requirement.GapHint
          DraftBullet = requirement.DraftBullet
          InsertAfterId = requirement.InsertAfterId
          Locked = false }

    let private toLockedRequirementDto (requirement: JobRequirement) : JobRequirementDto =
        { Text = ""
          Importance = RequirementImportance.toString requirement.Importance
          SatisfiedBy = []
          SatisfiedByChanges = []
          GapHint = None
          DraftBullet = None
          InsertAfterId = None
          Locked = true }

    // Free/guest plans only get the first uncovered requirement in full; the rest
    // are stripped server-side so gap details never leave the API for non-Pro users.
    let private toGatedRequirementDtos (run: TailorRun) : JobRequirementDto list =
        let changedTargets =
            run.Changes
            |> List.map (fun change -> change.TargetId)
            |> Set.ofList

        let isCovered (requirement: JobRequirement) =
            not (List.isEmpty requirement.SatisfiedBy)
            || requirement.SatisfiedByChanges |> List.exists changedTargets.Contains

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
          Document = run.Document |> Option.map ResumeDocumentJson.serialize }

    let toUserSettingsDto (settings: UserSettings) : UserSettingsDto =
        { CoverLetter =
            { Length = CoverLetterLength.toString settings.CoverLetter.Length
              Tone = CoverLetterTone.toString settings.CoverLetter.Tone } }

    let toSavedResumeDto (resume: SavedResume) : SavedResumeDto =
        let (SavedResumeId id) = resume.Id

        { Id = id
          Name = resume.Name
          ResumeText = resume.ResumeText
          ResumeDocument = resume.ResumeDocument |> Option.map ResumeDocumentJson.serialize
          CreatedAt = resume.CreatedAt }
