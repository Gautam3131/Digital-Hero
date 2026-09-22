# CI/CD Configuration

The repository contains two GitHub Actions workflows:

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main` or `develop`. It installs the locked dependency tree, checks Node modules, builds the React app, runs the SQLite-backed E2E suite, audits production dependencies, and stores the `dist/` artifact.
- `.github/workflows/deploy.yml` runs after the reusable CI workflow passes on `main` or through manual dispatch. It publishes a backend image to GHCR, triggers the Render backend deploy hook, waits for `/health`, and deploys the Vite frontend to Vercel.

## GitHub Environment

Create a GitHub Environment named `production`. Add these non-secret Variables:

| Variable | Example placeholder | Used by |
| --- | --- | --- |
| `BACKEND_PUBLIC_URL` | `https://api.example.com` | Frontend build, backend health check |
| `FRONTEND_PUBLIC_URL` | `https://app.example.com` | Frontend build |
| `VERCEL_ORG_ID` | `team_replace_me` | Vercel project selection |
| `VERCEL_PROJECT_ID` | `prj_replace_me` | Vercel project selection |

Add these repository or `production` Environment Secrets:

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Scoped Vercel deployment token |
| `RENDER_DEPLOY_HOOK_URL` | Render deploy hook for the backend service |
| `GEMINI_API_KEY` | Server-only Gemini API key injected into the backend deployment job |
| `MONGODB_URI` | Server-only MongoDB connection string injected into the backend deployment job |
| `RAZORPAY_KEY_ID` | Server-only Razorpay public key used to initialize the backend client |
| `RAZORPAY_KEY_SECRET` | Server-only Razorpay secret used to initialize the backend client |

The workflow uses the built-in `GITHUB_TOKEN` for GHCR package publishing. No API key should be committed to this repository or exposed through a `VITE_*` variable. The backend job maps `MONGODB_URI`, `GEMINI_API_KEY`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` from repository secrets into masked environment variables; the Render service must use the same names in its encrypted runtime environment.

## Backend Runtime Variables

Set these in the Render service, or in the equivalent backend provider's encrypted environment store. The values below are placeholders only; deployment operators inject the real values securely.

```text
NODE_ENV=production
PORT=8787
PUBLIC_BASE_URL=https://api.example.com
FRONTEND_ORIGIN=https://app.example.com
DH_DB_PATH=/data/digital-heroes.sqlite
STRIPE_SECRET_KEY=sk_live_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
RAZORPAY_KEY_ID=rzp_live_replace_me
RAZORPAY_KEY_SECRET=replace_me
STRIPE_MOCK_MODE=false
GEMINI_API_KEY=replace_me
GEMINI_MODEL=gemini-2.0-flash
MONGODB_DATA_API_URL=https://data.mongodb-api.com/app/replace_me/endpoint/data/v1
MONGODB_DATA_API_KEY=replace_me
MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/digital_heroes
MONGODB_DATA_SOURCE=Cluster0
MONGODB_DATABASE=digital_heroes
MONGODB_WINNER_COLLECTION=winner_workflows
```

`DEMO_SUBSCRIBER_EMAIL`, `DEMO_SUBSCRIBER_PASSWORD`, `DEMO_ADMIN_EMAIL`, and `DEMO_ADMIN_PASSWORD` are optional development bootstrap values. Do not use demo credentials as a production identity system.

For Railway, attach a persistent volume to the service at `/data`. The Docker image keeps SQLite at `/data/digital-heroes.sqlite`; the runtime remains able to open the volume after Railway mounts it.

## Frontend Build Variables

The deploy workflow injects these public origins while Vercel builds the React bundle:

```text
VITE_API_BASE_URL=https://api.example.com
VITE_PUBLIC_APP_ORIGIN=https://app.example.com
```

These variables are intentionally public. They must contain URLs only. Stripe secrets, Gemini keys, MongoDB keys, session secrets, and any provider credentials must remain backend-only.

## Provider Setup

1. Create a Vercel project linked to this repository and copy its organization and project IDs into the GitHub `production` Environment Variables.
2. Create a Render web service from `render.yaml`, attach the persistent `/data` disk, configure the backend runtime variables, and create a deploy hook.
3. Add the Vercel token and Render deploy hook as GitHub Environment Secrets.
4. Set `PUBLIC_BASE_URL` to the backend HTTPS origin and `FRONTEND_ORIGIN` to the Vercel HTTPS origin.
5. Set `BACKEND_PUBLIC_URL` and `FRONTEND_PUBLIC_URL` in GitHub, then run `Deploy` manually once to verify the wiring.

The backend health endpoint is `GET /health`. A successful deployment returns `{ "ok": true, "service": "digital-heroes-api" }`.
