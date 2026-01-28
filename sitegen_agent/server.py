from __future__ import annotations

import os
import traceback

from fastapi import FastAPI, HTTPException, Request

from sitegen_agent.pipeline import generate_and_deploy_preview

app = FastAPI(title="sitegen-agent", version="0.1.0")


@app.get("/_health")
def _health():
    # Cloud Run sometimes uses /healthz for platform health probes and may intercept it.
    # Provide an alternate endpoint for human/system smoke tests.
    return {"ok": True}


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/generate_preview")
async def generate_preview(request: Request):
    try:
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            raw = await request.body()
            snippet = raw[:500].decode("utf-8", errors="replace")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid JSON body. First 500 bytes: {snippet}",
            )

        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Body must be a JSON object")

        project_name = body.get("projectName")
        if not isinstance(project_name, str) or not project_name:
            raise HTTPException(status_code=400, detail="projectName is required")

        result = generate_and_deploy_preview(body)  # type: ignore[arg-type]
        return result

    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # Ensure the error is visible in docker logs and returned as JSON.
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/whoami")
def whoami():
    try:
        from google.auth import default  # type: ignore
        from google.auth.transport.requests import Request as GoogleRequest  # type: ignore

        creds, project = default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(GoogleRequest())

        email = getattr(creds, "service_account_email", None)
        # Some credential types expose this instead.
        if not email:
            email = getattr(creds, "_service_account_email", None)

        return {
            "project": project,
            "serviceAccountEmail": email,
            "credentialType": creds.__class__.__name__,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e


def main():
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
