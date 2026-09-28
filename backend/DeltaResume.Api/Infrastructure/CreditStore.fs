namespace DeltaResume.Infrastructure

open System
open System.Threading
open System.Threading.Tasks
open Dapper
open Npgsql
open DeltaResume.Application
open DeltaResume.Domain

type PostgresCreditStore(connectionString: string) =

    let lockKey (counter: CreditCounter) : string =
        match counter with
        | ByUser(userId, period) -> sprintf "user:%s:%s" userId (UsagePeriod.toString period)
        | ByFingerprint fingerprint -> sprintf "fp:%s" fingerprint
        | ByGuestIp ipHash -> sprintf "ip:%s" ipHash

    let countCommand (counter: CreditCounter) (transaction: NpgsqlTransaction) (cancellationToken: CancellationToken) =
        let condition, value, period =
            match counter with
            | ByUser(userId, period) -> "user_id = @Value", userId, period
            | ByFingerprint fingerprint -> "fingerprint = @Value", fingerprint, Lifetime
            | ByGuestIp ipHash -> "ip_hash = @Value AND user_id IS NULL", ipHash, Lifetime

        CommandDefinition(
            $"SELECT COUNT(*)::int FROM credit_usage WHERE {condition} AND period = @Period AND status = @Status",
            {| Value = value
               Period = UsagePeriod.toString period
               Status = CreditUsageStatus.RecordedValue |},
            transaction,
            cancellationToken = cancellationToken
        )

    let maxUsage
        (connection: NpgsqlConnection)
        (transaction: NpgsqlTransaction)
        (counters: CreditCounter list)
        (cancellationToken: CancellationToken)
        : Task<int> =
        task {
            let mutable used = 0

            for counter in counters do
                let! count = connection.ExecuteScalarAsync<int>(countCommand counter transaction cancellationToken)
                used <- max used count

            return used
        }

    interface CreditStore with

        member _.CountUsage(counters: CreditCounter list, cancellationToken: CancellationToken) : Task<int> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)
                return! maxUsage connection null counters cancellationToken
            }

        member _.TryRecordUsage
            (charge: CreditCharge, counters: CreditCounter list, creditLimit: int, cancellationToken: CancellationToken)
            : Task<CreditSpendResult> =
            task {
                use connection = new NpgsqlConnection(connectionString)
                do! connection.OpenAsync(cancellationToken)
                let! transactionValue = connection.BeginTransactionAsync(cancellationToken)
                use transaction = transactionValue

                for key in counters |> List.map lockKey |> List.distinct |> List.sort do
                    let! _ =
                        connection.ExecuteAsync(
                            CommandDefinition(
                                "SELECT pg_advisory_xact_lock(hashtextextended(@LockKey, 0))",
                                {| LockKey = key |},
                                transaction,
                                cancellationToken = cancellationToken
                            )
                        )

                    ()

                let! used = maxUsage connection transaction counters cancellationToken

                if used >= creditLimit then
                    do! transaction.RollbackAsync(cancellationToken)
                    return SpendExhausted
                else
                    let operationId = OperationId.create ()

                    let! _ =
                        connection.ExecuteAsync(
                            CommandDefinition(
                                """
                                INSERT INTO credit_usage
                                    (id, user_id, email, plan, period, feature, status,
                                     ip_hash, fingerprint, user_agent, run_id, used_at)
                                VALUES
                                    (@Id, @UserId, @Email, @Plan, @Period, @Feature, @Status,
                                     @IpHash, @Fingerprint, @UserAgent, @RunId, @UsedAt)
                                """,
                                {| Id = OperationId.value operationId
                                   UserId = charge.UserId |> Option.toObj
                                   Email = charge.Email |> Option.toObj
                                   Plan = CreditPlan.toString charge.Plan
                                   Period = UsagePeriod.toString charge.Period
                                   Feature = CreditFeature.toString charge.Feature
                                   Status = CreditUsageStatus.RecordedValue
                                   IpHash = charge.IpHash
                                   Fingerprint = charge.Fingerprint |> Option.toObj
                                   UserAgent = charge.UserAgent |> Option.toObj
                                   RunId = charge.RunId |> Option.toNullable
                                   UsedAt = DateTimeOffset.UtcNow |},
                                transaction,
                                cancellationToken = cancellationToken
                            )
                        )

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
                            WHERE id = @OperationId
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
                            WHERE id = @OperationId
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
