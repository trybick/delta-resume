module DeltaResume.Program

open System
open System.Net.Http
open System.Text.Json
open System.Text.Json.Serialization
open Giraffe
open Microsoft.AspNetCore.Authentication.JwtBearer
open Microsoft.AspNetCore.Builder
open Microsoft.Extensions.DependencyInjection
open Microsoft.Extensions.Hosting
open DeltaResume.Api
open DeltaResume.Application
open DeltaResume.Infrastructure

module private Database =
    let normalizeConnectionString (value: string) =
        if value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) then
            "postgresql://" + value.Substring("postgres://".Length)
        else
            value

    let connectionStringFromEnvironment () =
        Environment.GetEnvironmentVariable "DATABASE_URL"
        |> Option.ofObj
        |> Option.filter (String.IsNullOrWhiteSpace >> not)
        |> Option.map normalizeConnectionString
        |> Option.defaultValue "Host=localhost;Database=deltaresume"

[<EntryPoint>]
let main args =
    DotNetEnv.Env.Load() |> ignore

    let connectionString = Database.connectionStringFromEnvironment ()

    Schema.init connectionString

    let clerkAuthority =
        Environment.GetEnvironmentVariable "CLERK_FRONTEND_API_URL"
        |> Option.ofObj
        |> Option.filter (String.IsNullOrWhiteSpace >> not)
        |> Option.map (fun url -> url.TrimEnd '/')

    let corsOrigins =
        Environment.GetEnvironmentVariable "CORS_ORIGINS"
        |> Option.ofObj
        |> Option.filter (String.IsNullOrWhiteSpace >> not)
        |> Option.map (fun value ->
            value.Split(',', StringSplitOptions.RemoveEmptyEntries ||| StringSplitOptions.TrimEntries))
        |> Option.defaultValue [| "http://localhost:5200" |]

    let builder = WebApplication.CreateBuilder(args)

    builder.Services.AddGiraffe() |> ignore

    match clerkAuthority with
    | Some authority ->
        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(fun options ->
                options.Authority <- authority
                options.MapInboundClaims <- false
                options.TokenValidationParameters.ValidateAudience <- false
                options.TokenValidationParameters.ValidIssuer <- authority)
        |> ignore
    | None ->
        eprintfn "Warning: CLERK_FRONTEND_API_URL is not set; all requests are treated as guests."

    builder.Services.AddCors(fun options ->
        options.AddDefaultPolicy(fun policy ->
            policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod() |> ignore))
    |> ignore

    let jsonOptions =
        JsonSerializerOptions(PropertyNamingPolicy = JsonNamingPolicy.CamelCase)

    jsonOptions.Converters.Add(JsonFSharpConverter())

    builder.Services.AddSingleton<Json.ISerializer>(Json.Serializer(jsonOptions))
    |> ignore

    builder.Services.AddSingleton<HttpClient>(fun _ -> new HttpClient(Timeout = TimeSpan.FromSeconds 120.0))
    |> ignore

    builder.Services.AddSingleton<TailoringEngine>(fun provider ->
        AnthropicEngine(provider.GetRequiredService<HttpClient>()) :> TailoringEngine)
    |> ignore

    builder.Services.AddSingleton<CoverLetterEngine>(fun provider ->
        AnthropicCoverLetterEngine(provider.GetRequiredService<HttpClient>()) :> CoverLetterEngine)
    |> ignore

    builder.Services.AddSingleton<TailoringService>() |> ignore

    builder.Services.AddSingleton<CreditStore>(fun _ -> PostgresCreditStore(connectionString) :> CreditStore)
    |> ignore

    let identityOptions = IdentityOptions.fromEnvironment ()

    builder.Services.AddSingleton<IdentityOptions>(identityOptions) |> ignore

    let runningLocally = LocalDev.isRunningLocally ()

    if runningLocally then
        eprintfn "Warning: BACKEND_RUNNING_LOCALLY is set; rate limiting is off and guest credits are unlimited."

    builder.Services.AddSingleton<RateLimiters>(fun _ -> RateLimiters(identityOptions, runningLocally))
    |> ignore

    builder.Services.AddSingleton<CreditService>(fun provider ->
        CreditService(provider.GetRequiredService<CreditStore>(), identityOptions))
    |> ignore

    builder.Services.AddSingleton<SavedResumeRepository>(fun _ ->
        PostgresSavedResumeRepository(connectionString) :> SavedResumeRepository)
    |> ignore

    builder.Services.AddSingleton<SavedResumeService>(fun provider ->
        SavedResumeService(provider.GetRequiredService<SavedResumeRepository>(), identityOptions))
    |> ignore

    let app = builder.Build()

    app.UseCors() |> ignore

    if Option.isSome clerkAuthority then
        app.UseAuthentication() |> ignore

    app.UseGiraffe Routes.webApp

    let port =
        Environment.GetEnvironmentVariable "PORT"
        |> Option.ofObj
        |> Option.defaultValue "5100"

    app.Run($"http://0.0.0.0:{port}")
    0
