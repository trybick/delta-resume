# AGENTS.md

## Cursor Cloud specific instructions

Delta Resume has three services: an **F# + Giraffe API** (`backend/DeltaResume.Api/`, port `5100`), a **Vite + React frontend** (`frontend/`, port `5200`, proxies `/api` → `5100`), and **PostgreSQL**. See `README.md` for the full env-var reference and standard run commands; the notes below only cover non-obvious cloud setup and gotchas.

### Toolchain (already installed in the VM snapshot)
- **.NET 10 SDK** at `/usr/share/dotnet`, symlinked to `/usr/local/bin/dotnet` (on `PATH`).
- **PostgreSQL 16** (Ubuntu package) and **Node 22** (base image).
- The update script only refreshes deps (`npm install` for the frontend, `dotnet restore` for the API); it does not install system packages or start services.

### PostgreSQL — must be started each session
Postgres does not auto-start. Run once per session:
```bash
sudo pg_ctlcluster 16 main start
```
A superuser role `ubuntu` and database `deltaresume` already exist, and `pg_hba.conf` is set to `trust` for local/loopback connections, so the API's default connection string (`Host=localhost;Database=deltaresume`, no password) works as-is. Override with `DATABASE_URL` if needed. Tables are created automatically on API startup.

### Environment files (gitignored — recreate if missing)
- `backend/DeltaResume.Api/.env`: set `BACKEND_RUNNING_LOCALLY=true` (unlimited guest credits, rate limiting off) and `IP_HASH_SALT` (`openssl rand -hex 32`). `ANTHROPIC_API_KEY` is required for the core tailor / cover-letter features (without it `/api/tailor` returns `502 "ANTHROPIC_API_KEY is not set on the server."`). `CLERK_FRONTEND_API_URL` is optional — when unset, all requests are treated as guests.
- `frontend/.env.development.local`: `VITE_CLERK_PUBLISHABLE_KEY` is **required** — the frontend throws `Missing VITE_CLERK_PUBLISHABLE_KEY` at boot and renders nothing without it.

### Running the services
- Backend: `cd backend/DeltaResume.Api && dotnet watch run` — hot-reloads on file changes, so do **not** restart it after editing backend code.
- Frontend: `cd frontend && npm run dev`.
- Health check: `curl http://localhost:5100/api/health` → `{"status":"ok"}`.

### Lint / build / test
- Frontend: `npm run lint` (oxlint), `npm run format:check` (prettier), `npm run build` (`tsc -b && vite build`).
- Backend: `dotnet build`. There are no automated test projects in this repo.

### Gotchas
- The `/api/tailor` request body is an F# record and requires all three fields — `resumeText`, `jobDescription`, and `resumeName` — otherwise deserialization fails with a `500`.
