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
            CREATE TABLE IF NOT EXISTS tailor_runs (
                id TEXT PRIMARY KEY,
                resume_text TEXT NOT NULL,
                job_description TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bullet_changes (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL REFERENCES tailor_runs(id),
                line_index INTEGER NOT NULL,
                original TEXT NOT NULL,
                tailored TEXT NOT NULL,
                decision TEXT NOT NULL DEFAULT 'pending'
            );

            CREATE TABLE IF NOT EXISTS credit_usage (
                id TEXT PRIMARY KEY,
                identity_key TEXT NOT NULL,
                kind TEXT NOT NULL,
                period TEXT NOT NULL,
                used_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_credit_usage_key_period
                ON credit_usage (identity_key, period);
            """
        )
        |> ignore

type SqliteTailorRunRepository(connectionString: string) =

    interface TailorRunRepository with

        member _.SaveRun(run: TailorRun) : Task<unit> =
            task {
                use connection = new SqliteConnection(connectionString)
                do! connection.OpenAsync()
                use transaction = connection.BeginTransaction()

                let (RunId runId) = run.Id

                let! _ =
                    connection.ExecuteAsync(
                        """
                        INSERT INTO tailor_runs (id, resume_text, job_description, created_at)
                        VALUES (@Id, @ResumeText, @JobDescription, @CreatedAt)
                        """,
                        {| Id = string runId
                           ResumeText = run.ResumeText
                           JobDescription = run.JobDescription
                           CreatedAt = run.CreatedAt.ToString("O") |},
                        transaction
                    )

                for change in run.Changes do
                    let (ChangeId changeId) = change.Id

                    let! _ =
                        connection.ExecuteAsync(
                            """
                            INSERT INTO bullet_changes (id, run_id, line_index, original, tailored, decision)
                            VALUES (@Id, @RunId, @LineIndex, @Original, @Tailored, @Decision)
                            """,
                            {| Id = string changeId
                               RunId = string runId
                               LineIndex = change.LineIndex
                               Original = change.Original
                               Tailored = change.Tailored
                               Decision = Decision.toString change.Decision |},
                            transaction
                        )

                    ()

                transaction.Commit()
            }

        member _.UpdateDecision(changeId: ChangeId, decision: Decision) : Task<bool> =
            task {
                use connection = new SqliteConnection(connectionString)
                do! connection.OpenAsync()

                let (ChangeId id) = changeId

                let! affected =
                    connection.ExecuteAsync(
                        "UPDATE bullet_changes SET decision = @Decision WHERE id = @Id",
                        {| Id = string id
                           Decision = Decision.toString decision |}
                    )

                return affected > 0
            }
