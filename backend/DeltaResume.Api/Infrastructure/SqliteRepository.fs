namespace DeltaResume.Infrastructure

open System.IO
open System.Threading.Tasks
open Dapper
open Microsoft.Data.Sqlite
open DeltaResume.Application
open DeltaResume.Domain

module Schema =
    let init (connectionString: string) : unit =
        let builder = SqliteConnectionStringBuilder(connectionString)
        let directory = Path.GetDirectoryName(builder.DataSource)

        if not (System.String.IsNullOrEmpty directory) then
            Directory.CreateDirectory directory |> ignore

        use connection = new SqliteConnection(connectionString)
        connection.Open()

        connection.Execute(
            """
            DROP TABLE IF EXISTS bullet_changes;
            DROP TABLE IF EXISTS tailor_runs;

            CREATE TABLE IF NOT EXISTS credit_usage (
                id TEXT PRIMARY KEY,
                identity_key TEXT NOT NULL,
                kind TEXT NOT NULL,
                period TEXT NOT NULL,
                used_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_credit_usage_key_period
                ON credit_usage (identity_key, period);

            CREATE TABLE IF NOT EXISTS saved_resumes (
                id TEXT PRIMARY KEY,
                owner_key TEXT NOT NULL,
                name TEXT NOT NULL,
                resume_text TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_saved_resumes_owner
                ON saved_resumes (owner_key);
            """
        )
        |> ignore

        let hasStaleLastUsedColumn =
            connection.Query<string>("SELECT name FROM pragma_table_info('saved_resumes')")
            |> Seq.contains "last_used_at"

        if hasStaleLastUsedColumn then
            connection.Execute "ALTER TABLE saved_resumes DROP COLUMN last_used_at" |> ignore

[<CLIMutable>]
type private SavedResumeRow =
    { id: string
      owner_key: string
      name: string
      resume_text: string
      content_hash: string
      created_at: string }

type SqliteSavedResumeRepository(connectionString: string) =

    let toDomain (row: SavedResumeRow) : SavedResume =
        { Id = SavedResumeId(System.Guid.Parse row.id)
          OwnerKey = row.owner_key
          Name = row.name
          ResumeText = row.resume_text
          ContentHash = row.content_hash
          CreatedAt = System.DateTimeOffset.Parse row.created_at }

    interface SavedResumeRepository with

        member _.ListByOwner(ownerKey: string) : Task<SavedResume list> =
            task {
                use connection = new SqliteConnection(connectionString)
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
                use connection = new SqliteConnection(connectionString)
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
                use connection = new SqliteConnection(connectionString)
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
                           CreatedAt = resume.CreatedAt.ToString("O") |}
                    )

                return ()
            }

        member _.Rename(id: SavedResumeId, ownerKey: string, name: string) : Task<bool> =
            task {
                use connection = new SqliteConnection(connectionString)
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
                use connection = new SqliteConnection(connectionString)
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
                use connection = new SqliteConnection(connectionString)
                do! connection.OpenAsync()

                let! _ =
                    connection.ExecuteAsync(
                        """
                        DELETE FROM saved_resumes
                        WHERE owner_key = @OwnerKey
                          AND id NOT IN (
                              SELECT id FROM saved_resumes
                              WHERE owner_key = @OwnerKey
                              ORDER BY created_at DESC
                              LIMIT @KeepCount
                          )
                        """,
                        {| OwnerKey = ownerKey
                           KeepCount = keepCount |}
                    )

                return ()
            }
