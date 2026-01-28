# JSON Schema editor warnings (FYI)

Some IDE JSON tooling may show type warnings in `content/page_plan.schema.json` even when the schema is valid JSON Schema.

Why this happens:
- JetBrains/IDE schema support varies and sometimes validates JSON Schema files against an internal, older meta-schema or a different draft.
- Keywords like `const` (Draft-06+) and some nested schema shapes can be flagged incorrectly.

What matters for this repo:
- Runtime validation is enforced by Zod in `src/lib/schema.ts`.
- `npm run validate:plan` is the authoritative check.

If the warnings are distracting:
- You can disable validation for `content/page_plan.schema.json` in your IDE settings, or
- Switch your IDE's JSON Schema dialect to Draft 2020-12.
