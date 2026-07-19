namespace DeltaResume.Infrastructure

open System
open System.Threading.Tasks
open Dapper
open Npgsql
open DeltaResume.Application
open DeltaResume.Domain

module Schema =
    let init (connectionString: string) : unit =
        use connection = new NpgsqlConnection(connectionString)
        connection.Open()

        connection.Execute(
            """
            CREATE TABLE IF NOT EXISTS credit_usage (
                id TEXT PRIMARY KEY,
                identity_key TEXT NOT NULL,
                kind TEXT NOT NULL,
                period TEXT NOT NULL,
                used_at TIMESTAMPTZ NOT NULL,
                operation_id TEXT
            );

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS operation_id TEXT;

            CREATE INDEX IF NOT EXISTS idx_credit_usage_key_period
                ON credit_usage (identity_key, period);

            CREATE INDEX IF NOT EXISTS idx_credit_usage_operation
                ON credit_usage (operation_id);

            DROP TABLE IF EXISTS credit_operations;

            CREATE TABLE IF NOT EXISTS saved_resumes (
                id TEXT PRIMARY KEY,
                owner_key TEXT NOT NULL,
                name TEXT NOT NULL,
                resume_text TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_saved_resumes_owner
                ON saved_resumes (owner_key);

            CREATE TABLE IF NOT EXISTS user_settings (
                owner_key TEXT PRIMARY KEY,
                settings JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );
            """
        )
        |> ignore

type DatabaseHealthCheck(connectionString: string) =

    member _.Check(cancellationToken: Threading.CancellationToken) : Task<unit> =
        task {
            use connection = new NpgsqlConnection(connectionString)
            do! connection.OpenAsync(cancellationToken)
            use command = new NpgsqlCommand("SELECT 1", connection)
            let! result = command.ExecuteScalarAsync(cancellationToken)

            if Convert.ToInt32(result) <> 1 then
                invalidOp "Database health check returned an unexpected result."
        }

type PostgresUserSettingsRepository(connectionString: string) =

    let serialize (settings: UserSettings) : string =
        System.Text.Json.JsonSerializer.Serialize
            {| coverLetter =
                {| length = settings.CoverLetter.Length
                   tone = settings.CoverLetter.Tone |} |}

    let parse (json: string) : UserSettings =
        let defaults = UserSettings.defaults

        try
            use document = System.Text.Json.JsonDocument.Parse json

            let readString (parent: System.Text.Json.JsonElement) (name: string) (fallback: string) =
                match parent.TryGetProperty name with
                | true, element when element.ValueKind = System.Text.Json.JsonValueKind.String ->
                    element.GetString() |> Option.ofObj |> Option.defaultValue fallback
                | _ -> fallback

            match document.RootElement.TryGetProperty "coverLetter" with
            | true, coverLetter when coverLetter.ValueKind = System.Text.Json.JsonValueKind.Object ->
                { CoverLetter =
                    { Length = readString coverLetter "length" defaults.CoverLetter.Length
                      Tone = readString coverLetter "tone" defaults.CoverLetter.Tone } }
            | _ -> defaults
        with _ ->
            defaults

    interface UserSettingsRepository with

        member _.Get(ownerKey: string) : Task<UserSettings option> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let! rows =
                    connection.QueryAsync<string>(
                        "SELECT settings::text FROM user_settings WHERE owner_key = @OwnerKey",
                        {| OwnerKey = ownerKey |}
                    )

                return rows |> Seq.tryHead |> Option.map parse
            }

        member _.Upsert(ownerKey: string, settings: UserSettings) : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let! _ =
                    connection.ExecuteAsync(
                        """
                        INSERT INTO user_settings (owner_key, settings, updated_at)
                        VALUES (@OwnerKey, CAST(@Settings AS jsonb), @UpdatedAt)
                        ON CONFLICT (owner_key) DO UPDATE
                            SET settings = EXCLUDED.settings, updated_at = EXCLUDED.updated_at
                        """,
                        {| OwnerKey = ownerKey
                           Settings = serialize settings
                           UpdatedAt = DateTimeOffset.UtcNow |}
                    )

                return ()
            }

[<CLIMutable>]
type private SavedResumeRow =
    { id: string
      owner_key: string
      name: string
      resume_text: string
      content_hash: string
      created_at: DateTimeOffset }

type PostgresSavedResumeRepository(connectionString: string) =

    let toDomain (row: SavedResumeRow) : SavedResume =
        { Id = SavedResumeId(Guid.Parse row.id)
          OwnerKey = row.owner_key
          Name = row.name
          ResumeText = row.resume_text
          ContentHash = row.content_hash
          CreatedAt = row.created_at }

    interface SavedResumeRepository with

        member _.ListByOwner(ownerKey: string) : Task<SavedResume list> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let! rows =
                    connection.QueryAsync<SavedResumeRow>(
                        """
                        SELECT id, owner_key, name, resume_text, content_hash, created_at
                        FROM saved_resumes
                        WHERE owner_key = @OwnerKey
                        ORDER BY created_at DESC
                        """,
                        {| OwnerKey = ownerKey |}
                    )

                return rows |> Seq.map toDomain |> List.ofSeq
            }

        member _.FindByHash(ownerKey: string, contentHash: string) : Task<SavedResume option> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let! rows =
                    connection.QueryAsync<SavedResumeRow>(
                        """
                        SELECT id, owner_key, name, resume_text, content_hash, created_at
                        FROM saved_resumes
                        WHERE owner_key = @OwnerKey AND content_hash = @ContentHash
                        LIMIT 1
                        """,
                        {| OwnerKey = ownerKey
                           ContentHash = contentHash |}
                    )

                return rows |> Seq.tryHead |> Option.map toDomain
            }

        member _.Insert(resume: SavedResume) : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let (SavedResumeId id) = resume.Id

                let! _ =
                    connection.ExecuteAsync(
                        """
                        INSERT INTO saved_resumes (id, owner_key, name, resume_text, content_hash, created_at)
                        VALUES (@Id, @OwnerKey, @Name, @ResumeText, @ContentHash, @CreatedAt)
                        """,
                        {| Id = string id
                           OwnerKey = resume.OwnerKey
                           Name = resume.Name
                           ResumeText = resume.ResumeText
                           ContentHash = resume.ContentHash
                           CreatedAt = resume.CreatedAt |}
                    )

                return ()
            }

        member _.Rename(id: SavedResumeId, ownerKey: string, name: string) : Task<bool> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let (SavedResumeId resumeId) = id

                let! affected =
                    connection.ExecuteAsync(
                        "UPDATE saved_resumes SET name = @Name WHERE id = @Id AND owner_key = @OwnerKey",
                        {| Id = string resumeId
                           OwnerKey = ownerKey
                           Name = name |}
                    )

                return affected > 0
            }

        member _.Delete(id: SavedResumeId, ownerKey: string) : Task<bool> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let (SavedResumeId resumeId) = id

                let! affected =
                    connection.ExecuteAsync(
                        "DELETE FROM saved_resumes WHERE id = @Id AND owner_key = @OwnerKey",
                        {| Id = string resumeId
                           OwnerKey = ownerKey |}
                    )

                return affected > 0
            }

        member _.DeleteLeastRecentlyUsed(ownerKey: string, keepCount: int) : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let! _ =
                    connection.ExecuteAsync(
                        """
                        DELETE FROM saved_resumes
                        WHERE id IN (
                            SELECT id FROM saved_resumes
                            WHERE owner_key = @OwnerKey
                            ORDER BY created_at DESC
                            OFFSET @KeepCount
                        )
                        """,
                        {| OwnerKey = ownerKey
                           KeepCount = keepCount |}
                    )

                return ()
            }
