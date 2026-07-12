# Delta Resume

A resume tailoring service: attach a base resume, paste a job description, and review Claude-suggested bullet rewrites with an inline diff. Accept or reject each change, then copy the tailored resume.

## Structure

- `frontend/` — Vite + React + TypeScript + Mantine single-page UI
- `backend/DeltaResume.Api/` — F# + Giraffe + Dapper API with a DDD layering

## Running

### Backend

Requires .NET SDK and PostgreSQL. Listens on http://localhost:5100.

Create the local database once:

```bash
createdb deltaresume
```

**Environment variables** (in `backend/DeltaResume.Api/.env`; loaded automatically on `dotnet run` via DotNetEnv):

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for tailoring |
| `CLERK_FRONTEND_API_URL` | Yes | Clerk Frontend API URL (e.g. `https://in-aphid-71.clerk.accounts.dev`). Found in the Clerk Dashboard under **API keys** → **Advanced** → **Frontend API URL**. If unset, all requests are treated as guests. |
| `IP_HASH_SALT` | Yes | Secret key for HMAC-SHA256 hashing of guest IPs for credit tracking. Generate with `openssl rand -hex 32`. |
| `DATABASE_URL` | No | Postgres connection string or URI. Defaults to `Host=localhost;Database=deltaresume`. On Railway, reference the Postgres plugin’s `DATABASE_URL`. |
| `BACKEND_RUNNING_LOCALLY` | No | Set to `true` when running the API on your machine (replaces `UNLIMITED_GUEST_CREDITS`, `DISABLE_RATE_LIMITING`, and `TRUST_FORWARDED_HEADERS=false`). When enabled: guest requests get unlimited tailor credits; API rate limiting is disabled; guest IPs are taken from the direct connection instead of `X-Forwarded-For`. Must be unset or `false` in production. |
| `TRUST_FORWARDED_HEADERS` | No | Production only (ignored when `BACKEND_RUNNING_LOCALLY` is set). Set to `true` when running behind a reverse proxy so `X-Forwarded-For` is used for guest IP resolution. |
| `CORS_ORIGINS` | No | Comma-separated allowed browser origins. Defaults to `http://localhost:5200`. In production, include your frontend URL (e.g. `https://app.example.com`). |

```bash
cd backend/DeltaResume.Api
dotnet run
```

Tables are created automatically on startup.

### Backend on Railway

1. Set the service **Root Directory** to `backend/DeltaResume.Api` (uses the included `Dockerfile`).
2. Add a **PostgreSQL** plugin to the project.
3. On the API service, add a variable reference from Postgres → `DATABASE_URL`.
4. Also set: `ANTHROPIC_API_KEY`, `CLERK_FRONTEND_API_URL`, `IP_HASH_SALT`, `TRUST_FORWARDED_HEADERS=true`, `CORS_ORIGINS` = your deployed frontend origin(s).
5. Do **not** set `BACKEND_RUNNING_LOCALLY`.

### Frontend

Proxies `/api` to the backend. Open http://localhost:5200 after starting.

**Environment variables** (in `frontend/.env.development.local`, gitignored; or `frontend/.env.development` for shared defaults):

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (`pk_test_…` or `pk_live_…`) |
| `VITE_API_BASE_URL` | No | Backend URL when not using the Vite dev proxy. Leave unset for local dev — Vite proxies `/api` to `http://localhost:5100`. |
| `VITE_GA_MEASUREMENT_ID` | No | Google Analytics 4 measurement ID (`G-XXXXXXXXXX`). Used only in production builds; ignored in local/dev. When unset, analytics is disabled. |

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
- Pro subscribers ($19/month, or $12/month billed annually) get 200 credits per calendar month.
- One credit is spent per successful tailor run. When credits run out the API returns `402 credits_exhausted` and the UI opens a paywall: sign-up (Google prominent) for guests, the Clerk `PricingTable` in-app checkout for signed-in users.
