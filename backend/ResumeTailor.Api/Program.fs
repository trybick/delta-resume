module ResumeTailor.Program

open System
open System.IO
open System.Net.Http
open System.Text.Json
open System.Text.Json.Serialization
open Giraffe
open Microsoft.AspNetCore.Builder
open Microsoft.Extensions.DependencyInjection
open Microsoft.Extensions.Hosting
open ResumeTailor.Api
open ResumeTailor.Application
open ResumeTailor.Infrastructure

let private webApp: HttpHandler =
    choose
        [ GET >=> route "/api/health" >=> Handlers.health
          POST >=> route "/api/tailor" >=> Handlers.tailor
          PATCH >=> routef "/api/changes/%s" Handlers.updateDecision
          setStatusCode 404 >=> json {| Message = "Not found" |} ]

[<EntryPoint>]
let main args =
    let dbPath =
        Environment.GetEnvironmentVariable "DB_PATH"
        |> Option.ofObj
        |> Option.defaultValue (Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data", "resume-tailor.db"))

    let connectionString = sprintf "Data Source=%s" (Path.GetFullPath dbPath)

    Schema.init connectionString

    let builder = WebApplication.CreateBuilder(args)

    builder.Services.AddGiraffe() |> ignore

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

    let app = builder.Build()

    app.UseGiraffe webApp

    app.Run("http://localhost:5155")
    0
