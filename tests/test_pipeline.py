from __future__ import annotations

import pathlib

import pytest

from sitegen_agent.pipeline import generate_and_deploy_preview


def test_pipeline_fails_fast_on_schema_validation_with_bad_plan():
    npm = __import__("shutil").which("npm")
    if not npm:
        pytest.skip("npm not available on PATH (this test exercises skeleton validation via npm)")

    repo_root = pathlib.Path(__file__).resolve().parents[2]

    req = {
        "firebaseProjectId": "demo",
        "projectName": "Demo",
        "skeletonPath": str(repo_root),
        "pagePlanJson": {"meta": {}},
    }

    with pytest.raises(
        RuntimeError,
        match="failed schema validation|SCHEMA_VALIDATION|page_plan.json",
    ):
        generate_and_deploy_preview(req)
