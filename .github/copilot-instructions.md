You are an expert AI coding assistant working on **sitegen-skeleton**.

# What is sitegen-skeleton?

sitegen-skeleton is the **golden base repository** for every website the system produces. It is NOT a "template website." It is a **reusable rendering engine** plus a **section library** that turns a validated JSON "page plan" into a fast, professional static site.

It exists to make the system **repeatable, predictable, and cheap to operate** while allowing each client site to feel custom through controlled variation.

# Project Architecture

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Static runtime | Astro + TypeScript | Outputs `dist/` for Firebase Hosting |
| Design tokens | `src/styles/tokens.css` | CSS variables for colors, typography, spacing |
| Global styles | `src/styles/global.css` | Imports tokens, applies base styles |
| Layouts | `src/layouts/` | `BaseLayout.astro` wraps all pages |
| Pages | `src/pages/` | File-based routing (index, fit) |
| Sections | `src/sections/` | Reusable section components with variants |
| Page plan | `content/page_plan.json` | Single source of content truth |
| Schemas | `src/lib/` | Zod schemas for validation |

## Section Library

- 6–8 standard sections: Hero, Services, About, Testimonials, FAQ, CTA, Contact
- Each section has 2–3 variants
- Site uniqueness comes from: which sections appear, the order, variants chosen, and copy/content

## Page Plan Contract

Everything is driven by a single file: `content/page_plan.json`

This is the **only artifact** the planning agent generates. The site must be fully renderable from this file alone.

# Coding Standards

- Use modern ES6+ syntax
- Use strict TypeScript
- Prefer functional components
- Use proper semantic HTML
- **All pages must use `BaseLayout`**
- Keep CSS lightweight and token-driven
- Edit `tokens.css` for site-wide style changes, not individual components

# Non-Negotiable Requirements

1. **Deterministic builds**: `package-lock.json` checked in, `npm ci` works reliably
2. **Single source of truth**: Site renderable from `page_plan.json` alone
3. **Static output**: `npm run build` produces `dist/`, no server runtime
4. **Schema enforcement**: Invalid JSON must fail fast with clear errors
5. **No secrets**: No keys, tokens, or PII in repo
6. **Stable interfaces**: Section types/variants documented, schema changes versioned

# What sitegen-skeleton is NOT

- ❌ Not a bespoke website per client
- ❌ Not a CMS
- ❌ Not an ecommerce platform
- ❌ Not a catch-all for custom features

If a feature requires backend complexity, it should be a separate product. The skeleton's value is **constraint**.

# Workflow

- When creating new pages, use file-based routing in Astro
- All pages must import and use `BaseLayout`
- Section changes must update the corresponding zod schema
- Validate `page_plan.json` during build/render
- Check console output for errors
- Test with `npm run dev` (dev) and `npm run build` (prod)

# Key Routes

- `/` — Main site index
- `/fit` — Review route with banner (project name, timestamp, status) for client approval
