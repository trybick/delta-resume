namespace DeltaResume.Application

open System

module InputLimits =
    [<Literal>]
    let MaxResumeCharacters = 15_000

    [<Literal>]
    let MaxJobDescriptionCharacters = 10_000

    [<Literal>]
    let MaxNameCharacters = 200

    [<Literal>]
    let MaxNonBlankLines = 500

module InputValidation =

    let private nullToEmpty (value: string) =
        if isNull value then "" else value

    let private countNonBlankLines (text: string) =
        nullToEmpty text
        |> fun value -> value.Split('\n')
        |> Array.filter (fun line -> not (String.IsNullOrWhiteSpace line))
        |> Array.length

    let private validateOptionalName (name: string option) : Result<unit, string> =
        match name |> Option.bind Option.ofObj with
        | None -> Ok()
        | Some value when value.Length > InputLimits.MaxNameCharacters ->
            Error(sprintf "Name must be at most %d characters." InputLimits.MaxNameCharacters)
        | Some _ -> Ok()

    let validate
        (resumeText: string)
        (jobDescription: string)
        (optionalName: string option)
        : Result<unit, string> =
        let resumeText = nullToEmpty resumeText
        let jobDescription = nullToEmpty jobDescription

        if String.IsNullOrWhiteSpace resumeText then
            Error "Resume text is required."
        elif String.IsNullOrWhiteSpace jobDescription then
            Error "Job description is required."
        elif resumeText.Length > InputLimits.MaxResumeCharacters then
            Error(sprintf "Resume text must be at most %d characters." InputLimits.MaxResumeCharacters)
        elif jobDescription.Length > InputLimits.MaxJobDescriptionCharacters then
            Error(
                sprintf
                    "Job description must be at most %d characters."
                    InputLimits.MaxJobDescriptionCharacters
            )
        elif countNonBlankLines resumeText > InputLimits.MaxNonBlankLines then
            Error(sprintf "Resume must have at most %d non-blank lines." InputLimits.MaxNonBlankLines)
        elif countNonBlankLines jobDescription > InputLimits.MaxNonBlankLines then
            Error(
                sprintf
                    "Job description must have at most %d non-blank lines."
                    InputLimits.MaxNonBlankLines
            )
        else
            validateOptionalName optionalName
