# Resume Tailor

A resume tailoring service: attach a base resume, paste a job description, and review Claude-suggested bullet rewrites with an inline diff. Accept or reject each change, then copy the tailored resume. Runs and decisions are persisted to SQLite.

## Structure

- `frontend/` — Vite + React + TypeScript + Mantine single-page UI
- `backend/ResumeTailor.Api/` — F# + Giraffe + Dapper API with a DDD layering:
  - `Domain/` — pure types, bullet extraction, change validation
  - `Application/` — ports (`TailoringEngine`, `TailorRunRepository`) and the `TailoringService` use cases
  - `Infrastructure/` — Dapper/SQLite repository and the Anthropic Claude engine
  - `Api/` — DTOs and Giraffe handlers; `Program.fs` is the composition root

## Running

Backend (requires .NET SDK and an Anthropic API key):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
cd backend/ResumeTailor.Api
dotnet run
```

The API listens on http://localhost:5155. Environment variables:

- `ANTHROPIC_API_KEY` (required for tailoring)
- `ANTHROPIC_MODEL` (optional, defaults to `claude-sonnet-4-5`)
- `DB_PATH` (optional, defaults to `backend/data/resume-tailor.db`)

Frontend (proxies `/api` to the backend):

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

## API

- `POST /api/tailor` — `{ resumeText, jobDescription }` → `{ runId, resumeText, changes: [{ id, lineIndex, original, tailored }] }`
- `PATCH /api/changes/{changeId}` — `{ decision: "pending" | "accepted" | "rejected" }` → 204
- `GET /api/health` — liveness check

## Notes

- `.txt` and `.md` uploads are read directly in the browser. PDF/DOCX uploads are accepted but load sample resume text for now; real parsing is deferred.
- SQLite is used for local development; persistence sits behind a repository port so a hosted Postgres (e.g. Railway) can be swapped in with a second repository implementation.
