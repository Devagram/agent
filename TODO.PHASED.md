# Phased TODO (sitegen-skeleton → build → deploy → automation)

This is a phased checklist for taking `sitegen-skeleton` from “builds locally” to “generates + deploys preview links automatically”.

Conventions used:
- **[Manual / outside editor]** means you need to do it in a terminal, cloud console, or other external system.
- **[Repo change]** means a code/config change in this repo.
- **Stop condition** describes what “done” looks like before moving on.

---

## Phase 0 — Preconditions (manual)

- [x] Install Firebase CLI locally
  - **[Manual / outside editor]** Install `firebase-tools` (global) and confirm `firebase --version` works.
- [x] Authenticate Firebase CLI
  - **[Manual / outside editor]** Run `firebase login` (or equivalent auth flow).
- [x] Ensure you have a Firebase project ready
  - **[Manual / outside editor]** Create/select project in Firebase Console.

**Stop condition:** You can run Firebase CLI commands locally and you know your Firebase project ID.

---

## Phase 1 — Make `dist/` directly deployable (Firebase Hosting)

### 1.1 Add Firebase Hosting config
- [x] **[Repo change]** Add `firebase.json` at repo root:
  - `hosting.public = "dist"`
  - `hosting.ignore = ["firebase.json", "**/.*", "**/node_modules/**"]`

### 1.2 Choose how you bind the Firebase project
- [ ] Option A — **[Repo change]** Add `.firebaserc` with a default project
  - Use when this repo always targets one Firebase project.
- [x] Option B — **[Manual / outside editor]** Omit `.firebaserc` and always pass `--project <id>` when deploying
  - Use when deploying to multiple projects or keeping repo unbound.

**Stop condition:** Firebase Hosting sees `dist/` as the deploy root with no extra glue.

---

## Phase 2 — Add a one-command “deploy preview” script

Goal: deploy a Firebase Hosting **preview channel** via a single npm script.

- [x] **[Repo change]** Add a `deploy:preview` script to `package.json` that runs:
  - `firebase hosting:channel:deploy <channel> --project <project>`

Suggested usage:

```powershell
npm run deploy:preview -- --project=sitegen-96189 --channel=client-foo-r1
```

### Windows note (env var friction)
- [x] If `$npm_config_*` env vars don’t behave as expected on Windows:
  - **[Repo change]** Create a small Node script (e.g. `scripts/deploy-preview.mjs`) that reads CLI args and shells out to Firebase CLI.
  - **[Repo change]** Point `deploy:preview` to that Node script.

**Stop condition:** You can deploy a preview channel with one npm command.

---

## Phase 3 — Manual “first generation” baseline (no Cloud Run yet)

Goal: prove the happy path works manually: **swap JSON → build → deploy preview**.

### 3.1 Create two manual plans
- [x] **[Repo change]** Add two known-good plans:
  - `content/page_plan_pharmacy.json`
  - `content/page_plan_trainer.json`

### 3.2 Swap a plan into place, build, deploy
- [x] **[Manual / outside editor]** Swap one plan into `content/page_plan.json` and run:

```powershell
# copy plan into place (PowerShell)
Copy-Item content\page_plan_pharmacy.json content\page_plan.json -Force

npm ci
npm run build

firebase hosting:channel:deploy pharmacy-r1 --project YOUR_PROJECT
```

### 3.3 Verify the deployed preview
- [x] **[Manual / outside editor]** Open the preview URL and verify:
  - sections render correctly
  - `/fit` route works
  - SEO tags exist
  - no console errors

**Stop condition:** You can repeat this for both plans reliably. If you can’t do this manually, automation will fail faster.

---

## Phase 4 — Create the ADK “sitegen” agent (plumbing)

> Requirement update: use Google’s ADK. The “sitegen” logic runs as an **agent in a separate Docker container** that mounts this repo and executes the pipeline.
>
> In-repo implementation for iteration lives under `sitegen-agent/`.

### 4.1 Minimal API behavior (agent wrapper)
- [x] Expose a single “generate preview” capability:
  - **Route**: `POST /generate_preview`
  - **Input**: intake JSON (projectName, services, location, brandNotes, etc.)
  - **Output**: `{ previewUrl, channelId }`

### 4.2 Agent internal steps (brute force PoC)
- [x] Create a temp workspace (inside the agent container)
- [x] Mount `sitegen-skeleton` read-only at `/workspace` then copy into temp dir
- [x] Call Vertex AI (Gemini) via ADK to generate a valid `content/page_plan.json`
  - must conform to `src/lib/schema.ts` (Zod)
  - **Note:** ADK generator wiring lives in `sitegen-agent/adk/` (Node, `@google/adk`).
- [x] Write `content/page_plan.json`
- [x] Run (inside the staged workspace):
  - `npm run validate:plan` (fails fast with clear schema errors)
  - `npm ci`
  - `npm run build`
  - `firebase hosting:channel:deploy <channel> --project <project>`
- [x] Extract preview URL from Firebase CLI output
- [x] Return `{ previewUrl, channelId }`

### 4.3 Local run (Docker)
- [x] Add `docker-compose.adk.yml` to run the agent container and mount the repo.

**Stop condition (Phase 4):** You can start the agent container locally and calling `POST /generate_preview` with a known-good `pagePlanJson` returns a preview URL.

---

## Phase 5 — Build + deploy the Cloud Run container

Goal: container image includes Node + Firebase CLI + Vertex AI access.

### 5.1 Container requirements
- [x] Node 20
- [x] `firebase-tools`
- [x] Ability to call Vertex AI (ADC / service account)
- [x] Credentials for Firebase deploy
  - fast path PoC: service account JSON in Secret Manager
  - better later: Workload Identity

### 5.2 Deploy and test
- [x] **[Manual / outside editor]** Deploy to Cloud Run
- [x] **[Manual / outside editor]** Smoke test with curl / Postman
  - Verified `GET /whoami` returns Cloud Run service account identity via ADC.
  - Verified `POST /generate_preview` input validation works (400 on missing `projectName`).

**Stop condition:** Cloud Run service can generate + deploy a preview channel end-to-end.

> Status note: Cloud Run endpoint is deployed and reachable, but end-to-end preview deploy is currently **blocked** because the agent expects the skeleton repo at `/workspace` (a local docker mount). Cloud Run has no `/workspace` mount, so `/generate_preview` returns: `skeletonPath is not a directory: /workspace` unless a Cloud Run-accessible `skeletonPath` strategy is implemented (e.g., fetch skeleton from GCS/Git or deploy from a container that includes the skeleton).

---

## Phase 6 — CI/CD for `sitegen-skeleton`

Goal: keep skeleton stable and buildable.

### 6.1 Minimum workflows
- [ ] **[Repo change]** PR workflow: `npm ci` then `npm run build`
- [ ] **[Repo change]** main workflow: `npm ci` then `npm run build`

### Optional
- [ ] PR preview deploys for skeleton changes (useful, not required for PoC)

**[Manual / outside editor]** If CI deploys, you’ll also need GitHub Actions auth (OIDC recommended) and appropriate IAM.

**Stop condition:** PRs can’t merge if build breaks; main stays deployable.

---

## Phase 7 — First end-to-end automated generation

- [ ] Pick a real lead
- [ ] Create an intake JSON file (example):

```json
{
  "channelId": "pharmacy-r1",
  "businessName": "Southside Pharmacy",
  "industry": "independent pharmacy",
  "services": ["Refills", "Vaccinations", "Delivery"],
  "location": "Austin, TX",
  "brandNotes": "Clean, trustworthy, community-focused",
  "cta": "Call for refills"
}
```

- [ ] **[Manual / outside editor]** Call the service:

```powershell
curl.exe -X POST https://YOUR_CLOUD_RUN_URL/generate `
  -H "Content-Type: application/json" `
  -d @pharmacy.json
```

- [ ] **[Manual / outside editor]** Confirm response includes:
  - preview URL
  - channel ID

**Stop condition:** The returned preview URL is a valid “fit link” you can share.

---

## Phase 8 — Next after first success (productizing)

- [ ] Add an “Approve” endpoint (records approval)
- [ ] Promote approved preview to live
- [ ] Store inputs + outputs (GCS JSON logs are fine)
- [ ] Add basic observability (structured logs)
