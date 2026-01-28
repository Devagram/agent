# ADK generator

This folder is the Node-side generator required by Phase 4.

- Implements page plan generation using `@google/adk`.
- Input is passed on stdin as JSON: `{ "intake": { ... } }`.
- Output must be **only** a valid `content/page_plan.json` object on stdout.

## Status

The wrapper script exists, but the ADK agent call is not implemented yet.
