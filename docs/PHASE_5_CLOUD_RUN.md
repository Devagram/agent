# Phase 5 — Cloud Run container (ADK agent)

This phase gets the `sitegen-agent` container ready to run on **Cloud Run**:

- Node 20 available (for building the Astro site + the ADK generator)
- `firebase-tools` available (for Hosting preview channel deploy)
- Vertex AI access via **Application Default Credentials (ADC)**
- Firebase Hosting deploy using a **service account** (recommended) or a PoC key

> No secrets should be committed to the repo.

---

## 1) Container build requirements (repo)

The Docker image lives at:

- `sitegen-agent/Dockerfile`

It includes:

- Python runtime (FastAPI server)
- Node 20 (`node`, `npm`)
- `firebase-tools` pinned
- `sitegen-agent/adk` Node deps installed

---

## 2) Cloud Run service account + roles

### Create / choose a service account
Create a dedicated service account for Cloud Run, e.g.:

- `sitegen-agent-runner@<PROJECT>.iam.gserviceaccount.com`

### Minimum IAM you’ll typically need
Exact roles can vary by org policy, but these are the common ones:

- Vertex AI
  - `roles/aiplatform.user`
- Firebase Hosting deploy (via Firebase CLI)
  - `roles/firebasehosting.admin`
  - `roles/firebase.admin` (broad; avoid if you can)

If you see permission errors in logs, tighten/adjust based on the missing permission.

---

## 3) Credentials strategy (recommended: ADC)

### Recommended (no keys): Cloud Run ADC
On Cloud Run, **do not set** `GOOGLE_APPLICATION_CREDENTIALS`.

- Attach the service account to the Cloud Run service.
- The app uses `google-auth` default credentials (ADC) automatically.

This is the preferred approach for both security and ops.

### PoC fallback (key file in Secret Manager)
If you must use a key file:

1. Put the JSON key in Secret Manager.
2. Mount it into the container.
3. Set `GOOGLE_APPLICATION_CREDENTIALS` to the mounted path.

---

## 4) Required environment variables

Set these on the Cloud Run service:

- `FIREBASE_PROJECT` — Firebase project id used by `firebase hosting:channel:deploy`
  - If unset, the agent falls back to `GOOGLE_CLOUD_PROJECT`.
- `GOOGLE_CLOUD_PROJECT` — used for Vertex AI auth + defaults
- `VERTEX_LOCATION` — e.g. `us-central1`
- `VERTEX_MODEL` — e.g. `gemini-2.0-flash`

Optional:

- `SITEGEN_ADK_DIR` — defaults to `/app/adk` in the container

---

## 5) Endpoints to smoke test

- `GET /healthz`
- `GET /whoami` (helps verify Cloud Run identity / ADC)
- `POST /generate_preview`

---

## 6) Local docker validation

Use `docker-compose.adk.yml`.

You need *one* auth option for local runs:

- ADC mount (recommended): run `gcloud auth application-default login` on your machine and mount the ADC file.
- Or a local service-account key file mounted into the container.

---

## 7) Notes on Firebase deploy from Cloud Run

The pipeline deploy step is:

- `firebase hosting:channel:deploy <channelId> --project <FIREBASE_PROJECT> --json`

So the service account must be permitted to deploy to Hosting.

If Firebase CLI can’t find creds, it will fail fast and the error text will show up in Cloud Run logs and the API response.

---

## 8) Deploy to Cloud Run (PowerShell, copy/paste)

Assumptions (provided):

- GCP project id: `hanks-sushi-truck`
- Region: `us-central1`
- Cloud Run service name: `sitegen-agent`

### 8.1 Set variables

```powershell
$PROJECT_ID = "hanks-sushi-truck"
$REGION = "us-central1"
$SERVICE = "sitegen-agent"
$SA_NAME = "sitegen-agent-runner"
$SA_EMAIL = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
```

### 8.2 Select project + enable APIs

```powershell
gcloud config set project $PROJECT_ID

gcloud services enable run.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  aiplatform.googleapis.com
```

### 8.3 Create the Cloud Run service account

```powershell
# Creates the SA if it doesn't exist. (If it already exists, this will error; that's okay.)
gcloud iam service-accounts create $SA_NAME `
  --display-name "Sitegen Agent (Cloud Run)"
```

### 8.4 Grant IAM roles (adjust if your org policy requires different ones)

```powershell
# Vertex AI calls (used by the ADK generator)
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member "serviceAccount:$SA_EMAIL" `
  --role "roles/aiplatform.user"

# Firebase Hosting preview deploy (used by firebase-tools)
# If this is too broad for your org, tighten based on the permission error message.
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member "serviceAccount:$SA_EMAIL" `
  --role "roles/firebasehosting.admin"
```

### 8.5 Build + deploy to Cloud Run

From the repo root (`sitegen-skeleton/`). Note: your `gcloud` does **not** support `--dockerfile`.
For source deploys, `gcloud` will use a `Dockerfile` if it’s present at the **source directory root**.

So we deploy using `--source .\sitegen-agent`.

```powershell
cd "C:\Users\tomp4\Agent Automations\sitegen-skeleton"

gcloud run deploy $SERVICE `
  --project $PROJECT_ID `
  --region $REGION `
  --source .\sitegen-agent `
  --service-account $SA_EMAIL `
  --allow-unauthenticated `
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,FIREBASE_PROJECT=$PROJECT_ID,VERTEX_LOCATION=$REGION,VERTEX_MODEL=gemini-2.0-flash"
```

Notes:

- Cloud Run will automatically provide ADC for the attached service account.
- Do **not** set `GOOGLE_APPLICATION_CREDENTIALS` on Cloud Run unless you are using the Secret Manager key-file fallback.

### 8.6 Smoke test endpoints

`/healthz` may be intercepted at the edge (returns a Google HTML 404 even though FastAPI exposes it).
Use `/_health` for smoke tests.

```powershell
$SERVICE_URL = gcloud run services describe $SERVICE --region $REGION --format "value(status.url)"

curl.exe -s "$SERVICE_URL/_health"
curl.exe -s "$SERVICE_URL/whoami"
```

Expected:

- `/_health` returns `{ "ok": true }`
- `/whoami` returns `project`, `serviceAccountEmail`, and `credentialType`

### 8.7 Minimal generate_preview test (no Vertex call)

This uses a provided plan so it doesn’t require Vertex working yet.

PowerShell note: passing large JSON directly via `-d $body` can get mangled by quoting/encoding rules.
The most reliable pattern is: **write JSON to a file** and use `--data-binary @file`.

```powershell
cd "C:\Users\tomp4\Agent Automations\sitegen-skeleton"

$SERVICE_URL = gcloud run services describe $SERVICE --region $REGION --format "value(status.url)"

$payload = @{
  projectName = "Phase5 Smoke"
  firebaseProjectId = $PROJECT_ID
  pagePlanJson = (Get-Content -Raw .\content\page_plan.json | ConvertFrom-Json)
}

# Write valid JSON to disk (UTF-8) and POST it
$tmp = Join-Path $env:TEMP "sitegen-generate_preview.json"
$payload | ConvertTo-Json -Depth 50 | Out-File -Encoding utf8 $tmp

curl.exe -s -X POST "$SERVICE_URL/generate_preview" \
  -H "Content-Type: application/json" \
  --data-binary "@$tmp"
```

If deploy succeeds, response includes:

- `previewUrl`
- `channelId`

---

## 9) Troubleshooting quick hits

- **403 / permission denied (Vertex)**: ensure the Cloud Run service account has `roles/aiplatform.user` and the model/location are correct.
- **Firebase deploy auth errors**: ensure the Cloud Run service account has Hosting deploy permissions (try `roles/firebasehosting.admin` first).
- **Deploy succeeded but no previewUrl**: firebase-tools output format can vary; check Cloud Run logs for the raw firebase output.
