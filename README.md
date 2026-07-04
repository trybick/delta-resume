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

### Backend

Requires .NET SDK. Listens on http://localhost:5155.

**Environment variables** (in `backend/DeltaResume.Api/.env`; loaded automatically on `dotnet run` via DotNetEnv):

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for tailoring |
| `CLERK_FRONTEND_API_URL` | Yes | Clerk Frontend API URL (e.g. `https://in-aphid-71.clerk.accounts.dev`). Found in the Clerk Dashboard under **API keys** → **Advanced** → **Frontend API URL**. If unset, all requests are treated as guests. |
| `IP_HASH_SALT` | Yes | Secret key for HMAC-SHA256 hashing of guest IPs for credit tracking. Generate with `openssl rand -hex 32`. |
| `TRUST_FORWARDED_HEADERS` | No | Set to `true` only when running behind a reverse proxy (production) so `X-Forwarded-For` is used for guest IP resolution |

```bash
cd backend/DeltaResume.Api
dotnet run
```

### Frontend

Proxies `/api` to the backend. Open http://localhost:5173 after starting.

**Environment variables** (in `frontend/.env.development.local`, gitignored; or `frontend/.env.development` for shared defaults):

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (`pk_test_…` or `pk_live_…`) |
| `VITE_API_BASE_URL` | No | Backend URL when not using the Vite dev proxy. Leave unset for local dev — Vite proxies `/api` to `http://localhost:5155`. |

Pull Clerk keys from the linked **Delta Resume** application, then start the dev server:

```bash
cd frontend
clerk env pull --file .env.development.local
npm install
npm run dev
```

## Auth, credits, and billing

Authentication and billing are handled by [Clerk](https://clerk.com) (Clerk Billing uses Stripe under the hood). Credit enforcement is server-side:

- Guests get 3 lifetime credits, tracked against both a browser fingerprint (FingerprintJS, sent as `X-Guest-Fingerprint`) and a salted hash of their IP; the higher of the two usage counts applies, so clearing one alone does not reset credits.
- Free accounts get 3 lifetime credits keyed to their Clerk user id.
- Pro subscribers ($7/month) get 100 credits per calendar month.
- One credit is spent per successful tailor run. When credits run out the API returns `402 credits_exhausted` and the UI opens a paywall: sign-up (Google prominent) for guests, the Clerk `PricingTable` in-app checkout for signed-in users.

### Clerk setup

This project is linked to the Clerk application **Delta Resume** (`app_3G0NKfcHSgDD91PSS0dSebmFdsq`). With the [Clerk CLI](https://clerk.com/docs/cli) installed and authenticated (`clerk auth login`), pull keys into the frontend:

```bash
cd frontend
clerk env pull --file .env.development.local
```

Set `CLERK_FRONTEND_API_URL` in `backend/DeltaResume.Api/.env` to the **Frontend API URL** from the Clerk Dashboard (**API keys** → **Advanced**). The backend uses it as the JWT issuer; it does not need `CLERK_SECRET_KEY`.

In the [Clerk Dashboard](https://dashboard.clerk.com):

1. Enable **Google** and **Email** as sign-in options (User & Authentication → SSO connections), and order Google first so it is the prominent option.
2. Enable **Billing** (Billing → Settings). Development instances use Clerk's shared dev payment gateway, so no Stripe account is needed until production.
3. Create a user plan with slug `pro` at **$7/month** (Billing → Plans → Plans for Users → Add Plan). The backend reads the `pla` claim from the session token to detect the plan.

## API

- `POST /api/tailor` — `{ resumeText, jobDescription }` → `{ runId, resumeText, changes: [{ id, lineIndex, original, tailored }] }`; returns `402` with `{ code: "credits_exhausted", requiresAuth }` when out of credits
- `PATCH /api/changes/{changeId}` — `{ decision: "pending" | "accepted" | "rejected" }` → 204
- `GET /api/credits` — `{ remaining, total, plan, isAuthenticated }` for the current user or guest
- `GET /api/health` — liveness check

## Notes

- `.txt` and `.md` uploads are read directly in the browser. PDF/DOCX uploads are accepted but load sample resume text for now; real parsing is deferred.
- SQLite is used for local development; persistence sits behind a repository port so a hosted Postgres (e.g. Railway) can be swapped in with a second repository implementation.
