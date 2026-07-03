# Delta Resume

A resume tailoring service: attach a base resume, paste a job description, and review Claude-suggested bullet rewrites with an inline diff. Accept or reject each change, then copy the tailored resume. Runs and decisions are persisted to SQLite.

## Structure

- `frontend/` — Vite + React + TypeScript + Mantine single-page UI
- `backend/DeltaResume.Api/` — F# + Giraffe + Dapper API with a DDD layering:
  - `Domain/` — pure types, bullet extraction, change validation
  - `Application/` — ports (`TailoringEngine`, `TailorRunRepository`) and the `TailoringService` use cases
  - `Infrastructure/` — Dapper/SQLite repository and the Anthropic Claude engine
  - `Api/` — DTOs and Giraffe handlers; `Program.fs` is the composition root

## Running

Backend (requires .NET SDK and an Anthropic API key):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
cd backend/DeltaResume.Api
dotnet run
```

The API listens on http://localhost:5155. Environment variables:

- `ANTHROPIC_API_KEY` (required for tailoring)
- `ANTHROPIC_MODEL` (optional, defaults to `claude-sonnet-4-5`)
- `DB_PATH` (optional, defaults to `backend/data/delta-resume.db`)
- `CLERK_FRONTEND_API_URL` (required for auth; your Clerk Frontend API URL, e.g. `https://your-app.clerk.accounts.dev`. If unset, all requests are treated as guests.)
- `IP_HASH_SALT` (optional; salt used when hashing guest IPs for credit tracking)
- `TRUST_FORWARDED_HEADERS` (optional, set to `true` only when running behind a reverse proxy so `X-Forwarded-For` is used for guest IP resolution)

Frontend (proxies `/api` to the backend):

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. Frontend environment variables (in `frontend/.env.development` or `.env.development.local`):

- `VITE_API_BASE_URL` — backend URL, defaults to `http://localhost:5155`
- `VITE_CLERK_PUBLISHABLE_KEY` (required) — Clerk publishable key

## Auth, credits, and billing

Authentication and billing are handled by [Clerk](https://clerk.com) (Clerk Billing uses Stripe under the hood). Credit enforcement is server-side:

- Guests get 3 lifetime credits, tracked against both a browser fingerprint (FingerprintJS, sent as `X-Guest-Fingerprint`) and a salted hash of their IP; the higher of the two usage counts applies, so clearing one alone does not reset credits.
- Free accounts get 3 lifetime credits keyed to their Clerk user id.
- Pro subscribers ($7/month) get 100 credits per calendar month.
- One credit is spent per successful tailor run. When credits run out the API returns `402 credits_exhausted` and the UI opens a paywall: sign-up (Google prominent) for guests, the Clerk `PricingTable` in-app checkout for signed-in users.

### Clerk dashboard setup

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com). Enable **Google** and **Email** as sign-in options (User & Authentication → SSO connections), and order Google first so it is the prominent option.
2. Enable **Billing** (Billing → Settings). Development instances use Clerk's shared dev payment gateway, so no Stripe account is needed until production.
3. Create a user plan with slug `pro` at **$7/month** (Billing → Plans → Plans for Users → Add Plan). The backend reads the `pla` claim from the session token to detect the plan.
4. Copy the **Publishable key** (API Keys) into `frontend/.env.development.local` as `VITE_CLERK_PUBLISHABLE_KEY`, and the **Frontend API URL** into the backend environment as `CLERK_FRONTEND_API_URL`.

## API

- `POST /api/tailor` — `{ resumeText, jobDescription }` → `{ runId, resumeText, changes: [{ id, lineIndex, original, tailored }] }`; returns `402` with `{ code: "credits_exhausted", requiresAuth }` when out of credits
- `PATCH /api/changes/{changeId}` — `{ decision: "pending" | "accepted" | "rejected" }` → 204
- `GET /api/credits` — `{ remaining, total, plan, isAuthenticated }` for the current user or guest
- `GET /api/health` — liveness check

## Notes

- `.txt` and `.md` uploads are read directly in the browser. PDF/DOCX uploads are accepted but load sample resume text for now; real parsing is deferred.
- SQLite is used for local development; persistence sits behind a repository port so a hosted Postgres (e.g. Railway) can be swapped in with a second repository implementation.
