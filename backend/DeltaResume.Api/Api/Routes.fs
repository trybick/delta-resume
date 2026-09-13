namespace DeltaResume.Api

open Giraffe

module Routes =

    let webApp: HttpHandler =
        choose
            [ GET >=> route "/api/health" >=> Handlers.health
              GET
              >=> route "/api/credits"
              >=> RateLimit.loosePolicy
              >=> Handlers.hydrateClerkPublicUser
              >=> Handlers.credits
              GET >=> route "/api/saved-resumes" >=> RateLimit.loosePolicy >=> Handlers.listSavedResumes
              GET >=> route "/api/settings" >=> RateLimit.loosePolicy >=> Handlers.getSettings
              PUT
              >=> route "/api/settings"
              >=> RateLimit.loosePolicy
              >=> Handlers.hydrateClerkPublicUser
              >=> Handlers.updateSettings
              POST
              >=> route "/api/tailor"
              >=> RateLimit.tailorPolicy
              >=> Handlers.hydrateClerkPublicUser
              >=> Handlers.tailor
              POST >=> route "/api/convert-pdf" >=> RateLimit.convertPolicy >=> Handlers.convertPdf
              POST
              >=> route "/api/cover-letter"
              >=> RateLimit.tailorPolicy
              >=> Handlers.hydrateClerkPublicUser
              >=> Handlers.coverLetter
              PATCH
              >=> routef "/api/saved-resumes/%s" (fun resumeId -> RateLimit.loosePolicy >=> Handlers.renameSavedResume resumeId)
              DELETE
              >=> routef "/api/saved-resumes/%s" (fun resumeId -> RateLimit.loosePolicy >=> Handlers.deleteSavedResume resumeId)
              GET >=> route "/api/runs" >=> RateLimit.loosePolicy >=> Handlers.hydrateClerkPublicUser >=> Handlers.listTailorRuns
              POST >=> route "/api/runs/claim" >=> RateLimit.loosePolicy >=> Handlers.hydrateClerkPublicUser >=> Handlers.claimTailorRun
              GET
              >=> routef "/api/runs/%s" (fun runId ->
                  RateLimit.loosePolicy >=> Handlers.hydrateClerkPublicUser >=> Handlers.getTailorRun runId)
              PATCH
              >=> routef "/api/runs/%s" (fun runId -> RateLimit.loosePolicy >=> Handlers.patchTailorRun runId)
              DELETE
              >=> routef "/api/runs/%s" (fun runId -> RateLimit.loosePolicy >=> Handlers.deleteTailorRun runId)
              setStatusCode 404 >=> json {| Message = "Not found" |} ]
