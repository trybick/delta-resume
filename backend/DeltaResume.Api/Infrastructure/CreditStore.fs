namespace DeltaResume.Infrastructure

open System
open System.Threading
open System.Threading.Tasks
open Dapper
open Npgsql
open DeltaResume.Application

type PostgresCreditStore(connectionString: string) =

    interface CreditStore with

        member _.CountUsage
            (identityKey: string, period: string, cancellationToken: CancellationToken)
            : Task<int> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)

                return!
                    connection.ExecuteScalarAsync<int>(
                        CommandDefinition(
                        "SELECT COUNT(*)::int FROM credit_usage WHERE identity_key = @IdentityKey AND period = @Period",
                        {| IdentityKey = identityKey
                           Period = period |},
                        cancellationToken = cancellationToken
                        )
                    )
            }

        member _.TryRecordUsage
            (entries: CreditUsageEntry list, creditLimit: int, cancellationToken: CancellationToken)
            : Task<CreditSpendResult> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)
                let! transactionValue = connection.BeginTransactionAsync(cancellationToken)
                use transaction = transactionValue

                let lockKeys =
                    entries
                    |> List.map (fun entry -> sprintf "%s:%s" entry.IdentityKey entry.Period)
                    |> List.distinct
                    |> List.sort

                for lockKey in lockKeys do
                    let! _ =
                        connection.ExecuteAsync(
                            CommandDefinition(
                                "SELECT pg_advisory_xact_lock(hashtextextended(@LockKey, 0))",
                                {| LockKey = lockKey |},
                                transaction,
                                cancellationToken = cancellationToken
                            )
                        )

                    ()

                let mutable used = 0

                for entry in entries do
                    let! count =
                        connection.ExecuteScalarAsync<int>(
                            CommandDefinition(
                                """
                                SELECT COUNT(*)::int
                                FROM credit_usage
                                WHERE identity_key = @IdentityKey AND period = @Period
                                """,
                                {| IdentityKey = entry.IdentityKey
                                   Period = entry.Period |},
                                transaction,
                                cancellationToken = cancellationToken
                            )
                        )

                    used <- max used count

                if used >= creditLimit then
                    do! transaction.RollbackAsync(cancellationToken)
                    return SpendExhausted
                else
                    let operationId = string (Guid.NewGuid())
                    let usedAt = DateTimeOffset.UtcNow

                    for entry in entries do
                        let! _ =
                            connection.ExecuteAsync(
                                CommandDefinition(
                                    """
                                    INSERT INTO credit_usage
                                        (id, identity_key, kind, period, used_at, operation_id)
                                    VALUES
                                        (@Id, @IdentityKey, @Kind, @Period, @UsedAt, @OperationId)
                                    """,
                                    {| Id = string (Guid.NewGuid())
                                       IdentityKey = entry.IdentityKey
                                       Kind = entry.Kind
                                       Period = entry.Period
                                       UsedAt = usedAt
                                       OperationId = operationId |},
                                    transaction,
                                    cancellationToken = cancellationToken
                                )
                            )

                        ()

                    do! transaction.CommitAsync(cancellationToken)
                    return SpendRecorded operationId
            }

        member _.DeleteUsageByOperation
            (operationId: string, cancellationToken: CancellationToken)
            : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)

                let! _ =
                    connection.ExecuteAsync(
                        CommandDefinition(
                            "DELETE FROM credit_usage WHERE operation_id = @OperationId",
                            {| OperationId = operationId |},
                            cancellationToken = cancellationToken
                        )
                    )

                return ()
            }
