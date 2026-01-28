# Repo Split Plan — `sitegen-skeleton` → (A) `sitegen-skeleton` + (B) `sitegen-agent`

This doc is a **step-by-step, do-this-next checklist** to split the current monorepo into two repos (recommended Option A):

- **Renderer repo**: `sitegen-skeleton` (Astro + section library + schemas + validation + Firebase hosting config)
- **Agent repo**: `sitegen-agent` (FastAPI + ADK + Cloud Run + Firebase preview deploy)

It also shows how to keep both repos open in **one WebStorm project** for maximum Copilot context.

> Decisions locked in (per current plan)
> - **Strategy A1**: agent fetches skeleton by **`git clone` at runtime**.
> - Both repos are **private**.
> - Skeleton pinning is **branch-based** for now (later you should move to immutable tags/SHAs).

---

## 0) Preconditions / decisions (5 minutes)

Make these decisions first so you don’t redo work:

1. GitHub repo names
   - `sitegen-skeleton` (renderer)
   - `sitegen-agent` (cloud service)
2. Visibility
   - [x] Both repos will be **private**.
3. Skeleton consumption strategy (agent)
   - [x] **A1**: agent clones the skeleton at runtime using a pinned **branch** (temporary).
   - Avoid relying on `/workspace` in Cloud Run.
4. GitHub account
   - You **do not** need an org for this. Plan assumes a personal GitHub username.
   - Throughout this doc, replace `<GITHUB_USERNAME>` with your GitHub username.

---

## 0.1) One-time tool install (Windows)

### Install `git-filter-repo`

Preferred (Python/pip):

```powershell
python -m pip install --user git-filter-repo
```

Validate:

```powershell
git filter-repo --help
```

If `git filter-repo` isn’t found after install, ensure your user Scripts path is on PATH (or re-open the terminal).

---

## 2) Split approach — Option 2A (recommended): split with history preserved (`git filter-repo`)

This keeps commit history for each new repo.

### 2A.1 Make a safety backup (tag + optional zip)

In the current monorepo:

```powershell
cd "C:\Users\tomp4\Agent Automations\sitegen-skeleton"

# Tag the last monorepo state
# (If you already made this tag, git will complain; that’s fine.)
git tag monorepo-last
```

Optional belt-and-suspenders: create a zip copy of the folder outside git.

### 2A.2 Create two fresh working clones

Create sibling folders:

- `...\split-work\skeleton`
- `...\split-work\agent`

Then:

```powershell
# Pick a parent folder you like; example:
$P = "C:\Users\tomp4\Agent Automations\split-work"
New-Item -ItemType Directory -Force -Path $P | Out-Null

git clone "C:\Users\tomp4\Agent Automations\sitegen-skeleton" "$P\skeleton"
git clone "C:\Users\tomp4\Agent Automations\sitegen-skeleton" "$P\agent"
```

(Yes, cloning from a local path works.)

### 2A.3 Create the new `sitegen-skeleton` repo (remove agent subtree)

In the `skeleton` clone:

```powershell
cd "$P\skeleton"

# Remove the agent subtree from history
# (Repeat: this rewrites history in THIS clone only.)
git filter-repo --path sitegen-agent --invert-paths

# Optional: keep docker-compose.adk.yml with agent instead of skeleton
# git filter-repo --path docker-compose.adk.yml --invert-paths
```

Sanity check:

```powershell
npm ci
npm run validate:plan
npm run build
```

### 2A.4 Create the new `sitegen-agent` repo (keep only agent subtree)

In the `agent` clone:

```powershell
cd "$P\agent"

# Keep only the agent subtree
# This rewrites history in THIS clone only.
git filter-repo --path sitegen-agent
```

Now promote `sitegen-agent/` contents to repo root.

```powershell
# Move everything under sitegen-agent/ up to the repo root
# (PowerShell moves folders and files)
Get-ChildItem -Force sitegen-agent | ForEach-Object {
  Move-Item -Force $_.FullName .
}
Remove-Item -Recurse -Force sitegen-agent
```

After promotion, you should have:

- `pyproject.toml`
- `sitegen_agent/`
- `adk/`
- `tests/`
- `Dockerfile`

(If names differ slightly, adjust.)

---

## 3) GitHub setup (both repos)

1. Create **two private** repos on GitHub (under your personal account):
   - `sitegen-skeleton`
   - `sitegen-agent`
2. Add remotes and push.

Example:

```powershell
# In split-work\skeleton
cd "$P\skeleton"
git remote remove origin 2>$null
# Replace <GITHUB_USERNAME> with your username
git remote add origin https://github.com/<GITHUB_USERNAME>/sitegen-skeleton.git
git push -u origin main --tags

# In split-work\agent
cd "$P\agent"
git remote remove origin 2>$null
# Replace <GITHUB_USERNAME> with your username
git remote add origin https://github.com/<GITHUB_USERNAME>/sitegen-agent.git
git push -u origin main --tags
```

---

## 5) WebStorm: keep both repos in one project

Recommended layout:

```
sitegen-workspace/
  sitegen-skeleton/
  sitegen-agent/
```

Open **`sitegen-workspace/`** in WebStorm.

---

## 7) Cloud Run agent changes: A1 runtime `git clone` of private skeleton (required)

Because both repos are private, Cloud Run must authenticate to GitHub.

### 7.1 Add agent env vars

Configure these env vars on Cloud Run:

- `SITEGEN_SKELETON_GIT_URL`:
  - `https://github.com/<GITHUB_USERNAME>/sitegen-skeleton.git`
- `SITEGEN_SKELETON_REF` (branch pin for now):
  - `main`

### 7.2 Provide GitHub credentials securely (Secret Manager)

Recommended: store a GitHub token in Secret Manager and inject it as an env var.

- Secret name example: `github-readonly-token`
- Env var example: `GITHUB_TOKEN`

Token guidance:

- Prefer a **fine-grained personal access token** with **read-only** access scoped to:
  - Repository: `sitegen-skeleton`
  - Permissions: Contents (Read)
- Set an expiration date and rotate it later.

Then the agent should clone using **token-in-URL** (runtime only):

- `https://x-access-token:${GITHUB_TOKEN}@github.com/<GITHUB_USERNAME>/sitegen-skeleton.git`

Notes:

- Never commit tokens.
- If you later create a GitHub org or GitHub App, switch to that auth method (more scalable).

### 7.3 Pipeline behavior (post-split)

Update the agent pipeline so that:

1. If request includes `skeletonPath`: use it (only for local dev)
2. Else: clone from `SITEGEN_SKELETON_GIT_URL` at `SITEGEN_SKELETON_REF` into `/tmp` and build from there

This removes the Cloud Run dependency on `/workspace`.

---

## 9) Post-split verification checklist

### Skeleton repo

- `npm ci`
- `npm run validate:plan`
- `npm run build`

### Agent repo

- Local docker:
  - Mount sibling skeleton to `/workspace:ro` and verify `/generate_preview`
- Cloud Run:
  - `/whoami` works
  - `/generate_preview` works end-to-end even without `/workspace`

---

## 10) Suggested sequencing (fastest path)

1. Split with `git filter-repo`.
2. Get both repos open in one WebStorm project.
3. Implement A1 (private git clone) in the agent pipeline.
4. Deploy agent to Cloud Run with Secret Manager token injection.
5. Only then add CI workflows.
