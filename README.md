# sitegen-agent (ADK / Phase 4)

This is the Phase 4 implementation: an agent container (intended to be run on Cloud Run) that:

1. stages `sitegen-skeleton` into a temp workspace
2. generates `content/page_plan.json` (Gemini via Vertex AI)
3. validates it (by running the skeleton’s own validator)
4. builds the site (Astro → `dist/`)
5. deploys a Firebase Hosting **preview channel**

## HTTP API (thin wrapper)

- `GET /healthz` → `{ ok: true }`
- `POST /generate_preview` → `{ previewUrl, channelId }`

This wrapper is intentionally small; the heavy lifting lives in the pipeline module.

## Environment variables

### Required for Cloud Run
- `GOOGLE_CLOUD_PROJECT` (required in Cloud Run)

### Skeleton resolution (new post-split behavior)
The agent can fetch the skeleton in multiple ways (in order of precedence):

1. **Request-level override** (local/dev only):
   - `skeletonPath` in the request body → use that local path
2. **Runtime git clone** (recommended for Cloud Run):
   - `SITEGEN_SKELETON_GIT_URL` → clone this repo at runtime (e.g. `https://github.com/<USERNAME>/sitegen-skeleton.git`)
   - `SITEGEN_SKELETON_REF` → branch/tag to clone (default: `main`)
   - `GITHUB_TOKEN` → token for private repo access (injected from Secret Manager)
3. **Baked-in or mounted path** (legacy/fallback):
   - `SITEGEN_SKELETON_DIR` → use this path
   - Or falls back to `/workspace` (if mounted) or `/app/skeleton` (if baked into image)

**📖 See**: [docs/CLOUD_RUN_DEPLOY.md](./docs/CLOUD_RUN_DEPLOY.md) for detailed Cloud Run setup with Secret Manager.

### Vertex AI (for ADK plan generation)
- `VERTEX_LOCATION` (default: `us-central1`)
- `VERTEX_MODEL` (default: `gemini-1.5-pro`)

## Auth strategy (important)

### Recommended (Cloud Run): IAM / ADC (no secrets)

For Cloud Run, the clean path is **Application Default Credentials (ADC)** via the Cloud Run service account.

- Run Cloud Run with a dedicated service account (e.g. `sitegen-runner@...`).
- Grant it permissions in the target Firebase project (`sitegen-96189`) to deploy Hosting previews.
- The Firebase CLI in the container will use ADC automatically.

This is the right long-term approach because it avoids mounting user credentials and avoids storing tokens.

### Local dev (optional): mount firebase-tools credentials

Locally, the container can’t see your host `firebase login` session unless you mount it.

On Windows, Firebase CLI creds are often stored at:

- `%APPDATA%\\configstore\\firebase-tools.json`

You can mount this file into the container at:

- `/root/.config/configstore/firebase-tools.json`

`docker-compose.adk.yml` includes a commented volume line you can enable.

## Local run (Docker)

This repo includes `docker-compose.adk.yml` to run the agent locally on port `8088`.

### 1) Ensure ADC exists (recommended)

```powershell
gcloud auth application-default login
```

Then make sure the ADC mount is enabled in `docker-compose.adk.yml` (it is enabled by default in this repo).

### 2) Start the agent

```powershell
docker compose -f docker-compose.adk.yml up -d --build
```

### 3) Call the agent (Windows-safe)

On Windows, avoid inline JSON quoting issues by sending a file payload:

```powershell
# Build a request JSON file that embeds a known-good plan
$plan = Get-Content -Raw .\content\page_plan.json | ConvertFrom-Json
@{
  projectName = "hanks-sushi-truck"
  firebaseProjectId = "sitegen-96189"
  channelId = "hanks-sushi-truck-r1"
  pagePlanJson = $plan
} | ConvertTo-Json -Depth 50 | Set-Content -Encoding utf8 -NoNewline .\tmp.generate_preview.json

# Send it
curl.exe -v -H "Content-Type: application/json" --data-binary "@tmp.generate_preview.json" http://localhost:8088/generate_preview
```

Expected response:

```json
{"previewUrl":"https://...web.app","channelId":"hanks-sushi-truck-r1"}
```

## CI/CD (GitHub Actions → Cloud Run)

This repo includes workflows to:
- run tests on PRs
- deploy to Cloud Run on pushes to `main`

See: `docs/CI_CD_CLOUD_RUN.md`

## Notes

- If deploy fails with `Failed to authenticate`, you’re missing either:
  - local creds mount (local dev), or
  - service account IAM permissions / ADC (Cloud Run).
