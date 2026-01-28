# Repo Split Plan — `sitegen-skeleton` → (A) `sitegen-skeleton` + (B) `sitegen-agent`

This document is a single, actionable checklist to split the monorepo into two repos and finish the Cloud Run agent work.

Last updated: 2026-01-27

Checklist legend:
- [x] Done
- [ ] Todo / pending

---

## 0) Preconditions / decisions (5 minutes)
- [x] Decide GitHub repo names: `sitegen-skeleton` (renderer) and `sitegen-agent` (agent)
- [x] Decide visibility: both repos private
- [x] Skeleton consumption strategy: A1 — agent clones skeleton at runtime (branch pin for now)
- [x] GitHub account decision: personal account assumed (replace `<GITHUB_USERNAME>` in commands)

## 0.1) One-time tool install (Windows)
- [x] Install `git-filter-repo` (recommended):
  - `python -m pip install --user git-filter-repo`
  - Validate: `git filter-repo --help`

---

## 2) Split approach — Option 2A (recommended): split with history preserved (`git filter-repo`)
Goal: create two new repos that preserve history for their respective subtrees.

### 2A.1 Make a safety backup
- [x] Tag last monorepo state in the current repo:
  - `git tag monorepo-last`
- [x] Optional: create a zip copy of the workspace as a backup

### 2A.2 Create two fresh working clones
- [x] Create sibling clones (example PowerShell):
  - `$P = "C:\Users\tomp4\Agent Automations\split-work"`
  - `git clone "C:\Users\tomp4\Agent Automations\sitegen-skeleton" "$P\skeleton"`
  - `git clone "C:\Users\tomp4\Agent Automations\sitegen-skeleton" "$P\agent"`

### 2A.3 Create `sitegen-skeleton` repo (remove agent subtree)
- [x] In the skeleton clone, remove the `sitegen-agent` subtree from history:
  - `git filter-repo --path sitegen-agent --invert-paths`
- [x] Sanity check skeleton build locally:
  - `npm ci`
  - `npm run validate:plan`
  - `npm run build`

### 2A.4 Create `sitegen-agent` repo (keep only agent subtree)
- [x] In the agent clone, keep only `sitegen-agent` subtree:
  - `git filter-repo --path sitegen-agent`
- [x] Promote `sitegen-agent/` contents to repo root (PowerShell example):
  - `Get-ChildItem -Force sitegen-agent | ForEach-Object { Move-Item -Force $_.FullName . }`
  - `Remove-Item -Recurse -Force sitegen-agent`
- [ x Verify expected root files exist (pyproject.toml, sitegen_agent/, adk/, tests/, Dockerfile)

---

## 3) GitHub setup (both repos)
- [x] Create two private repos on GitHub under your account:
  - `sitegen-skeleton`
  - `sitegen-agent`
- [x] Push split clones to GitHub (PowerShell examples):
  - In skeleton clone:
    - `git remote remove origin 2>$null`
    - `git remote add origin https://github.com/<GITHUB_USERNAME>/sitegen-skeleton.git`
    - `git push -u origin main --tags`
  - In agent clone:
    - `git remote remove origin 2>$null`
    - `git remote add origin https://github.com/<GITHUB_USERNAME>/sitegen-agent.git`
    - `git push -u origin main --tags`

---

## 5) WebStorm: keep both repos in one project
- [x] Create workspace layout:
  - `sitegen-workspace/`
    - `sitegen-skeleton/`
    - `sitegen-agent/`
- [x] Open `sitegen-workspace/` in WebStorm so both repos are available in one project (confirmed done)

---

## 6) CI/CD for `sitegen-skeleton` (keep skeleton stable and buildable)
- [x] Minimum workflows to add to `sitegen-skeleton`:
  - PR workflow: run `npm ci` then `npm run build` (created at `.github/workflows/pr.yml`)
  - main workflow: run `npm ci` then `npm run build` (created at `.github/workflows/main.yml`)
- [ ] Optional: PR preview deploys for skeleton changes (use OIDC and IAM if needed)

## 6.2 CI/CD for `sitegen-agent` (deploy)
- [x] Add PR workflow: run `pytest`
- [x] Add main workflow: build image + deploy to Cloud Run via OIDC (Workload Identity Federation)
- [ ] Configure GitHub repo variables/secrets and GCP WIF + IAM (see `docs/CI_CD_CLOUD_RUN.md`)


---

## 7) Cloud Run agent changes: A1 runtime `git clone` of private skeleton (required)
Goal: ensure the agent can fetch the skeleton at runtime without relying on `/workspace`.

**📖 See detailed guide**: [CLOUD_RUN_DEPLOY.md](./CLOUD_RUN_DEPLOY.md)

### 7.1 Env vars to configure on Cloud Run
- [ ] `SITEGEN_SKELETON_GIT_URL` (example: `https://github.com/Devagram/skeleton.git`)
- [ ] `SITEGEN_SKELETON_REF` (branch pin, example: `main`)
- [ ] `SITEGEN_SKELETON_DIR` (optional baked-in path fallback)

### 7.2 Provide GitHub credentials securely (Secret Manager)
- [ ] Create a Secret in Secret Manager (example name: `github-readonly-token`)
- [ ] Inject secret as env var `GITHUB_TOKEN` into Cloud Run
- [ ] Use a fine-grained, read-only token scoped to repository contents and rotate it periodically

### 7.3 Pipeline behavior (post-split)
- [x] Pipeline should follow this resolution order:
  1. If request includes `skeletonPath`: use it (local/dev)
  2. Else if `SITEGEN_SKELETON_GIT_URL` is set: clone that repo at `SITEGEN_SKELETON_REF` into a temp dir and use the clone
  3. Else fall back to `SITEGEN_SKELETON_DIR` or baked-in locations
- [x] Implemented in `sitegen_agent/pipeline.py` with `_clone_skeleton_into_workdir()` helper

---

## 9) Post-split verification checklist
### Skeleton repo
- [x] `npm ci`
- [x] `npm run validate:plan`
- [x] `npm run build`

### Agent repo
- [x] Local docker: container builds and starts, `/generate_preview` reaches Firebase deploy step
- [x] Local docker: Firebase deploy succeeds using `FIREBASE_TOKEN` (non-interactive auth)
- [ ] Cloud Run: `/whoami` works (health)
- [ ] Cloud Run: `/generate_preview` works end-to-end even without `/workspace` (uses runtime clone)

---

## 10) Suggested sequencing (fastest path)
- [ ] 1. Split with `git filter-repo` (2A) — Complete steps 2A.1 through 2A.4 above
- [x] 2. Get both repos open in one WebStorm project
- [x] 3. Implement A1 (private git clone) in the agent pipeline
- [ ] 4. Deploy agent to Cloud Run with Secret Manager token injection (see CLOUD_RUN_DEPLOY.md)
- [x] 5. Add CI workflows (skeleton workflows created in .github/workflows/)

---

## Summary of completed work (post-stage 5)

### Completed
- [x] **Pipeline implementation** (step 7.3): Added `_clone_skeleton_into_workdir()` function to `sitegen_agent/pipeline.py`
  - Clones from `SITEGEN_SKELETON_GIT_URL` at `SITEGEN_SKELETON_REF`
  - Supports private repos via `GITHUB_TOKEN` (injected at runtime)
  - Falls back to local paths for dev/testing
- [x] **CI workflows** (step 6): Created GitHub Actions workflows for skeleton repo
  - `.github/workflows/pr.yml` — runs on pull requests
  - `.github/workflows/main.yml` — runs on main branch pushes
  - Both workflows: `npm ci` → `validate:plan` → `build`
- [x] **Documentation**: Created `docs/CLOUD_RUN_DEPLOY.md` with:
  - Step-by-step Secret Manager setup
  - Cloud Run deployment commands
  - Troubleshooting guide
  - Security notes and cost optimization tips
- [x] **Updated README**: Agent README now documents skeleton resolution precedence and new env vars

### Next actions (manual steps required)
The following steps require manual execution outside the editor:

1. **Complete the repo split** (steps 2A.1-2A.4):
   - Tag monorepo: `git tag monorepo-last`
   - Clone twice into split-work folder
   - Run `git filter-repo` on each clone
   - Verify builds succeed

2. **Push to GitHub** (step 3):
   - Create `sitegen-skeleton` and `sitegen-agent` private repos on GitHub
   - Push both clones to their respective GitHub repos

3. **Deploy to Cloud Run** (step 7):
   - Follow `docs/CLOUD_RUN_DEPLOY.md` guide
   - Create GitHub personal access token
   - Store token in Secret Manager
   - Deploy agent with env vars and secret injection

4. **Verify end-to-end** (step 9):
   - Test skeleton build independently
   - Test agent locally with docker-compose
   - Test agent on Cloud Run without `/workspace` mount
