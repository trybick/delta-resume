namespace DeltaResume.Infrastructure

open System
open System.Threading
open System.Threading.Tasks
open Dapper
open Npgsql
open DeltaResume.Application
open DeltaResume.Domain

type PostgresCreditStore(connectionString: string) =

    interface CreditStore with

        member _.CountUsage
            (identityKey: OwnerKey, period: UsagePeriod, cancellationToken: CancellationToken)
            : Task<int> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)

                return!
                    connection.ExecuteScalarAsync<int>(
                        CommandDefinition(
                            """
                            SELECT COUNT(*)::int
                            FROM credit_usage
                            WHERE identity_key = @IdentityKey
                              AND period = @Period
                              AND status = @Status
                            """,
                            {| IdentityKey = OwnerKey.value identityKey
                               Period = UsagePeriod.toString period
                               Status = CreditUsageStatus.RecordedValue |},
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
                    |> List.map (fun entry ->
                        sprintf "%s:%s" (OwnerKey.value entry.IdentityKey) (UsagePeriod.toString entry.Period))
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
                                WHERE identity_key = @IdentityKey
                                  AND period = @Period
                                  AND status = @Status
                                """,
                                {| IdentityKey = OwnerKey.value entry.IdentityKey
                                   Period = UsagePeriod.toString entry.Period
                                   Status = CreditUsageStatus.RecordedValue |},
                                transaction,
                                cancellationToken = cancellationToken
                            )
                        )

                    used <- max used count

                if used >= creditLimit then
                    do! transaction.RollbackAsync(cancellationToken)
                    return SpendExhausted
                else
                    let operationId = OperationId.create ()
                    let usedAt = DateTimeOffset.UtcNow

                    for entry in entries do
                        let! _ =
                            connection.ExecuteAsync(
                                CommandDefinition(
                                    """
                                    INSERT INTO credit_usage
                                        (id, identity_key, kind, period, used_at, operation_id, email,
                                         plan, feature, ip_hash, fingerprint, user_agent, status, run_id)
                                    VALUES
                                        (@Id, @IdentityKey, @Kind, @Period, @UsedAt, @OperationId, @Email,
                                         @Plan, @Feature, @IpHash, @Fingerprint, @UserAgent, @Status, @RunId)
                                    """,
                                    {| Id = Guid.NewGuid()
                                       IdentityKey = OwnerKey.value entry.IdentityKey
                                       Kind = CreditKind.toString entry.Kind
                                       Period = UsagePeriod.toString entry.Period
                                       UsedAt = usedAt
                                       OperationId = OperationId.value operationId
                                       Email = entry.Email |> Option.toObj
                                       Plan = CreditPlan.toString entry.Plan
                                       Feature = CreditFeature.toString entry.Feature
                                       IpHash = entry.IpHash
                                       Fingerprint = entry.Fingerprint |> Option.toObj
                                       UserAgent = entry.UserAgent |> Option.toObj
                                       Status = CreditUsageStatus.RecordedValue
                                       RunId = entry.RunId |> Option.toNullable |},
                                    transaction,
                                    cancellationToken = cancellationToken
                                )
                            )

                        ()

                    do! transaction.CommitAsync(cancellationToken)
                    return SpendRecorded operationId
            }

        member _.MarkRefunded
            (operationId: OperationId, cancellationToken: CancellationToken)
            : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)

                let! _ =
                    connection.ExecuteAsync(
                        CommandDefinition(
                            """
                            UPDATE credit_usage
                            SET status = @RefundedStatus
                            WHERE operation_id = @OperationId
                              AND status = @RecordedStatus
                            """,
                            {| OperationId = OperationId.value operationId
                               RefundedStatus = CreditUsageStatus.RefundedValue
                               RecordedStatus = CreditUsageStatus.RecordedValue |},
                            cancellationToken = cancellationToken
                        )
                    )

                return ()
            }

        member _.RecordResumeOutcome
            (operationId: OperationId, outcome: CreditUsageOutcome, cancellationToken: CancellationToken)
            : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)

                let! _ =
                    connection.ExecuteAsync(
                        CommandDefinition(
                            """
                            UPDATE credit_usage
                            SET resume_input_tokens = @InputTokens,
                                resume_output_tokens = @OutputTokens,
                                resume_duration_ms = @DurationMs
                            WHERE operation_id = @OperationId
                            """,
                            {| OperationId = OperationId.value operationId
                               InputTokens = outcome.InputTokens |> Option.toNullable
                               OutputTokens = outcome.OutputTokens |> Option.toNullable
                               DurationMs = outcome.DurationMs |},
                            cancellationToken = cancellationToken
                        )
                    )

                return ()
            }

        member _.RecordCoverLetterOutcome
            (runId: Guid, outcome: CreditUsageOutcome, cancellationToken: CancellationToken)
            : Task<unit> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)

                let! _ =
                    connection.ExecuteAsync(
                        CommandDefinition(
                            """
                            UPDATE credit_usage
                            SET cover_letter_input_tokens = @InputTokens,
                                cover_letter_output_tokens = @OutputTokens,
                                cover_letter_duration_ms = @DurationMs
                            WHERE run_id = @RunId
                            """,
                            {| RunId = runId
                               InputTokens = outcome.InputTokens |> Option.toNullable
                               OutputTokens = outcome.OutputTokens |> Option.toNullable
                               DurationMs = outcome.DurationMs |},
                            cancellationToken = cancellationToken
                        )
                    )

                return ()
            }
