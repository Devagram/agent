# Sales UI + DB-backed preview generation (separate deploy)

This document tracks the long-term plan to add a **sales-rep web UI** that collects customer resources (text + images), persists them, and triggers the existing `sitegen-agent` pipeline to generate a Firebase Hosting preview.

## Goals

- Sales rep can:
  - authenticate
  - create/manage a “project” per customer
  - upload images/assets
  - enter/edit content/intake fields
  - click **Generate preview**
  - view the resulting preview URL and run history
- System persists all inputs and outputs:
  - intake fields and page plan data
  - uploaded assets
  - generation runs, logs, preview URLs
- Agent consumes the stored data and produces a Firebase Hosting preview via the existing `POST /generate_preview` pipeline.

## Non-goals (initially)

- No fully-fledged CMS workflows (approvals, versioning, permissions) beyond basic sales access.
- No multi-Firebase-project per customer unless required; start with one Firebase project + per-project preview channels.
- No complex analytics/reporting.

## Current repo touchpoints

- **Agent API** (Cloud Run): `agent/sitegen_agent/server.py`
  - `GET /_health`
  - `POST /generate_preview`
- **Pipeline**: `agent/sitegen_agent/pipeline.py`
  - clones skeleton repo (Cloud Run) via `SITEGEN_SKELETON_GIT_URL` + `GITHUB_TOKEN`
  - builds Astro site and deploys a Hosting preview channel
- **Request contract**: `agent/sitegen_agent/models.py`
  - `GeneratePreviewRequest` supports `pagePlanJson` escape hatch (useful for DB-driven generation)

## Recommended architecture (GCP)

### Deployments (separate)

1. **Sales UI (frontend)**
   - Deploy as a static site to **Firebase Hosting** (recommended) or Cloud Run static.
   - Built with Astro (same ecosystem as the skeleton) or a lightweight React UI.

2. **Sales API (backend)**
   - Deploy to **Cloud Run** as a separate service.
   - Responsibilities:
     - Authenticate/authorize sales reps (Firebase Auth ID tokens)
     - CRUD projects + intake fields
     - Asset upload orchestration (signed URLs)
     - Trigger generation runs (sync v1 / async via Cloud Tasks v2)
     - Persist run status and preview URLs

3. **Generator / Agent execution**
   - Reuse existing Cloud Run service `sitegen-agent` (`POST /generate_preview`).
   - The Sales API triggers generation by forming a valid request object and calling the agent.

### Data storage

- **Firestore (Native mode)**: project + asset metadata + generation run state.
- **Cloud Storage**: uploaded images/docs.
- Optional (later): BigQuery export for reporting.

### Identity

- **Firebase Authentication** for sales reps.
- Backend verifies Firebase ID tokens.
- Role gating via:
  - an allowlist of emails (very early), or
  - custom claims (recommended), or
  - membership docs in Firestore.

## Data model (Firestore)

Keep model simple and flexible; Firestore is good for evolving page plan shapes.

### `projects/{projectId}`

- `accountId` (optional, for multi-tenant expansion)
- `projectName` (string; typically slug)
- `firebaseProjectId` (string; where preview is deployed)
- `status` (`draft|review|approved|archived`)
- `intake` (object; raw form fields from UI)
- `pagePlanOverride` (object; optional full JSON matching skeleton plan schema)
- `createdBy`, `createdAt`, `updatedAt`

### `projects/{projectId}/assets/{assetId}`

- `filename`, `contentType`, `size`
- `gcsBucket`, `gcsPath`
- `usageHint` (e.g. `heroBackground`, `logo`, `aboutImage`)
- `uploadedBy`, `uploadedAt`

### `projects/{projectId}/runs/{runId}`

- `status` (`queued|running|succeeded|failed|canceled`)
- `requestedBy`, `requestedAt`
- `channelId` (string)
- `previewUrl` (string)
- `errorMessage`, `errorDetails`
- `finishedAt`, `durationMs`

## Cloud Storage layout

- Bucket: `sitegen-sales-assets-<env>`
- Object prefix convention:
  - `projects/<projectId>/assets/<assetId>/<filename>`

## API design (Sales API)

All endpoints require:

- `Authorization: Bearer <Firebase ID token>`

### Projects

- `GET /api/projects` → list projects
- `POST /api/projects` → create project
- `GET /api/projects/{projectId}` → details
- `PATCH /api/projects/{projectId}` → update intake fields/status

### Assets (signed upload URLs)

- `POST /api/projects/{projectId}/assets:uploadUrl`
  - Request: `{ filename, contentType, size, usageHint? }`
  - Response: `{ assetId, uploadUrl, gcsPath }`
- `POST /api/projects/{projectId}/assets/{assetId}:finalize`
  - Marks upload complete + writes metadata
- `GET /api/projects/{projectId}/assets` → list
- `DELETE /api/projects/{projectId}/assets/{assetId}` → delete record + object

### Runs / generation

- `POST /api/projects/{projectId}/runs`
  - Request: `{ channelId? }`
  - Response (sync v1): `{ runId, status, previewUrl? }`
  - Response (async v2): `{ runId, status: "queued" }`
- `GET /api/projects/{projectId}/runs/{runId}` → status + previewUrl
- `GET /api/projects/{projectId}/runs` → history

## Generation orchestration (how the agent consumes DB)

### Core idea

Sales API builds a `GeneratePreviewRequest` from Firestore + assets, then calls:

- `POST https://<agent-service>/generate_preview`

Using:

- `firebaseProjectId` from the project doc
- `projectName` from the project doc
- `channelId` from request or generated default
- `pagePlanJson`:
  - either `pagePlanOverride` (if set)
  - or derived from `intake` by a mapping function

### Handling images

Two valid strategies:

1. **Materialize into skeleton during build (recommended)**
   - Sales API downloads referenced assets from GCS.
   - Writes them into the generator’s working directory so the Astro build contains them.
   - Map images into plan as `/images/<project>/...`

2. **Use externally hosted images (fastest)**
   - Make assets publicly accessible or signed.
   - Put absolute URLs into the page plan.
   - Downside: preview depends on external access + URL expiry.

Plan: start with (1) to keep previews self-contained.

### Sync vs async

- **V1 (simple):** Sales API calls agent inline and returns previewUrl.
  - Works if typical build/deploy < request timeout.
- **V2 (recommended):** Sales API enqueues a Cloud Task that triggers a background run.
  - UI polls run status until succeeded.
  - More reliable and prevents request timeouts.

## Security / IAM

### Sales API Cloud Run service account

Needs:
- Firestore read/write: `roles/datastore.user`
- Storage object read/write: `roles/storage.objectAdmin` on the assets bucket
- (If using Cloud Tasks) enqueue permissions: `roles/cloudtasks.enqueuer`

### Agent Cloud Run runtime service account

Already required for your current pipeline:
- Firebase Hosting deploy permissions (ADC) for the Firebase project used
- secret access for `GITHUB_TOKEN` (already configured)

### Service-to-service auth (Sales API → Agent)

Start with:
- Agent remains `--allow-unauthenticated` (current config) but only exposes `POST /generate_preview`.

Harden later:
- Require IAM auth between services (Cloud Run Invoker) + use an identity token.

## Frontend UX (Sales UI)

Minimum pages:

- Login
- Project list
- Project detail editor
  - intake fields form
  - asset uploader with preview + usage hint
  - generate preview button
  - display most recent previewUrl
- Runs/history table

## Implementation phases

### Phase 0 — Confirm contracts

- Confirm which Firebase project ID is the canonical deploy target (e.g. `sitegen-96189`).
- Confirm skeleton image policy (materialize assets into build vs external URLs).

### Phase 1 — Sales API skeleton

- Create new service (separate folder/repo ok; recommended `sales-app/` or separate repository).
- Implement Firebase ID token verification.
- Implement basic Firestore CRUD for `projects`.

### Phase 2 — Asset upload

- Add signed upload URLs via Cloud Storage.
- Store asset metadata in Firestore.

### Phase 3 — Generation (sync)

- Add `POST /api/projects/{projectId}/runs` that:
  - reads project + assets
  - builds request body for agent
  - calls agent `/generate_preview`
  - stores previewUrl in Firestore

### Phase 4 — Async runs (Cloud Tasks)

- Switch generation to queued jobs.
- Add retries + status transitions.

### Phase 5 — Harden

- IAM auth between Sales API and Agent
- role-based access controls and per-account tenancy
- audit logs

## Deployment checklist (GCP)

1. Firestore enabled in the target project
2. Assets bucket created + CORS for browser PUT uploads
3. Firebase Auth configured (providers enabled)
4. Sales API Cloud Run deployed with env vars:
   - `GOOGLE_CLOUD_PROJECT`
   - `ASSETS_BUCKET`
   - `AGENT_BASE_URL`
   - optionally `CLOUD_TASKS_QUEUE`
5. Sales UI Firebase Hosting deployed with:
   - API base URL
   - Firebase config

## Open questions

- Do you want multi-tenant: multiple customers in one Firebase project (multiple channels), or multiple Firebase projects?
- Do you need an approval workflow before generation?
- Should the agent generate plan via Vertex, or should Sales UI always provide a plan/intake?
