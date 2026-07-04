# Delta Resume

A resume tailoring service: attach a base resume, paste a job description, and review Claude-suggested bullet rewrites with an inline diff. Accept or reject each change, then copy the tailored resume.

## Structure

- `frontend/` — Vite + React + TypeScript + Mantine single-page UI
- `backend/DeltaResume.Api/` — F# + Giraffe + Dapper API with a DDD layering

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
| `UNLIMITED_GUEST_CREDITS` | No | Set to `true` for local development to give guest requests unlimited tailor credits. Defaults to `false` (guests get 3). |

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

