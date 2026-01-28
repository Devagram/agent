from __future__ import annotations

import json
import os
import re
import shutil as _shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping
from datetime import UTC, datetime


@dataclass(frozen=True)
class DeployResult:
    preview_url: str | None


def _default_channel_id(project_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", project_name.lower()).strip("-")[:40]

    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return f"{slug or 'site'}-{stamp}"


def _require_cmd(cmd: str) -> None:
    if _shutil.which(cmd):
        return
    # Windows firebase may be firebase.cmd, npm may be npm.cmd. which() covers both.
    raise RuntimeError(
        f"Required command '{cmd}' was not found on PATH. "
        "This pipeline is intended to run inside the Docker container (which includes Node/npm + firebase-tools)."
    )


def _run(cmd: list[str], *, cwd: Path, env: dict[str, str] | None = None) -> str:
    _require_cmd(cmd[0])
    p = subprocess.run(
        cmd,
        cwd=str(cwd),
        env={**os.environ, **(env or {})},
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        shell=(os.name == "nt"),
    )
    if p.returncode != 0:
        raise RuntimeError(f"Command failed ({p.returncode}): {' '.join(cmd)}\n{p.stdout}")
    return p.stdout


def _stage_skeleton(skeleton_path: Path, workdir: Path) -> Path:
    if not skeleton_path.exists() or not skeleton_path.is_dir():
        raise RuntimeError(f"skeletonPath is not a directory: {skeleton_path}")

    dest = workdir / "skeleton"

    def ignore(_dir: str, names: list[str]):
        drop = {"node_modules", "dist", ".git", "sitegen-agent"}
        return [n for n in names if n in drop]

    _shutil.copytree(skeleton_path, dest, ignore=ignore, dirs_exist_ok=True)
    return dest


def _validate_page_plan(staged: Path) -> None:
    # Use the skeleton’s own validator for contract alignment.
    _run(["npm", "run", "validate:plan"], cwd=staged)


def _build_site(staged: Path) -> None:
    _run(["npm", "ci"], cwd=staged)
    _run(["npm", "run", "build"], cwd=staged)


def _deploy_preview(*, staged: Path, firebase_project_id: str, channel_id: str) -> DeployResult:
    # Prefer machine-readable output so we don't depend on Firebase CLI formatting.
    out = _run(
        [
            "firebase",
            "hosting:channel:deploy",
            channel_id,
            "--project",
            firebase_project_id,
            "--json",
        ],
        cwd=staged,
    )

    # First try: parse JSON output produced by firebase-tools.
    try:
        payload = json.loads(out)
        # firebase-tools commonly includes result/hosting sites, but format can vary.
        # Search for any https URL that looks like a preview.
        def _find(obj: Any) -> str | None:
            if isinstance(obj, str):
                if obj.startswith("https://") and ("--" in obj) and (
                    obj.endswith(".web.app") or obj.endswith(".firebaseapp.com")
                ):
                    return obj
                return None
            if isinstance(obj, list):
                for v in obj:
                    hit = _find(v)
                    if hit:
                        return hit
            if isinstance(obj, dict):
                for v in obj.values():
                    hit = _find(v)
                    if hit:
                        return hit
            return None

        url = _find(payload)
        return DeployResult(preview_url=url)
    except Exception:
        # Fallback: regex scrape from text output.
        m = re.findall(
            r"https://[a-z0-9-]+--[a-z0-9-]+\.(?:web\.app|firebaseapp\.com)\b",
            out,
            flags=re.I,
        )
        return DeployResult(preview_url=m[-1] if m else None)


def _generate_page_plan_via_vertex(req: Mapping[str, Any], *, generator_dir: Path) -> Any:
    """Generate a page plan by invoking the Node/@google-adk generator.

    Contract:
    - stdin: { intake: <request object> }
    - stdout: JSON page plan
    - non-zero exit: treated as failure; stderr/stdout surfaced
    """

    _require_cmd("node")

    p = subprocess.run(
        ["node", "src/generate-page-plan.mjs"],
        cwd=str(generator_dir),
        env=os.environ.copy(),
        input=json.dumps({"intake": dict(req)}),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        shell=(os.name == "nt"),
    )

    if p.returncode != 0:
        combined = (p.stderr or "") + ("\n" if p.stderr and p.stdout else "") + (p.stdout or "")
        raise RuntimeError(
            "ADK page plan generation failed. "
            "(Ensure the generator is implemented and has Vertex credentials.)\n" + combined
        )

    out = (p.stdout or "").strip()
    if not out:
        raise RuntimeError("ADK generator produced empty stdout.")

    try:
        return json.loads(out)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"ADK generator did not output valid JSON.\n\n{out[:2000]}") from e


def generate_and_deploy_preview(req: Mapping[str, Any]) -> dict[str, str]:
    firebase_project_id = (
        str(req.get("firebaseProjectId"))
        if req.get("firebaseProjectId")
        else (os.environ.get("FIREBASE_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "")
    )
    project_name = str(req.get("projectName"))

    if not firebase_project_id:
        raise RuntimeError(
            "firebaseProjectId is required (or set FIREBASE_PROJECT / GOOGLE_CLOUD_PROJECT in the container environment)."
        )

    channel_id = str(req.get("channelId")) if req.get("channelId") else _default_channel_id(project_name)

    # Skeleton resolution:
    # - Cloud Run: the image bakes a copy of the skeleton at /app/skeleton.
    # - Local docker-compose: /workspace may be mounted read-only.
    # - Request can override via skeletonPath.
    default_skeleton = os.environ.get("SITEGEN_SKELETON_DIR") or (
        "/workspace" if Path("/workspace").exists() else "/app/skeleton"
    )
    skeleton_path = Path(str(req.get("skeletonPath") or default_skeleton))

    with tempfile.TemporaryDirectory(prefix="sitegen-") as tmp:
        workdir = Path(tmp)
        staged = _stage_skeleton(skeleton_path, workdir)

        plan = req.get("pagePlanJson")
        if plan is None:
            # In the Docker image, the ADK generator is installed at /app/adk.
            # For local/dev (outside container), fall back to repo-relative resolution.
            generator_dir = Path(os.environ.get("SITEGEN_ADK_DIR", "/app/adk"))
            if not generator_dir.exists():
                generator_dir = Path(__file__).resolve().parents[2] / "adk"

            plan = _generate_page_plan_via_vertex(req, generator_dir=generator_dir)

        plan_path = staged / "content" / "page_plan.json"
        plan_path.parent.mkdir(parents=True, exist_ok=True)
        plan_path.write_text(json.dumps(plan, indent=2), encoding="utf-8")

        # Install deps before validation (schema imports zod).
        _run(["npm", "ci"], cwd=staged)
        _validate_page_plan(staged)

        _run(["npm", "run", "build"], cwd=staged)

        deploy = _deploy_preview(
            staged=staged,
            firebase_project_id=firebase_project_id,
            channel_id=channel_id,
        )

        if not deploy.preview_url:
            raise RuntimeError("Deploy succeeded but preview URL could not be detected from Firebase output.")

        return {"previewUrl": deploy.preview_url, "channelId": channel_id}
