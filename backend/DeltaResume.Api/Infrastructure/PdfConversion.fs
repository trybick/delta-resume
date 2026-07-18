namespace DeltaResume.Infrastructure

open System
open System.ComponentModel
open System.Diagnostics
open System.IO
open System.Threading
open System.Threading.Tasks

type PdfConversionError =
    | ConverterUnavailable
    | ConverterBusy
    | ConversionFailed of string

type PdfConverter() =
    let sofficePath =
        Environment.GetEnvironmentVariable "SOFFICE_PATH"
        |> Option.ofObj
        |> Option.filter (String.IsNullOrWhiteSpace >> not)
        |> Option.defaultValue "soffice"

    let concurrencyGate = new SemaphoreSlim(2)
    let conversionTimeout = TimeSpan.FromSeconds 30.0
    let gateWaitTimeout = TimeSpan.FromSeconds 10.0

    let runConversion (workingDir: string) (inputPath: string) (cancellationToken: CancellationToken) =
        task {
            let profileDir = Path.Combine(workingDir, "profile")
            let startInfo = ProcessStartInfo(FileName = sofficePath)
            startInfo.ArgumentList.Add $"-env:UserInstallation={Uri(profileDir).AbsoluteUri}"
            startInfo.ArgumentList.Add "--headless"
            startInfo.ArgumentList.Add "--norestore"
            startInfo.ArgumentList.Add "--convert-to"
            startInfo.ArgumentList.Add "pdf"
            startInfo.ArgumentList.Add "--outdir"
            startInfo.ArgumentList.Add workingDir
            startInfo.ArgumentList.Add inputPath
            startInfo.UseShellExecute <- false
            startInfo.RedirectStandardOutput <- true
            startInfo.RedirectStandardError <- true

            use converterProcess = new Process(StartInfo = startInfo)
            converterProcess.Start() |> ignore

            let stderrTask = converterProcess.StandardError.ReadToEndAsync()
            let stdoutTask = converterProcess.StandardOutput.ReadToEndAsync()

            use timeoutSource = CancellationTokenSource.CreateLinkedTokenSource cancellationToken
            timeoutSource.CancelAfter conversionTimeout

            try
                do! converterProcess.WaitForExitAsync timeoutSource.Token
            with :? OperationCanceledException ->
                try
                    converterProcess.Kill(entireProcessTree = true)
                with _ ->
                    ()

                cancellationToken.ThrowIfCancellationRequested()
                failwith "Conversion timed out."

            let! stderr = stderrTask
            let! _ = stdoutTask
            return converterProcess.ExitCode, stderr
        }

    member _.ConvertDocxToPdf
        (docxBytes: byte[], cancellationToken: CancellationToken)
        : Task<Result<byte[], PdfConversionError>> =
        task {
            let! gateAcquired = concurrencyGate.WaitAsync(gateWaitTimeout, cancellationToken)

            if not gateAcquired then
                return Error ConverterBusy
            else

            let workingDir = Path.Combine(Path.GetTempPath(), $"delta-pdf-{Guid.NewGuid():N}")

            try
                try
                    Directory.CreateDirectory workingDir |> ignore
                    let inputPath = Path.Combine(workingDir, "resume.docx")
                    do! File.WriteAllBytesAsync(inputPath, docxBytes, cancellationToken)

                    let! exitCode, stderr = runConversion workingDir inputPath cancellationToken
                    let outputPath = Path.Combine(workingDir, "resume.pdf")

                    if exitCode <> 0 || not (File.Exists outputPath) then
                        let detail = if String.IsNullOrWhiteSpace stderr then "unknown error" else stderr.Trim()
                        eprintfn "LibreOffice conversion failed (exit %d): %s" exitCode detail
                        return Error(ConversionFailed "Could not convert the document to PDF.")
                    else
                        let! pdfBytes = File.ReadAllBytesAsync(outputPath, cancellationToken)
                        return Ok pdfBytes
                with
                | :? Win32Exception ->
                    eprintfn "LibreOffice binary not found at '%s'. Set SOFFICE_PATH to enable PDF conversion." sofficePath
                    return Error ConverterUnavailable
                | :? OperationCanceledException ->
                    return! Task.FromCanceled<_> cancellationToken
                | ex ->
                    eprintfn "LibreOffice conversion error: %s" ex.Message
                    return Error(ConversionFailed "Could not convert the document to PDF.")
            finally
                concurrencyGate.Release() |> ignore

                try
                    Directory.Delete(workingDir, true)
                with _ ->
                    ()
        }
