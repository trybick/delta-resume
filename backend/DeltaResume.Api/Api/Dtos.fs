namespace DeltaResume.Api

open System
open System.Text.Json
open System.Text.Json.Serialization
open DeltaResume.Application
open DeltaResume.Domain

[<CLIMutable>]
type TailorRequestDto =
    { ResumeText: string
      JobDescription: string
      ResumeName: string option
      ResumeDocument: string option
      ResumeLayout: string option
      RunId: Guid option }

[<CLIMutable>]
type RenameSavedResumeRequestDto = { Name: string }

[<CLIMutable>]
type CoverLetterRequestDto =
    { ResumeText: string
      JobDescription: string
      CandidateName: string option
      RunId: Guid option }

[<CLIMutable>]
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
      ResumeLayout: string option
      CreatedAt: DateTimeOffset }

[<CLIMutable>]
type BulletChangeDto =
    { Id: Guid
      TargetId: string
      SourceLines: int list
      Original: string
      Tailored: string
      Kind: string }

[<CLIMutable>]
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
      Document: string option
      ResumeLayout: string option }

[<CLIMutable>]
type AddedBulletDto =
    { Id: Guid
      RequirementText: string
      Text: string
      AfterId: string }

[<CLIMutable>]
type RunDecisionsDto =
    { Decisions: Map<string, string>
      AddedBullets: AddedBulletDto list }

[<CLIMutable>]
type StoredTailorResultDto =
    { Summary: string
      Changes: BulletChangeDto list
      Requirements: JobRequirementDto list
      Document: string option
      ResumeLayout: string option }

type TailorRunSummaryDto =
    { Id: Guid
      CompanyName: string option
      JobTitle: string option
      ResumeName: string
      CreatedAt: DateTimeOffset
      ChangeCount: int
      CoveredCount: int
      TotalCount: int }

type TailorRunListDto =
    { Runs: TailorRunSummaryDto list
      HiddenOlderCount: int }

type TailorRunDetailDto =
    { Id: Guid
      ResumeName: string
      CompanyName: string option
      JobTitle: string option
      JobDescription: string
      CreatedAt: DateTimeOffset
      Result: TailorResponseDto
      CoverLetter: CoverLetterResponseDto option
      Decisions: RunDecisionsDto }

[<CLIMutable>]
type ClaimRunRequestDto =
    { RunId: Guid
      ResumeName: string option
      ResumeText: string
      JobDescription: string
      Result: StoredTailorResultDto
      CoverLetter: CoverLetterResponseDto option
      Decisions: RunDecisionsDto }

[<CLIMutable>]
type PatchRunDecisionsRequestDto = { Decisions: RunDecisionsDto }

type ErrorResponseDto = { Message: string }

type CreditStatusDto =
    { Remaining: int
      Total: int
      Plan: string
      IsAuthenticated: bool
      FreeAccountTotal: int }

module Mapping =
    let toCreditStatusDto (status: CreditStatus) : CreditStatusDto =
        { Remaining = status.Remaining
          Total = status.Total
          Plan = CreditPlan.toString status.Plan
          IsAuthenticated = status.IsAuthenticated
          FreeAccountTotal = status.FreeAccountTotal }

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

    let toResponseDto (isProPlan: bool) (resumeLayout: string option) (run: TailorRun) : TailorResponseDto =
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
          Document = run.Document |> Option.map ResumeDocumentJson.serialize
          ResumeLayout = resumeLayout }

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
          ResumeLayout = resume.ResumeLayout
          CreatedAt = resume.CreatedAt }

    let emptyDecisions: RunDecisionsDto =
        { Decisions = Map.empty
          AddedBullets = [] }

    let private jsonOptions =
        let options = JsonSerializerOptions(PropertyNamingPolicy = JsonNamingPolicy.CamelCase)
        options.Converters.Add(JsonFSharpConverter())
        options

    let private orEmpty (list: 'a list) : 'a list =
        if obj.ReferenceEquals(list, null) then [] else list

    let serializeDecisions (decisions: RunDecisionsDto) : string =
        let normalized =
            { Decisions =
                if obj.ReferenceEquals(decisions.Decisions, null) then
                    Map.empty
                else
                    decisions.Decisions
              AddedBullets = orEmpty decisions.AddedBullets }

        JsonSerializer.Serialize(normalized, jsonOptions)

    let parseDecisions (json: string) : RunDecisionsDto =
        if String.IsNullOrWhiteSpace json then
            emptyDecisions
        else
            try
                let parsed = JsonSerializer.Deserialize<RunDecisionsDto>(json, jsonOptions)

                { Decisions =
                    if obj.ReferenceEquals(parsed.Decisions, null) then
                        Map.empty
                    else
                        parsed.Decisions
                  AddedBullets = orEmpty parsed.AddedBullets }
            with _ ->
                emptyDecisions

    let toStoredResultDto (resumeLayout: string option) (run: TailorRun) : StoredTailorResultDto =
        { Summary = run.Summary
          Changes = run.Changes |> List.map toChangeDto
          Requirements = run.Requirements |> List.map toRequirementDto
          Document = run.Document |> Option.map ResumeDocumentJson.serialize
          ResumeLayout = resumeLayout }

    let serializeStoredResult (dto: StoredTailorResultDto) : string =
        let normalized =
            { Summary = if isNull dto.Summary then "" else dto.Summary
              Changes = orEmpty dto.Changes
              Requirements = orEmpty dto.Requirements
              Document = dto.Document
              ResumeLayout = dto.ResumeLayout }

        JsonSerializer.Serialize(normalized, jsonOptions)

    let tryParseStoredResult (json: string) : StoredTailorResultDto option =
        if String.IsNullOrWhiteSpace json then
            None
        else
            try
                JsonSerializer.Deserialize<StoredTailorResultDto>(json, jsonOptions) |> Some
            with _ ->
                None

    let serializeCoverLetter (letter: CoverLetterResponseDto) : string =
        JsonSerializer.Serialize(letter, jsonOptions)

    let tryParseCoverLetter (json: string option) : CoverLetterResponseDto option =
        json
        |> Option.filter (String.IsNullOrWhiteSpace >> not)
        |> Option.bind (fun value ->
            try
                JsonSerializer.Deserialize<CoverLetterResponseDto>(value, jsonOptions) |> Some
            with _ ->
                None)

    let private toDomainChange (dto: BulletChangeDto) : BulletChange =
        { Id = ChangeId dto.Id
          TargetId = if isNull dto.TargetId then "" else dto.TargetId
          SourceLines = orEmpty dto.SourceLines
          Original = if isNull dto.Original then "" else dto.Original
          Tailored = if isNull dto.Tailored then "" else dto.Tailored
          Kind = LineKind.tryParse dto.Kind |> Option.defaultValue LineKind.Bullet }

    let private toDomainRequirement (dto: JobRequirementDto) : JobRequirement =
        { Text = if isNull dto.Text then "" else dto.Text
          Importance = RequirementImportance.tryParse dto.Importance |> Option.defaultValue Must
          SatisfiedBy = orEmpty dto.SatisfiedBy
          SatisfiedByChanges = orEmpty dto.SatisfiedByChanges
          GapHint = dto.GapHint
          DraftBullet = dto.DraftBullet
          InsertAfterId = dto.InsertAfterId }

    let toTailorRunFromStored (record: TailorRunRecord) (stored: StoredTailorResultDto) : TailorRun =
        { Id = RunId record.Id
          ResumeText = record.ResumeText
          JobDescription = record.JobDescription
          CreatedAt = record.CreatedAt
          Summary = if isNull stored.Summary then "" else stored.Summary
          Changes = orEmpty stored.Changes |> List.map toDomainChange
          Requirements = orEmpty stored.Requirements |> List.map toDomainRequirement
          Document = stored.Document |> Option.bind ResumeDocumentJson.tryParse }

    let coverageCounts (stored: StoredTailorResultDto) : int * int =
        let requirements = orEmpty stored.Requirements
        let covered =
            requirements
            |> List.filter (fun requirement ->
                not (List.isEmpty (orEmpty requirement.SatisfiedBy))
                || not (List.isEmpty (orEmpty requirement.SatisfiedByChanges)))
            |> List.length

        covered, requirements.Length

    let toRunSummaryDto (record: TailorRunRecord) : TailorRunSummaryDto =
        let changeCount, coveredCount, totalCount =
            match tryParseStoredResult record.ResultJson with
            | Some stored ->
                let covered, total = coverageCounts stored
                (orEmpty stored.Changes).Length, covered, total
            | None -> 0, 0, 0

        { Id = record.Id
          CompanyName = record.CompanyName
          JobTitle = record.JobTitle
          ResumeName = record.ResumeName
          CreatedAt = record.CreatedAt
          ChangeCount = changeCount
          CoveredCount = coveredCount
          TotalCount = totalCount }

    let toRunDetailDto (isProPlan: bool) (record: TailorRunRecord) : TailorRunDetailDto option =
        tryParseStoredResult record.ResultJson
        |> Option.map (fun stored ->
            let run = toTailorRunFromStored record stored
            let result = toResponseDto isProPlan stored.ResumeLayout run

            { Id = record.Id
              ResumeName = record.ResumeName
              CompanyName = record.CompanyName
              JobTitle = record.JobTitle
              JobDescription = record.JobDescription
              CreatedAt = record.CreatedAt
              Result = result
              CoverLetter = tryParseCoverLetter record.CoverLetterJson
              Decisions = parseDecisions record.DecisionsJson })
