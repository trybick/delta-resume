namespace DeltaResume.Domain

open System
open System.Text
open System.Text.Json

module ResumeDocumentJson =

    let private writeSourceNode (writer: Utf8JsonWriter) (node: ResumeSourceNode) =
        writer.WriteStartObject()
        writer.WriteString("id", node.Id)
        writer.WritePropertyName "sourceLines"
        writer.WriteStartArray()
        node.SourceLines |> List.iter writer.WriteNumberValue
        writer.WriteEndArray()
        writer.WriteEndObject()

    let private writeOptionalString (writer: Utf8JsonWriter) (name: string) (value: string option) =
        match value with
        | Some text -> writer.WriteString(name, text)
        | None ->
            writer.WritePropertyName name
            writer.WriteNullValue()

    let private writeDates (writer: Utf8JsonWriter) (dates: ResumeDateRange) =
        writer.WriteStartObject()
        writeOptionalString writer "start" dates.Start
        writeOptionalString writer "end" dates.End
        writeOptionalString writer "text" dates.Text
        writer.WriteEndObject()

    let private writeBullet (writer: Utf8JsonWriter) (bullet: ResumeBulletNode) =
        writer.WriteStartObject()
        writer.WriteString("id", bullet.Id)
        writer.WritePropertyName "sourceLines"
        writer.WriteStartArray()
        bullet.SourceLines |> List.iter writer.WriteNumberValue
        writer.WriteEndArray()
        writer.WriteEndObject()

    let private writeBlock (writer: Utf8JsonWriter) (block: ResumeBlock) =
        writer.WriteStartObject()

        match block with
        | ResumeBlock.Entry entry ->
            writer.WriteString("kind", "entry")
            writer.WriteString("id", entry.Id)
            writeOptionalString writer "title" entry.Title
            writeOptionalString writer "organization" entry.Organization
            writeOptionalString writer "location" entry.Location

            match entry.Dates with
            | Some dates ->
                writer.WritePropertyName "dates"
                writeDates writer dates
            | None ->
                writer.WritePropertyName "dates"
                writer.WriteNullValue()

            writer.WritePropertyName "headingSourceLines"
            writer.WriteStartArray()
            entry.HeadingSourceLines |> List.iter writer.WriteNumberValue
            writer.WriteEndArray()
            writer.WritePropertyName "bullets"
            writer.WriteStartArray()
            entry.Bullets |> List.iter (writeBullet writer)
            writer.WriteEndArray()
        | ResumeBlock.Paragraph paragraph ->
            writer.WriteString("kind", "paragraph")
            writer.WriteString("id", paragraph.Id)
            writer.WritePropertyName "sourceLines"
            writer.WriteStartArray()
            paragraph.SourceLines |> List.iter writer.WriteNumberValue
            writer.WriteEndArray()
        | ResumeBlock.SkillsGroup group ->
            writer.WriteString("kind", "skillsGroup")
            writer.WriteString("id", group.Id)
            writeOptionalString writer "label" group.Label
            writer.WritePropertyName "sourceLines"
            writer.WriteStartArray()
            group.SourceLines |> List.iter writer.WriteNumberValue
            writer.WriteEndArray()
        | ResumeBlock.Bullet bullet ->
            writer.WriteString("kind", "bullet")
            writer.WriteString("id", bullet.Id)
            writer.WritePropertyName "sourceLines"
            writer.WriteStartArray()
            bullet.SourceLines |> List.iter writer.WriteNumberValue
            writer.WriteEndArray()

        writer.WriteEndObject()

    let serialize (document: ResumeDocument) : string =
        use stream = new System.IO.MemoryStream()
        use writer = new Utf8JsonWriter(stream)

        writer.WriteStartObject()
        writer.WriteNumber("version", document.Version)
        writer.WritePropertyName "header"
        writer.WriteStartObject()
        writer.WritePropertyName "name"
        writeSourceNode writer document.Header.Name
        writer.WritePropertyName "contact"
        writer.WriteStartArray()
        document.Header.Contact |> List.iter (writeSourceNode writer)
        writer.WriteEndArray()
        writer.WriteEndObject()
        writer.WritePropertyName "sections"
        writer.WriteStartArray()

        document.Sections
        |> List.iter (fun section ->
            writer.WriteStartObject()
            writer.WriteString("id", section.Id)
            writer.WriteString("kind", section.Kind)

            match section.Heading with
            | Some heading ->
                writer.WritePropertyName "heading"
                writeSourceNode writer heading
            | None ->
                writer.WritePropertyName "heading"
                writer.WriteNullValue()

            writer.WritePropertyName "blocks"
            writer.WriteStartArray()
            section.Blocks |> List.iter (writeBlock writer)
            writer.WriteEndArray()
            writer.WriteEndObject())

        writer.WriteEndArray()
        writer.WriteEndObject()
        writer.Flush()
        Encoding.UTF8.GetString(stream.ToArray())

    let private parseIntList (element: JsonElement) : int list =
        if element.ValueKind = JsonValueKind.Array then
            element.EnumerateArray()
            |> Seq.choose (fun value ->
                if value.ValueKind = JsonValueKind.Number then
                    Some(value.GetInt32())
                else
                    None)
            |> Seq.toList
        else
            []

    let private tryGetString (element: JsonElement) (name: string) : string option =
        match element.TryGetProperty name with
        | true, value when value.ValueKind = JsonValueKind.String ->
            value.GetString()
            |> Option.ofObj
            |> Option.map _.Trim()
            |> Option.filter (fun text -> not (String.IsNullOrWhiteSpace text))
        | _ -> None

    let private parseSourceNode (element: JsonElement) : ResumeSourceNode option =
        if element.ValueKind <> JsonValueKind.Object then
            None
        else
            let id = tryGetString element "id" |> Option.defaultValue ""

            let lines =
                match element.TryGetProperty "sourceLines" with
                | true, linesElement -> parseIntList linesElement
                | false, _ -> []

            if String.IsNullOrWhiteSpace id || List.isEmpty lines then
                None
            else
                Some { Id = id; SourceLines = lines }

    let private parseDates (element: JsonElement) : ResumeDateRange option =
        if element.ValueKind <> JsonValueKind.Object then
            None
        else
            let start = tryGetString element "start"
            let endDate = tryGetString element "end"
            let text = tryGetString element "text"

            if start.IsNone && endDate.IsNone && text.IsNone then
                None
            else
                Some { Start = start; End = endDate; Text = text }

    let private parseBullet (element: JsonElement) : ResumeBulletNode option =
        if element.ValueKind <> JsonValueKind.Object then
            None
        else
            match tryGetString element "id" with
            | None -> None
            | Some id ->
                let lines =
                    match element.TryGetProperty "sourceLines" with
                    | true, linesElement -> parseIntList linesElement
                    | false, _ -> []

                if List.isEmpty lines then None else Some { Id = id; SourceLines = lines }

    let private parseBlock (element: JsonElement) : ResumeBlock option =
        if element.ValueKind <> JsonValueKind.Object then
            None
        else
            match tryGetString element "kind", tryGetString element "id" with
            | Some "entry", Some id ->
                let headingLines =
                    match element.TryGetProperty "headingSourceLines" with
                    | true, linesElement -> parseIntList linesElement
                    | false, _ -> []

                let bullets =
                    match element.TryGetProperty "bullets" with
                    | true, bulletsElement when bulletsElement.ValueKind = JsonValueKind.Array ->
                        bulletsElement.EnumerateArray() |> Seq.choose parseBullet |> Seq.toList
                    | _ -> []

                let dates =
                    match element.TryGetProperty "dates" with
                    | true, datesElement -> parseDates datesElement
                    | false, _ -> None

                Some(
                    ResumeBlock.Entry
                        { Id = id
                          Title = tryGetString element "title"
                          Organization = tryGetString element "organization"
                          Location = tryGetString element "location"
                          Dates = dates
                          HeadingSourceLines = headingLines
                          Bullets = bullets }
                )
            | Some "skillsGroup", Some id ->
                match element.TryGetProperty "sourceLines" with
                | true, linesElement ->
                    let lines = parseIntList linesElement

                    if List.isEmpty lines then
                        None
                    else
                        Some(
                            ResumeBlock.SkillsGroup
                                { Id = id
                                  Label = tryGetString element "label"
                                  SourceLines = lines }
                        )
                | false, _ -> None
            | Some "bullet", Some id ->
                match element.TryGetProperty "sourceLines" with
                | true, linesElement ->
                    let lines = parseIntList linesElement

                    if List.isEmpty lines then
                        None
                    else
                        Some(ResumeBlock.Bullet { Id = id; SourceLines = lines })
                | false, _ -> None
            | Some _, Some id ->
                match element.TryGetProperty "sourceLines" with
                | true, linesElement ->
                    let lines = parseIntList linesElement

                    if List.isEmpty lines then
                        None
                    else
                        Some(ResumeBlock.Paragraph { Id = id; SourceLines = lines })
                | false, _ -> None
            | _ -> None

    let tryParse (json: string) : ResumeDocument option =
        if String.IsNullOrWhiteSpace json then
            None
        else
            try
                use document = JsonDocument.Parse json
                let root = document.RootElement

                let version =
                    match root.TryGetProperty "version" with
                    | true, versionElement when versionElement.ValueKind = JsonValueKind.Number ->
                        versionElement.GetInt32()
                    | _ -> ResumeDocument.CurrentVersion

                match root.TryGetProperty "header" with
                | false, _ -> None
                | true, headerElement when headerElement.ValueKind <> JsonValueKind.Object -> None
                | true, headerElement ->
                    match headerElement.TryGetProperty "name" with
                    | false, _ -> None
                    | true, nameElement ->
                        match parseSourceNode nameElement with
                        | None -> None
                        | Some name ->
                            let contact =
                                match headerElement.TryGetProperty "contact" with
                                | true, contactElement when contactElement.ValueKind = JsonValueKind.Array ->
                                    contactElement.EnumerateArray()
                                    |> Seq.choose parseSourceNode
                                    |> Seq.toList
                                | _ -> []

                            let sections =
                                match root.TryGetProperty "sections" with
                                | true, sectionsElement when sectionsElement.ValueKind = JsonValueKind.Array ->
                                    sectionsElement.EnumerateArray()
                                    |> Seq.choose (fun sectionElement ->
                                        if sectionElement.ValueKind <> JsonValueKind.Object then
                                            None
                                        else
                                            match tryGetString sectionElement "id" with
                                            | None -> None
                                            | Some sectionId ->
                                                let kind =
                                                    tryGetString sectionElement "kind"
                                                    |> Option.defaultValue "other"

                                                let heading =
                                                    match sectionElement.TryGetProperty "heading" with
                                                    | true, headingElement when
                                                        headingElement.ValueKind = JsonValueKind.Object
                                                        ->
                                                        parseSourceNode headingElement
                                                    | _ -> None

                                                let blocks =
                                                    match sectionElement.TryGetProperty "blocks" with
                                                    | true, blocksElement when
                                                        blocksElement.ValueKind = JsonValueKind.Array
                                                        ->
                                                        blocksElement.EnumerateArray()
                                                        |> Seq.choose parseBlock
                                                        |> Seq.toList
                                                    | _ -> []

                                                Some
                                                    { Id = sectionId
                                                      Kind = kind
                                                      Heading = heading
                                                      Blocks = blocks })
                                    |> Seq.toList
                                | _ -> []

                            Some
                                { Version = version
                                  Header = { Name = name; Contact = contact }
                                  Sections = sections }
            with _ ->
                None
