namespace ResumeTailor.Infrastructure

open System
open System.Threading.Tasks
open Dapper
open Microsoft.Data.Sqlite
open ResumeTailor.Application

type SqliteCreditStore(connectionString: string) =

    interface CreditStore with

        member _.CountUsage(identityKey: string, period: string) : Task<int> =
            task {
                use connection = new SqliteConnection(connectionString)
                do! connection.OpenAsync()

                return!
                    connection.ExecuteScalarAsync<int>(
                        "SELECT COUNT(*) FROM credit_usage WHERE identity_key = @IdentityKey AND period = @Period",
                        {| IdentityKey = identityKey
                           Period = period |}
                    )
            }

        member _.RecordUsage(entries: CreditUsageEntry list) : Task<unit> =
            task {
                use connection = new SqliteConnection(connectionString)
                do! connection.OpenAsync()
                use transaction = connection.BeginTransaction()

                for entry in entries do
                    let! _ =
                        connection.ExecuteAsync(
                            """
                            INSERT INTO credit_usage (id, identity_key, kind, period, used_at)
                            VALUES (@Id, @IdentityKey, @Kind, @Period, @UsedAt)
                            """,
                            {| Id = string (Guid.NewGuid())
                               IdentityKey = entry.IdentityKey
                               Kind = entry.Kind
                               Period = entry.Period
                               UsedAt = DateTime.UtcNow.ToString "O" |},
                            transaction
                        )

                    ()

                transaction.Commit()
            }
