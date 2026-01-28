# CI/CD: Deploy `sitegen-agent` to Cloud Run (GitHub Actions)

This repo can deploy to Cloud Run automatically on every push to `main`.

## What gets deployed

- A container image built from this repo
- A Cloud Run service configured with env vars for runtime skeleton cloning
- A Secret Manager secret injected as `GITHUB_TOKEN` so the agent can `git clone` the private skeleton repo

## Workflows

- `.github/workflows/pr.yml`
  - Runs on PRs to `main`
  - Installs Python deps and runs `pytest`

- `.github/workflows/deploy-cloudrun.yml`
  - Runs on pushes to `main`
  - Uses **OIDC / Workload Identity Federation** to authenticate to GCP
  - Uses **Cloud Build** to build the image
  - Deploys to Cloud Run with env vars + secrets

## Your target deployment (current)

- **GCP Project**: `hanks-sushi-truck`
- **Region**: `us-central1`
- **Cloud Run service name**: `sitegen-agent`
- **Skeleton repo**: `https://github.com/Devagram/skeleton.git`

## Required GitHub configuration

### Repo Variables (Settings → Secrets and variables → Actions → Variables)

Create these **variables**:

- `GCP_PROJECT_ID`: `hanks-sushi-truck`
- `GCP_REGION`: `us-central1`
- `CLOUD_RUN_SERVICE`: `sitegen-agent`
- `SITEGEN_SKELETON_GIT_URL`: `https://github.com/Devagram/skeleton.git`
- `SITEGEN_SKELETON_REF`: `main`
- `REPO_TOKEN_SECRET`: Secret Manager secret name (example: `github-readonly-token`)
- `AR_REPO`: Artifact Registry repo name (Docker), e.g. `sitegen`

Optional:
- `VERTEX_LOCATION`: `us-central1`
- `VERTEX_MODEL`: `gemini-2.0-flash`

### Repo Secrets (Settings → Secrets and variables → Actions → Secrets)

Create these **secrets**:

- `WIF_PROVIDER`: full resource name of your workload identity provider, e.g.
  - `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>`
- `DEPLOYER_SERVICE_ACCOUNT`: email of the deployer SA.

For this project, reuse the existing Cloud Run SA:
- `DEPLOYER_SERVICE_ACCOUNT`: `sitegen-agent-runner@hanks-sushi-truck.iam.gserviceaccount.com`

> These are identifiers, not long-lived tokens.

## Required GCP setup

### 1) Reuse existing service account as deployer
We will reuse:
- `sitegen-agent-runner@hanks-sushi-truck.iam.gserviceaccount.com`

Grant it deploy/build permissions (see next section).

### 1.1 IAM roles to grant the deployer SA
Grant the SA these roles in project `hanks-sushi-truck`:
- `roles/run.admin` (deploy/update Cloud Run)
- `roles/cloudbuild.builds.editor` (submit builds)
- `roles/storage.admin` (push to `gcr.io` Container Registry)
- `roles/iam.serviceAccountUser` (required if the deploy step sets/uses a runtime service account)

> If you migrate to Artifact Registry later, replace `roles/storage.admin` with `roles/artifactregistry.writer` and adjust the image URL.

### 2) Configure Workload Identity Federation (OIDC)
Create a Workload Identity Pool + Provider for GitHub and bind this repo.

Bind the pool principal to your deployer service account.

### 3) Create Secret Manager secret for GitHub token
Create a fine-grained GitHub token with **Contents: Read** access to the skeleton repo.

Store it in Secret Manager (example secret name: `github-readonly-token`).

Grant the **Cloud Run runtime service account**:
- `roles/secretmanager.secretAccessor` on that secret.

## Cloud Run env vars set by the workflow

The workflow configures:

- `GOOGLE_CLOUD_PROJECT=hanks-sushi-truck`
- `SITEGEN_SKELETON_GIT_URL=https://github.com/Devagram/skeleton.git`
- `SITEGEN_SKELETON_REF=main`

Optional:
- `VERTEX_LOCATION`
- `VERTEX_MODEL`

Secrets:
- `GITHUB_TOKEN` from Secret Manager (`REPO_TOKEN_SECRET`)

## Notes about Firebase auth

- Preferred on Cloud Run: the Cloud Run runtime service account (ADC) with the right Firebase Hosting permissions.
- Avoid using `FIREBASE_TOKEN` in Cloud Run if possible.

## Troubleshooting

- Deploy fails with permission denied:
  - Check deployer SA roles (`run.admin`, `cloudbuild`, registry write)
- Runtime git clone fails:
  - Check Secret Manager injection (`GITHUB_TOKEN`) and token repo access
- Firebase deploy fails in Cloud Run:
  - Ensure runtime SA has Firebase Hosting deploy permissions

## Where to find the required values (GCP Console + GitHub)

### A) `WIF_PROVIDER` (GCP) — where to get it

This comes from **Google Cloud Console → IAM & Admin → Workload Identity Federation**.

For project `hanks-sushi-truck`:
- **Project number**: `1074593120244`
- **Pool**: `github-pool`
- **Provider**: `github-provider`

✅ You already confirmed the service account binding exists:
- `roles/iam.workloadIdentityUser` granted to
  `principalSet://iam.googleapis.com/projects/1074593120244/locations/global/workloadIdentityPools/github-pool/attribute.repository/Devagram/agent`

So your **exact** `WIF_PROVIDER` value is:

- `projects/1074593120244/locations/global/workloadIdentityPools/github-pool/providers/github-provider`

Paste that full string into GitHub Actions secret `WIF_PROVIDER`.

### B) `DEPLOYER_SERVICE_ACCOUNT` (GCP)

You said to reuse the existing SA (recommended):
- `sitegen-agent-runner@hanks-sushi-truck.iam.gserviceaccount.com`

Put that exact email into the GitHub Actions secret `DEPLOYER_SERVICE_ACCOUNT`.

### C) GitHub token for cloning the private skeleton repo

You need a GitHub fine-grained token with read-only access to:
- `Devagram/skeleton`

Create it in GitHub:
1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Generate new token
3. Repository access: **Only select repositories** → `Devagram/skeleton`
4. Permissions: **Contents: Read-only**
5. Copy the token (you will only see it once)

### D) Store the GitHub token in GCP Secret Manager

In Google Cloud Console:
1. Go to **Security → Secret Manager**
2. Click **Create secret**
3. Name it (example): `github-readonly-token`
4. Paste the GitHub token as the secret value

Then grant the runtime/deployer SA access:
- Principal: `sitegen-agent-runner@hanks-sushi-truck.iam.gserviceaccount.com`
- Role: `Secret Manager Secret Accessor` (`roles/secretmanager.secretAccessor`)

### E) GitHub repo variables and secrets (GitHub web UI)

In `Devagram/agent` repo:

**Settings → Secrets and variables → Actions → Variables**:
- `GCP_PROJECT_ID=hanks-sushi-truck`
- `GCP_REGION=us-central1`
- `CLOUD_RUN_SERVICE=sitegen-agent`
- `SITEGEN_SKELETON_GIT_URL=https://github.com/Devagram/skeleton.git`
- `SITEGEN_SKELETON_REF=main`
- `REPO_TOKEN_SECRET=github-readonly-token`
- `AR_REPO=sitegen`

**Settings → Secrets and variables → Actions → Secrets**:
- `WIF_PROVIDER=projects/1074593120244/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- `DEPLOYER_SERVICE_ACCOUNT=sitegen-agent-runner@hanks-sushi-truck.iam.gserviceaccount.com`

### Important: Variables vs Secrets in GitHub

In GitHub Actions:
- **Variables** are for non-sensitive config (project id, region, URLs, refs).
- **Secrets** are for sensitive values (tokens/credentials). For OIDC/WIF you store identifiers as secrets too.

The workflow in this repo expects:
- These to be set as **GitHub Actions Variables**:
  - `GCP_PROJECT_ID`
  - `GCP_REGION`
  - `CLOUD_RUN_SERVICE`
  - `SITEGEN_SKELETON_GIT_URL`
  - `SITEGEN_SKELETON_REF`
  - `REPO_TOKEN_SECRET`
  - `AR_REPO`

- These to be set as **GitHub Actions Secrets**:
  - `WIF_PROVIDER`
  - `DEPLOYER_SERVICE_ACCOUNT`

### What is `REPO_TOKEN_SECRET`?

`REPO_TOKEN_SECRET` is **not** a GitHub token value.

It is the **name of a Secret Manager secret in GCP** that contains your GitHub fine‑grained PAT.

Example:
- You create a Secret Manager secret named `github-readonly-token`
- You store the GitHub PAT *as the secret value*
- You set `REPO_TOKEN_SECRET=github-readonly-token` in GitHub Actions Variables

At deploy time, the workflow runs:
- `--set-secrets "GITHUB_TOKEN=github-readonly-token:latest"`

So Cloud Run gets an env var `GITHUB_TOKEN` filled from Secret Manager.

### Do you need to generate `github-readonly-token`?

You generate a **GitHub PAT** (fine-grained, read-only). Then you store it in GCP Secret Manager.

You do NOT generate a token named `github-readonly-token`. That is just the **secret name** you choose in GCP.
