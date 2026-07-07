namespace DeltaResume.Application

open System

module LocalDev =
    let isRunningLocally () : bool =
        Environment.GetEnvironmentVariable "BACKEND_RUNNING_LOCALLY"
        |> Option.ofObj
        |> Option.map (fun value -> value.Equals("true", StringComparison.OrdinalIgnoreCase))
        |> Option.defaultValue false
