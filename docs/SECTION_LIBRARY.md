# Section Library (sitegen-skeleton)

This repo ships with a constrained section library. Sites feel custom by:
- selecting an ordered list of sections
- selecting a variant per section
- providing copy/content via `props`

The authoritative contract is enforced by Zod in `src/lib/schema.ts`.

---

## Common section shape

```json
{
  "type": "hero",
  "variant": "centered",
  "props": {}
}
```

- `type` chooses the section component.
- `variant` chooses a layout styling within that component.
- `props` are section-specific data.

---

## Hero (`type: "hero"`)

**Variants**: `centered` | `split` | `video-bg`

**Props**
| Prop | Type | Required |
|------|------|----------|
| `headline` | string | yes |
| `subheadline` | string | no |
| `ctaText` | string | no (recommended with `ctaLink`) |
| `ctaLink` | string | no (recommended with `ctaText`) |
| `backgroundImage` | string | no (used by `split`) |

Notes:
- `video-bg` currently renders a placeholder (static-only). Use it for layout review.

---

## Services (`type: "services"`)

**Variants**: `grid` | `list` | `cards`

**Props**
| Prop | Type | Required |
|------|------|----------|
| `headline` | string | yes |
| `items` | array | yes (min 1) |

**items[]**
| Prop | Type | Required |
|------|------|----------|
| `title` | string | yes |
| `description` | string | yes |
| `icon` | string | no |

---

## About (`type: "about"`)

**Variants**: `split` | `centered` | `timeline`

**Props**
| Prop | Type | Required |
|------|------|----------|
| `headline` | string | yes |
| `content` | string | yes |
| `image` | string | no |

Notes:
- `timeline` currently uses the same layout as `split` (safe default).

---

## Testimonials (`type: "testimonials"`)

**Variants**: `carousel` | `grid` | `single`

**Props**
| Prop | Type | Required |
|------|------|----------|
| `headline` | string | no |
| `items` | array | yes (min 1) |

**items[]**
| Prop | Type | Required |
|------|------|----------|
| `quote` | string | yes |
| `author` | string | yes |
| `role` | string | no |
| `avatar` | string | no |

Notes:
- `carousel` is currently a static grid layout (no JS runtime). Keep it static.

---

## FAQ (`type: "faq"`)

**Variants**: `accordion` | `two-column` | `simple`

**Props**
| Prop | Type | Required |
|------|------|----------|
| `headline` | string | no |
| `items` | array | yes (min 1) |

**items[]**
| Prop | Type | Required |
|------|------|----------|
| `question` | string | yes |
| `answer` | string | yes |

---

## CTA (`type: "cta"`)

**Variants**: `banner` | `split` | `minimal`

**Props**
| Prop | Type | Required |
|------|------|----------|
| `headline` | string | yes |
| `subheadline` | string | no |
| `ctaText` | string | yes |
| `ctaLink` | string | yes |

---

## Contact (`type: "contact"`)

**Variants**: `simple` | `split-map` | `form`

**Props**
| Prop | Type | Required |
|------|------|----------|
| `headline` | string | yes |
| `email` | string | no |
| `phone` | string | no |
| `address` | string | no |
| `formAction` | string | no (used by `form`) |

Notes:
- The `form` variant is a static placeholder. If you need submissions, wire `formAction` to a backend.

---

## Adding a new section

1. Create `src/sections/<SectionName>.astro`.
2. Add Zod validation in `src/lib/schema.ts`:
   - add a schema for it
   - add it to the `SectionSchema` discriminated union
3. Update `content/page_plan.schema.json` to keep editor autocomplete in sync.
4. Update `docs/SECTION_LIBRARY.md` with type/variants/props.
