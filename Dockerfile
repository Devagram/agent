# syntax=docker/dockerfile:1

FROM python:3.11-slim

WORKDIR /app

# System deps: node + npm for building Astro projects, git, and firebase-tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates git \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && npm install -g firebase-tools@13.12.0 \
  && npm cache clean --force \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# When building with the repo root as the Docker build context (Cloud Build),
# the source lives under ./sitegen-agent/.
COPY pyproject.toml ./

RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir .

# Install ADK generator deps
COPY adk/package.json adk/package-lock.json* ./adk/
RUN cd adk && npm install

COPY . ./

# NOTE: When deploying to Cloud Run with `gcloud run deploy --source .\sitegen-agent`,
# the Docker build context is the sitegen-agent folder only, so the skeleton repo
# (content/src/etc.) is NOT available to COPY here.
# The pipeline will instead use the request's `skeletonPath` (or a mounted /workspace in local dev).

ENV PORT=8080
EXPOSE 8080

# Cloud Run-friendly: bind to $PORT on 0.0.0.0
CMD ["python", "-m", "uvicorn", "sitegen_agent.server:app", "--host", "0.0.0.0", "--port", "8080"]
