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

        // Existing DBs ignore CREATE TABLE IF NOT EXISTS; new columns need ALTER + backfill.
        connection.Execute(
            """
            CREATE TABLE IF NOT EXISTS credit_usage (
                id UUID PRIMARY KEY,
                identity_key TEXT NOT NULL,
                kind TEXT NOT NULL,
                period TEXT NOT NULL,
                used_at TIMESTAMPTZ NOT NULL,
                operation_id UUID NOT NULL,
                email TEXT,
                plan TEXT,
                feature TEXT,
                ip_hash TEXT,
                fingerprint TEXT,
                user_agent TEXT,
                status TEXT NOT NULL DEFAULT 'recorded',
                run_id UUID,
                resume_input_tokens INTEGER,
                resume_output_tokens INTEGER,
                resume_duration_ms INTEGER,
                cover_letter_input_tokens INTEGER,
                cover_letter_output_tokens INTEGER,
                cover_letter_duration_ms INTEGER
            );

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS operation_id UUID;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS email TEXT;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS plan TEXT;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS feature TEXT;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS ip_hash TEXT;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS fingerprint TEXT;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS user_agent TEXT;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS status TEXT;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS run_id UUID;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS resume_input_tokens INTEGER;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS resume_output_tokens INTEGER;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS resume_duration_ms INTEGER;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS cover_letter_input_tokens INTEGER;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS cover_letter_output_tokens INTEGER;

            ALTER TABLE credit_usage
                ADD COLUMN IF NOT EXISTS cover_letter_duration_ms INTEGER;

            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'credit_usage' AND column_name = 'input_tokens'
                ) THEN
                    UPDATE credit_usage
                    SET resume_input_tokens = COALESCE(resume_input_tokens, input_tokens);
                    ALTER TABLE credit_usage DROP COLUMN input_tokens;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'credit_usage' AND column_name = 'output_tokens'
                ) THEN
                    UPDATE credit_usage
                    SET resume_output_tokens = COALESCE(resume_output_tokens, output_tokens);
                    ALTER TABLE credit_usage DROP COLUMN output_tokens;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'credit_usage' AND column_name = 'duration_ms'
                ) THEN
                    UPDATE credit_usage
                    SET resume_duration_ms = COALESCE(resume_duration_ms, duration_ms);
                    ALTER TABLE credit_usage DROP COLUMN duration_ms;
                END IF;
            END $$;

            UPDATE credit_usage
            SET status = 'recorded'
            WHERE status IS NULL;

            ALTER TABLE credit_usage
                ALTER COLUMN status SET DEFAULT 'recorded';

            ALTER TABLE credit_usage
                ALTER COLUMN status SET NOT NULL;

            CREATE INDEX IF NOT EXISTS idx_credit_usage_key_period
                ON credit_usage (identity_key, period);

            CREATE INDEX IF NOT EXISTS idx_credit_usage_key_period_recorded
                ON credit_usage (identity_key, period)
                WHERE status = 'recorded';

            CREATE INDEX IF NOT EXISTS idx_credit_usage_operation
                ON credit_usage (operation_id);

            CREATE INDEX IF NOT EXISTS idx_credit_usage_used_at
                ON credit_usage (used_at);

            CREATE INDEX IF NOT EXISTS idx_credit_usage_email
                ON credit_usage (email);

            CREATE INDEX IF NOT EXISTS idx_credit_usage_ip_hash
                ON credit_usage (ip_hash);

            CREATE INDEX IF NOT EXISTS idx_credit_usage_status
                ON credit_usage (status);

            CREATE INDEX IF NOT EXISTS idx_credit_usage_run_id
                ON credit_usage (run_id);

            CREATE TABLE IF NOT EXISTS saved_resumes (
                id UUID PRIMARY KEY,
                owner_key TEXT NOT NULL,
                name TEXT NOT NULL,
                resume_text TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                resume_document JSONB,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );

            ALTER TABLE saved_resumes
                ADD COLUMN IF NOT EXISTS resume_document JSONB;

            ALTER TABLE saved_resumes
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

            UPDATE saved_resumes
            SET updated_at = created_at
            WHERE updated_at IS NULL;

            ALTER TABLE saved_resumes
                ALTER COLUMN updated_at SET DEFAULT now();

            ALTER TABLE saved_resumes
                ALTER COLUMN updated_at SET NOT NULL;

            CREATE INDEX IF NOT EXISTS idx_saved_resumes_owner
                ON saved_resumes (owner_key);

            -- Drop older duplicates so the unique index can be created on existing data.
            DELETE FROM saved_resumes a
            USING saved_resumes b
            WHERE a.owner_key = b.owner_key
              AND a.content_hash = b.content_hash
              AND (
                    a.updated_at < b.updated_at
                    OR (a.updated_at = b.updated_at AND a.created_at < b.created_at)
                    OR (a.updated_at = b.updated_at AND a.created_at = b.created_at AND a.id::text < b.id::text)
                  );

            -- Auto-save treats (owner, content hash) as unique; without this two
            -- concurrent tailor runs on the same resume would both insert.
            CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_resumes_owner_hash
                ON saved_resumes (owner_key, content_hash);

            CREATE TABLE IF NOT EXISTS user_settings (
                owner_key TEXT PRIMARY KEY,
                settings JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );

            -- Older installs used TEXT uuid strings; Dapper now maps these to Guid.
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'saved_resumes'
                      AND column_name = 'id'
                      AND data_type = 'text'
                ) THEN
                    ALTER TABLE saved_resumes
                        ALTER COLUMN id TYPE uuid USING id::uuid;
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'credit_usage'
                      AND column_name = 'id'
                      AND data_type = 'text'
                ) THEN
                    ALTER TABLE credit_usage
                        ALTER COLUMN id TYPE uuid USING id::uuid;
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'credit_usage'
                      AND column_name = 'operation_id'
                      AND data_type = 'text'
                ) THEN
                    ALTER TABLE credit_usage
                        ALTER COLUMN operation_id TYPE uuid USING operation_id::uuid;
                END IF;
            END $$;
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
                {| length = CoverLetterLength.toString settings.CoverLetter.Length
                   tone = CoverLetterTone.toString settings.CoverLetter.Tone |} |}

    let parse (json: string) : UserSettings =
        let defaults = UserSettings.defaults

        try
            use document = System.Text.Json.JsonDocument.Parse json

            let readString (parent: System.Text.Json.JsonElement) (name: string) =
                match parent.TryGetProperty name with
                | true, element when element.ValueKind = System.Text.Json.JsonValueKind.String ->
                    element.GetString() |> Option.ofObj
                | _ -> None

            match document.RootElement.TryGetProperty "coverLetter" with
            | true, coverLetter when coverLetter.ValueKind = System.Text.Json.JsonValueKind.Object ->
                let length =
                    readString coverLetter "length"
                    |> Option.bind CoverLetterLength.tryParse
                    |> Option.defaultValue defaults.CoverLetter.Length

                let tone =
                    readString coverLetter "tone"
                    |> Option.bind CoverLetterTone.tryParse
                    |> Option.defaultValue defaults.CoverLetter.Tone

                { CoverLetter = { Length = length; Tone = tone } }
            | _ -> defaults
        with _ ->
            defaults

    interface UserSettingsRepository with

        member _.Get(ownerKey: OwnerKey) : Task<UserSettings option> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let! rows =
                    connection.QueryAsync<string>(
                        "SELECT settings::text FROM user_settings WHERE owner_key = @OwnerKey",
                        {| OwnerKey = OwnerKey.value ownerKey |}
                    )

                return rows |> Seq.tryHead |> Option.map parse
            }

        member _.Upsert(ownerKey: OwnerKey, settings: UserSettings) : Task<unit> =
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
                        {| OwnerKey = OwnerKey.value ownerKey
                           Settings = serialize settings
                           UpdatedAt = DateTimeOffset.UtcNow |}
                    )

                return ()
            }

[<CLIMutable>]
type private SavedResumeRow =
    { id: Guid
      owner_key: string
      name: string
      resume_text: string
      resume_document: string
      content_hash: string
      created_at: DateTimeOffset
      updated_at: DateTimeOffset }

type PostgresSavedResumeRepository(connectionString: string) =

    let selectColumns =
        "id, owner_key, name, resume_text, resume_document::text AS resume_document, \
         content_hash, created_at, updated_at"

    let toDomain (row: SavedResumeRow) : SavedResume =
        { Id = SavedResumeId row.id
          OwnerKey = OwnerKey.ofPersisted row.owner_key
          Name = row.name
          ResumeText = row.resume_text
          ResumeDocument =
            if isNull row.resume_document then
                None
            else
                ResumeDocumentJson.tryParse row.resume_document
          ContentHash = row.content_hash
          CreatedAt = row.created_at
          UpdatedAt = row.updated_at }

    interface SavedResumeRepository with

        member _.ListByOwner(ownerKey: OwnerKey) : Task<SavedResume list> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let! rows =
                    connection.QueryAsync<SavedResumeRow>(
                        $"SELECT {selectColumns} FROM saved_resumes \
                          WHERE owner_key = @OwnerKey ORDER BY updated_at DESC",
                        {| OwnerKey = OwnerKey.value ownerKey |}
                    )

                return rows |> Seq.map toDomain |> List.ofSeq
            }

        member _.FindByHash(ownerKey: OwnerKey, contentHash: string) : Task<SavedResume option> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let! rows =
                    connection.QueryAsync<SavedResumeRow>(
                        $"SELECT {selectColumns} FROM saved_resumes \
                          WHERE owner_key = @OwnerKey AND content_hash = @ContentHash LIMIT 1",
                        {| OwnerKey = OwnerKey.value ownerKey
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
                        INSERT INTO saved_resumes
                            (id, owner_key, name, resume_text, resume_document, content_hash, created_at, updated_at)
                        VALUES
                            (@Id, @OwnerKey, @Name, @ResumeText, CAST(@ResumeDocument AS jsonb), @ContentHash,
                             @CreatedAt, @UpdatedAt)
                        ON CONFLICT (owner_key, content_hash) DO NOTHING
                        """,
                        {| Id = id
                           OwnerKey = OwnerKey.value resume.OwnerKey
                           Name = resume.Name
                           ResumeText = resume.ResumeText
                           ResumeDocument =
                            resume.ResumeDocument
                            |> Option.map ResumeDocumentJson.serialize
                            |> Option.toObj
                           ContentHash = resume.ContentHash
                           CreatedAt = resume.CreatedAt
                           UpdatedAt = resume.UpdatedAt |}
                    )

                return ()
            }

        member _.UpdateDocument
            (id: SavedResumeId, ownerKey: OwnerKey, document: ResumeDocument option)
            : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let (SavedResumeId resumeId) = id

                let! _ =
                    connection.ExecuteAsync(
                        """
                        UPDATE saved_resumes
                        SET resume_document = CAST(@ResumeDocument AS jsonb), updated_at = @UpdatedAt
                        WHERE id = @Id AND owner_key = @OwnerKey
                        """,
                        {| Id = resumeId
                           OwnerKey = OwnerKey.value ownerKey
                           UpdatedAt = DateTimeOffset.UtcNow
                           ResumeDocument =
                            document
                            |> Option.map ResumeDocumentJson.serialize
                            |> Option.toObj |}
                    )

                return ()
            }

        member _.Rename(id: SavedResumeId, ownerKey: OwnerKey, name: string) : Task<bool> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let (SavedResumeId resumeId) = id

                let! affected =
                    connection.ExecuteAsync(
                        """
                        UPDATE saved_resumes
                        SET name = @Name, updated_at = @UpdatedAt
                        WHERE id = @Id AND owner_key = @OwnerKey
                        """,
                        {| Id = resumeId
                           OwnerKey = OwnerKey.value ownerKey
                           UpdatedAt = DateTimeOffset.UtcNow
                           Name = name |}
                    )

                return affected > 0
            }

        member _.Delete(id: SavedResumeId, ownerKey: OwnerKey) : Task<bool> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                let (SavedResumeId resumeId) = id

                let! affected =
                    connection.ExecuteAsync(
                        "DELETE FROM saved_resumes WHERE id = @Id AND owner_key = @OwnerKey",
                        {| Id = resumeId
                           OwnerKey = OwnerKey.value ownerKey |}
                    )

                return affected > 0
            }

        member _.DeleteLeastRecentlyUsed(ownerKey: OwnerKey, keepCount: int) : Task<unit> =
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
                            ORDER BY updated_at DESC, created_at DESC
                            OFFSET @KeepCount
                        )
                        """,
                        {| OwnerKey = OwnerKey.value ownerKey
                           KeepCount = keepCount |}
                    )

                return ()
            }
