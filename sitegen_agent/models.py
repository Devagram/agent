from __future__ import annotations

from typing import Any, NotRequired, TypedDict


class GeneratePreviewRequest(TypedDict):
    firebaseProjectId: str
    projectName: str

    channelId: NotRequired[str]

    industry: NotRequired[str]
    location: NotRequired[str]
    services: NotRequired[list[str]]
    brandNotes: NotRequired[str]
    cta: NotRequired[str]

    # Escape hatch for local smoke tests (skips Vertex generation)
    pagePlanJson: NotRequired[Any]

    # Absolute path inside container to mounted repo root
    skeletonPath: NotRequired[str]


class GeneratePreviewResponse(TypedDict):
    previewUrl: str
    channelId: str
