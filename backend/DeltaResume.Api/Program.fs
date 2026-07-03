module DeltaResume.Program

open System
open System.IO
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

let private webApp: HttpHandler =
    choose
        [ GET >=> route "/api/health" >=> Handlers.health
          GET >=> route "/api/credits" >=> Handlers.credits
          POST >=> route "/api/tailor" >=> Handlers.tailor
          PATCH >=> routef "/api/changes/%s" Handlers.updateDecision
          setStatusCode 404 >=> json {| Message = "Not found" |} ]

[<EntryPoint>]
let main args =
    let dbPath =
        Environment.GetEnvironmentVariable "DB_PATH"
        |> Option.ofObj
        |> Option.defaultValue (Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data", "delta-resume.db"))

    let connectionString = sprintf "Data Source=%s" (Path.GetFullPath dbPath)

    Schema.init connectionString

    let clerkAuthority =
        Environment.GetEnvironmentVariable "CLERK_FRONTEND_API_URL"
        |> Option.ofObj
        |> Option.filter (String.IsNullOrWhiteSpace >> not)
        |> Option.map (fun url -> url.TrimEnd '/')

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
            policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod() |> ignore))
    |> ignore

    let jsonOptions =
        JsonSerializerOptions(PropertyNamingPolicy = JsonNamingPolicy.CamelCase)

    jsonOptions.Converters.Add(JsonFSharpConverter())

    builder.Services.AddSingleton<Json.ISerializer>(Json.Serializer(jsonOptions))
    |> ignore

    builder.Services.AddSingleton<HttpClient>(fun _ -> new HttpClient(Timeout = TimeSpan.FromSeconds 120.0))
    |> ignore

    builder.Services.AddSingleton<AnthropicOptions>(fun _ -> AnthropicOptions.fromEnvironment ())
    |> ignore

    builder.Services.AddSingleton<TailorRunRepository>(fun _ ->
        SqliteTailorRunRepository(connectionString) :> TailorRunRepository)
    |> ignore

    builder.Services.AddSingleton<TailoringEngine>(fun provider ->
        AnthropicEngine(provider.GetRequiredService<HttpClient>(), provider.GetRequiredService<AnthropicOptions>())
        :> TailoringEngine)
    |> ignore

    builder.Services.AddSingleton<TailoringService>() |> ignore

    builder.Services.AddSingleton<CreditStore>(fun _ -> SqliteCreditStore(connectionString) :> CreditStore)
    |> ignore

    builder.Services.AddSingleton<CreditService>(fun provider ->
        CreditService(provider.GetRequiredService<CreditStore>(), CreditServiceOptions.fromEnvironment ()))
    |> ignore

    let app = builder.Build()

    app.UseCors() |> ignore

    if Option.isSome clerkAuthority then
        app.UseAuthentication() |> ignore

    app.UseGiraffe webApp

    app.Run("http://localhost:5155")
    0
