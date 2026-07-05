namespace DeltaResume.Api

open Giraffe

module Routes =

    let webApp: HttpHandler =
        choose
            [ GET >=> route "/api/health" >=> Handlers.health
              GET >=> route "/api/credits" >=> RateLimit.loosePolicy >=> Handlers.credits
              GET >=> route "/api/resumes" >=> RateLimit.loosePolicy >=> Handlers.listResumes
              POST >=> route "/api/tailor" >=> RateLimit.tailorPolicy >=> Handlers.tailor
              PATCH
              >=> routef "/api/resumes/%s" (fun resumeId -> RateLimit.loosePolicy >=> Handlers.renameResume resumeId)
              DELETE
              >=> routef "/api/resumes/%s" (fun resumeId -> RateLimit.loosePolicy >=> Handlers.deleteResume resumeId)
              setStatusCode 404 >=> json {| Message = "Not found" |} ]
