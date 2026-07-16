namespace DeltaResume.Api

open Giraffe

module Routes =

    let webApp: HttpHandler =
        choose
            [ GET >=> route "/api/health" >=> Handlers.health
              GET >=> route "/api/credits" >=> RateLimit.loosePolicy >=> Handlers.credits
              GET >=> route "/api/saved-resumes" >=> RateLimit.loosePolicy >=> Handlers.listSavedResumes
              POST >=> route "/api/tailor" >=> RateLimit.tailorPolicy >=> Handlers.tailor
              POST >=> route "/api/cover-letter" >=> RateLimit.tailorPolicy >=> Handlers.coverLetter
              PATCH
              >=> routef "/api/saved-resumes/%s" (fun resumeId -> RateLimit.loosePolicy >=> Handlers.renameSavedResume resumeId)
              DELETE
              >=> routef "/api/saved-resumes/%s" (fun resumeId -> RateLimit.loosePolicy >=> Handlers.deleteSavedResume resumeId)
              setStatusCode 404 >=> json {| Message = "Not found" |} ]
