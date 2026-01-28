You are an expert AI coding assistant working on **sitegen-agent**.

# What is sitegen-agent?

sitegen-agent is the **agent service repository** in a two-repo architecture:
- **Sibling repo (sitegen-skeleton)**: Astro-based static site generator + section library + schemas
- **This repo (sitegen-agent)**: FastAPI service that orchestrates the entire site generation pipeline

This service runs on **Google Cloud Run** and provides an HTTP API for generating and deploying website previews.

## Architecture Split (Post-Monorepo)

This repo was split from a monorepo. Key responsibilities:
- **Clones sitegen-skeleton at runtime** using `git clone` (supports private repos via GitHub token)
- **Generates page plans** using Gemini via Google ADK (Vertex AI)
- **Validates page plans** using the skeleton's own validation scripts
- **Builds static sites** by running `npm run build` in the cloned skeleton
- **Deploys to Firebase Hosting** preview channels
- **No baked-in skeleton dependency**: Uses environment variables to fetch skeleton dynamically

# Project Architecture

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| FastAPI server | `sitegen_agent/server.py` | HTTP API (`/healthz`, `/generate_preview`) |
| Pipeline | `sitegen_agent/pipeline.py` | Orchestrates clone → generate → validate → build → deploy |
| ADK generator | `adk/` | Node.js + Google ADK for Gemini-powered page plan generation |
| Dockerfile | `Dockerfile`, `Dockerfile.cloudrun` | Container images for Cloud Run deployment |
| Tests | `tests/` | Python tests (pytest) for pipeline validation |
| Docs | `docs/` | Deployment guides and architecture docs |

## Pipeline Flow

```
1. Receive /generate_preview request
2. Clone skeleton from SITEGEN_SKELETON_GIT_URL (or use local path for dev)
3. Generate page_plan.json via ADK + Gemini (or use provided plan)
4. Stage skeleton into temp workspace
5. Write page_plan.json to content/
6. Run npm ci (install deps)
7. Validate page plan (skeleton's validator)
8. Build site (npm run build)
9. Deploy to Firebase Hosting preview channel
10. Return preview URL
```

## Environment Variables

### Required
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `SITEGEN_SKELETON_GIT_URL` - GitHub URL of skeleton repo (e.g., `https://github.com/<USER>/sitegen-skeleton.git`)
- `SITEGEN_SKELETON_REF` - Branch/tag to clone (default: `main`)

### Secrets (from Secret Manager)
- `GITHUB_TOKEN` - Fine-grained token with read access to skeleton repo (for private repos)

### Optional
- `SITEGEN_SKELETON_DIR` - Local path override (for development)
- `VERTEX_LOCATION` - Vertex AI region (default: `us-central1`)
- `VERTEX_MODEL` - Gemini model (default: `gemini-1.5-pro`)
- `SITEGEN_ADK_DIR` - Path to ADK generator (default: `/app/adk`)

## Skeleton Resolution Precedence

The agent resolves the skeleton in this order:
1. **Request-level**: `skeletonPath` in request body (local dev only)
2. **Runtime clone**: If `SITEGEN_SKELETON_GIT_URL` is set, clone into temp dir
3. **Fallback**: `SITEGEN_SKELETON_DIR` or baked-in paths (`/workspace`, `/app/skeleton`)

**Production (Cloud Run)**: Use option 2 (runtime clone) for clean separation and easy skeleton updates.

# Coding Standards

- Use modern Python 3.11+ features (this service runs on Python 3.11+)
- Use type hints for all function signatures
- Prefer async/await for I/O-bound operations where beneficial
- Use `pathlib.Path` over string paths
- Handle errors gracefully with clear error messages
- Log important pipeline steps for debugging
- Write tests for pipeline logic changes

# Non-Negotiable Requirements

1. **No skeleton bundling**: Never bake skeleton into the image; always clone at runtime
2. **Secure credentials**: Use Secret Manager for GitHub tokens; never commit secrets
3. **Idempotent operations**: Pipeline must be safe to retry (use temp directories)
4. **Clear error messages**: Pipeline failures must surface validation/build errors clearly
5. **Schema contract**: Respect the skeleton's `page_plan.json` schema exactly
6. **Shallow clones**: Use `git clone --depth 1` to minimize clone time and storage
7. **Clean temp dirs**: Always use `tempfile.TemporaryDirectory()` for workspace isolation

# What sitegen-agent is NOT

- ❌ Not a web framework (it's a thin orchestrator)
- ❌ Not a content management system
- ❌ Not a skeleton fork (it consumes skeleton as a library)
- ❌ Not responsible for rendering logic (that's in skeleton)

If a feature belongs in the rendering layer, it should go in the skeleton repo, not here.

# Workflow

## Local Development

```powershell
# Run agent locally with Docker Compose
docker compose -f docker-compose.adk.yml up -d --build

# Test health endpoint
curl http://localhost:8088/healthz

# Test with a known-good page plan
curl -X POST http://localhost:8088/generate_preview \
  -H "Content-Type: application/json" \
  --data-binary "@tmp.generate_preview.json"
```

## Testing with Local Skeleton

Mount the sibling skeleton repo for development:
- Set `SITEGEN_SKELETON_DIR` to point to local skeleton clone
- Or add `skeletonPath` to the request body
- This lets you test skeleton changes before pushing

## Deployment to Cloud Run

Follow `docs/CLOUD_RUN_DEPLOY.md`:
1. Create GitHub fine-grained token (read-only, skeleton repo)
2. Store token in Secret Manager
3. Deploy with `gcloud run deploy` setting env vars and secret mounts

## Pipeline Modifications

When changing `sitegen_agent/pipeline.py`:
1. Write/update tests in `tests/test_pipeline.py`
2. Run locally: `pytest -v`
3. Test with actual skeleton clone if clone logic changes
4. Update docs if new env vars are added

# API Endpoints

## `GET /healthz`
Health check endpoint for Cloud Run probes.

**Response**: `{ "ok": true }`

## `GET /_health`
Alternate health endpoint (Cloud Run may intercept `/healthz`).

**Response**: `{ "ok": true }`

## `POST /generate_preview`
Generate and deploy a Firebase Hosting preview channel.

**Request body**:
```json
{
  "projectName": "my-business",
  "firebaseProjectId": "my-firebase-project",
  "channelId": "optional-channel-id",
  "pagePlanJson": {},
  "skeletonPath": "/path/to/local/skeleton"
}
```

Notes:
- `pagePlanJson`: Optional. If omitted, ADK will generate via Gemini
- `skeletonPath`: Optional. For local dev only; omit for Cloud Run
- `channelId`: Optional. Defaults to `<projectName>-<YYYYMMDD>`

**Response**:
```json
{
  "previewUrl": "https://my-business-20260127--my-firebase-project.web.app",
  "channelId": "my-business-20260127"
}
```

**Errors**: Returns HTTP 400/500 with error details in response body.

# Key Files

| File | Purpose |
|------|---------|
| `sitegen_agent/pipeline.py` | Main orchestration logic, clone/build/deploy |
| `sitegen_agent/server.py` | FastAPI app, thin HTTP wrapper |
| `adk/src/generate-page-plan.mjs` | ADK + Gemini page plan generator |
| `Dockerfile` | Local development image |
| `Dockerfile.cloudrun` | Production Cloud Run image |
| `docker-compose.adk.yml` | Local compose setup with mounts |
| `pyproject.toml` | Python dependencies |
| `docs/CLOUD_RUN_DEPLOY.md` | Deployment guide |
| `docs/REPO_SPLIT_PLAN.md` | Split architecture checklist |

# Troubleshooting

## "skeletonPath is not a directory"
- Cloud Run: Set `SITEGEN_SKELETON_GIT_URL` and `GITHUB_TOKEN` (runtime clone)
- Local: Mount skeleton or set `SITEGEN_SKELETON_DIR`

## "Failed to authenticate" (Firebase)
- Cloud Run: Service account needs Firebase Hosting permissions
- Local: Mount ADC credentials or firebase-tools config

## "ADK page plan generation failed"
- Check Vertex AI API is enabled
- Verify service account has Vertex AI user role
- Check `VERTEX_LOCATION` and `VERTEX_MODEL` env vars

## Git clone fails with authentication error
- Verify `GITHUB_TOKEN` is set and not expired
- Token must have read access to skeleton repo
- For private repos, token is required; public repos work without it
