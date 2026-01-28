# Page Plan Contract (sitegen-skeleton)

`content/page_plan.json` is the **single source of truth** for what the site renders.

- It is the **only artifact** the planning agent should generate.
- The site must be fully renderable from this file alone.
- The file is validated against:
  - Zod runtime schemas in `src/lib/schema.ts` (authoritative)
  - `content/page_plan.schema.json` (editor autocomplete)

If validation fails, the site must **fail fast** (CI/build) or render an explicit error UI (dev/review).

---

## File location

```
content/page_plan.json
```

Recommended header:

```json
{
  "$schema": "./page_plan.schema.json",
  "meta": { "projectName": "...", "generatedAt": "...", "status": "draft" },
  "site": { "title": "...", "description": "...", "favicon": "/favicon.svg" },
  "tokens": { "colorPrimary": "#...", "colorAccent": "#..." },
  "sections": []
}
```

---

## Root schema

### Root fields

| Field | Type | Required | Notes |
|------|------|----------|------|
| `$schema` | string | optional | Points to `./page_plan.schema.json` for editor tooling |
| `meta` | object | required | Build/review metadata |
| `site` | object | required | SEO + basic site identity |
| `tokens` | object | required | Brand overrides applied as CSS variables |
| `sections` | array | required | Ordered section list to render |

`additionalProperties` is **not allowed** at the root.

---

## `meta`

| Field | Type | Required | Allowed values |
|------|------|----------|----------------|
| `projectName` | string | required | non-empty |
| `generatedAt` | string | required | ISO datetime string |
| `status` | string | required | `draft` \| `review` \| `approved` |

---

## `site`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `title` | string | required | Used in `<title>` and og/seo contexts |
| `description` | string | required | Used in meta description |
| `favicon` | string | optional | Path under `/public` (defaults to `/favicon.svg`) |

---

## `tokens`

Token overrides are injected as CSS variables in `BaseLayout`.

| Field | Type | Required | Maps to |
|------|------|----------|---------|
| `colorPrimary` | string | required | `--color-primary` |
| `colorAccent` | string | required | `--color-accent` |

Notes:
- Values should be valid CSS color strings (hex recommended).
- Prefer brand changes via tokens rather than ad-hoc CSS tweaks.

---

## `sections[]`

Each section item has the same outer shape:

```json
{
  "type": "hero",
  "variant": "centered",
  "props": { }
}
```

Rules:
- `sections` are rendered **in order**.
- Section `type` and `variant` must be valid.
- `props` must match the section contract.
- Extra keys are rejected (strict validation).

### Supported section types

- `hero`
- `services`
- `about`
- `testimonials`
- `faq`
- `cta`
- `contact`

For full type/variant/props details, see `docs/SECTION_LIBRARY.md`.

---

## Example (valid)

See `content/page_plan.json` for a complete working example.
