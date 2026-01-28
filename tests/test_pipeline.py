from __future__ import annotations

import pathlib

import pytest

from sitegen_agent.pipeline import generate_and_deploy_preview


def test_pipeline_fails_fast_on_schema_validation_with_bad_plan():
    npm = __import__("shutil").which("npm")
    if not npm:
        pytest.skip("npm not available on PATH (this test exercises skeleton validation via npm)")

    # This test needs a real skeleton checkout (package.json + package-lock.json).
    # In this workspace, the skeleton lives as a sibling folder to the agent repo.
    agent_root = pathlib.Path(__file__).resolve().parents[1]
    skeleton_root = agent_root.parent / "skeleton"
    if not (skeleton_root / "package.json").exists():
        pytest.skip(f"skeleton repo not found at expected path: {skeleton_root}")

    req = {
        "firebaseProjectId": "demo",
        "projectName": "Demo",
        "skeletonPath": str(skeleton_root),
        "pagePlanJson": {"meta": {}},
    }

    with pytest.raises(
        RuntimeError,
        match="failed schema validation|SCHEMA_VALIDATION|page_plan.json",
    ):
        generate_and_deploy_preview(req)
