# Delta Resume

Tired of the job application grind? Rewriting your resume for every posting is the worst part of the search, so most people skip it and send the same generic version everywhere. Recruiters can tell.

Delta Resume does the tailoring for you. Paste a job description, and it rewrites your resume bullets to fit the role and drafts a matching cover letter, in one run. Every suggestion shows up as an inline word-level diff you can accept or reject, so nothing lands on your resume that you didn't approve:

![Inline word-level diffs on resume bullets](demo/resume-inline-diffs.png)

When you're happy with it, export the resume and cover letter as DOCX or PDF. Minutes per application instead of an hour.

**What you get**

- **Inline diff review.** Keep or revert every rewrite.
- **Cover letters.** Every tailor run also writes a matching cover letter.
- **Missing requirements (Pro).** See job requirements your resume doesn't cover yet, plus one-click bullets you can insert.
- **Try before you buy.** Free to try. No account or credit card required.

## Structure

- `frontend/` - Vite + React + TypeScript + Mantine single-page UI. Clerk for authentication.
- `backend/DeltaResume.Api/` - F# + Giraffe + Dapper API with a Domain-Driven Design layering

## Local Development

### Backend

Requires .NET SDK and PostgreSQL. Listens on http://localhost:5100.

Create the local database once:

```bash
createdb deltaresume
```

**Environment variables** (in `backend/DeltaResume.Api/.env`):

| Variable                  | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`       | Yes      | Anthropic API key for tailoring and cover letters                                                                                                                                                                                                                                                                                                                                                                                    |
| `CLERK_FRONTEND_API_URL`  | Yes      | Clerk Frontend API URL (e.g. `https://in-aphid-71.clerk.accounts.dev`). Found in the Clerk Dashboard under **API keys** → **Advanced** → **Frontend API URL**. If unset, all requests are treated as guests.                                                                                                                                                                                                                         |
| `CLERK_SECRET_KEY`        | Yes      | Clerk secret key (`sk_test_…` or `sk_live_…`) from the Clerk Dashboard **API keys**. Used to fetch `user.public_metadata` (e.g. lifetime-free Pro). If unset, lifetime-free entitlements are disabled.                                                                                                                                                                                                                               |
| `IP_HASH_SALT`            | Yes      | Secret key for HMAC-SHA256 hashing of guest IPs for credit tracking. Generate with `openssl rand -hex 32`.                                                                                                                                                                                                                                                                                                                           |
| `DATABASE_URL`            | No       | Postgres connection string or URI. Defaults to `Host=localhost;Database=deltaresume`. On Railway, reference the Postgres plugin’s `DATABASE_URL`.                                                                                                                                                                                                                                                                                    |
| `BACKEND_RUNNING_LOCALLY` | No       | Set to `true` when running the API on your machine (replaces `UNLIMITED_GUEST_CREDITS`, `DISABLE_RATE_LIMITING`, and `TRUST_FORWARDED_HEADERS=false`). When enabled: guest requests get unlimited tailor credits; API rate limiting is disabled; guest IPs are taken from the direct connection instead of `X-Forwarded-For`. Must be unset or `false` in production.                                                                |
| `TRUST_FORWARDED_HEADERS` | No       | Production only (ignored when `BACKEND_RUNNING_LOCALLY` is set). Set to `true` when running behind a reverse proxy so `X-Forwarded-For` / `X-Real-IP` are used for guest IP resolution. Non-public values (loopback, RFC1918, CGNAT) are skipped so a proxy hop cannot become a shared guest identity.                                                                                                                               |
| `CORS_ORIGINS`            | No       | Comma-separated allowed browser origins. Defaults to `http://localhost:5200`. In production, include your frontend URL (e.g. `https://app.example.com`).                                                                                                                                                                                                                                                                             |
| `SENTRY_DSN`              | No       | Sentry DSN for API error monitoring and tracing. Leave unset to disable.                                                                                                                                                                                                                                                                                                                                                             |
| `SOFFICE_PATH`            | No       | Path to the LibreOffice `soffice` binary used for server-side DOCX→PDF conversion (`POST /api/convert-pdf`). Defaults to `soffice` on `PATH`. On macOS: `brew install --cask libreoffice`, then set `/Applications/LibreOffice.app/Contents/MacOS/soffice`. If unavailable, the endpoint returns 503 and the frontend falls back to a lower-quality client-side (image-based) PDF. The production Docker image includes LibreOffice. |

```bash
cd backend/DeltaResume.Api
dotnet run
```

Tables are created automatically on startup (`CREATE TABLE IF NOT EXISTS`). Recreating the database is required for schema changes that alter existing column types.

### Frontend

Proxies `/api` to the backend. Open http://localhost:5200 after starting.

**Environment variables** (in `frontend/.env`)

| Variable                     | Required | Description                                                                                                                                  |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes      | Clerk publishable key (`pk_test_…` or `pk_live_…`)                                                                                           |
| `VITE_API_BASE_URL`          | No       | Backend URL when not using the Vite dev proxy. Leave unset for local dev; Vite proxies `/api` to `http://localhost:5100`.                    |
| `VITE_GA_MEASUREMENT_ID`     | No       | Google Analytics 4 measurement ID (`G-XXXXXXXXXX`). Used only in production builds; ignored in local/dev. When unset, analytics is disabled. |
| `VITE_SENTRY_DSN`            | No       | Sentry DSN for frontend error monitoring, tracing, and error-triggered session replay. Leave unset to disable.                               |

Pull Clerk keys from the linked **Delta Resume** application, then start the dev server:

```bash
cd frontend
clerk env pull --file .env.development.local
npm install
npm run dev
```
