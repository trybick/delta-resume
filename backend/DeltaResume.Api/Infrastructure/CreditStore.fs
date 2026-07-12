namespace DeltaResume.Infrastructure

open System
open System.Threading.Tasks
open Dapper
open Npgsql
open DeltaResume.Application

type PostgresCreditStore(connectionString: string) =

    interface CreditStore with

        member _.CountUsage(identityKey: string, period: string) : Task<int> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync()

                return!
                    connection.ExecuteScalarAsync<int>(
                        "SELECT COUNT(*)::int FROM credit_usage WHERE identity_key = @IdentityKey AND period = @Period",
                        {| IdentityKey = identityKey
                           Period = period |}
                    )
            }

        member _.RecordUsage(entries: CreditUsageEntry list) : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
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
                               UsedAt = DateTime.UtcNow |},
                            transaction
                        )

                    ()

                transaction.Commit()
            }
