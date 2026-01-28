# sitegen-skeleton: Implementation TODO

> Staged checklist to complete all requirements for the rendering engine.

---

## Stage 1: Foundation (Deterministic Builds)

- [x] Generate `package-lock.json` by running `npm install`
- [x] Commit `package-lock.json` to repo
- [x] Ensure Node version is pinned for contributors (use `.nvmrc` + `package.json` engines)
  - Required Node: **>=20.19.0 <21**
- [x] Verify `npm ci && npm run build` works in Docker
- [x] Stage 1 verification: `npm ci` + `npm run build` (local) and Docker prod build are green

---

## Stage 2: Schema & Validation

- [x] Install `zod` dependency (`npm install zod`)
- [x] Create `src/lib/schema.ts` with Zod schemas for:
  - [x] `MetaSchema` (projectName, generatedAt, status)
  - [x] `SiteSchema` (title, description, favicon)
  - [x] `TokensSchema` (colorPrimary, colorAccent)
  - [x] `SectionSchema` (type, variant, props) with discriminated union
  - [x] `PagePlanSchema` (meta, site, tokens, sections)
- [x] Create `src/lib/loadPagePlan.ts` loader that:
  - [x] Reads `content/page_plan.json`
  - [x] Validates against schema
  - [x] Throws clear error on invalid JSON
  - [x] Returns typed page plan object
- [x] Add JSON schema file `content/page_plan.schema.json` for IDE autocompletion
- [x] Stage 2 verification: `npm run build` is green

---

## Stage 3: Section Library

Create section components in `src/sections/` with variants:

### Hero Section
- [x] `Hero.astro` — main component with variant switching
- [x] Variants: `centered`, `split`, `video-bg`
- [x] Props: headline, subheadline, ctaText, ctaLink, backgroundImage?

### Services Section
- [x] `Services.astro` — main component
- [x] Variants: `grid`, `list`, `cards`
- [x] Props: headline, items[] (title, description, icon)

### About Section
- [x] `About.astro` — main component
- [x] Variants: `split`, `centered`, `timeline`
- [x] Props: headline, content, image?

### Testimonials Section
- [x] `Testimonials.astro` — main component
- [x] Variants: `carousel`, `grid`, `single`
- [x] Props: headline, items[] (quote, author, role, avatar?)

### FAQ Section
- [x] `FAQ.astro` — main component
- [x] Variants: `accordion`, `two-column`, `simple`
- [x] Props: headline, items[] (question, answer)

### CTA Section
- [x] `CTA.astro` — main component
- [x] Variants: `banner`, `split`, `minimal`
- [x] Props: headline, subheadline?, ctaText, ctaLink

### Contact Section
- [x] `Contact.astro` — main component
- [x] Variants: `simple`, `split-map`, `form`
- [x] Props: headline, email?, phone?, address?, formAction?

### Section Renderer
- [x] Create `src/sections/SectionRenderer.astro` that:
  - [x] Takes a section object from page plan
  - [x] Dynamically renders correct component + variant
  - [x] Handles unknown section types gracefully (error UI)

- [x] Stage 3 verification: `npm run build` is green

---

## Stage 4: Page Plan Integration

- [x] Update `src/pages/index.astro` to:
  - [x] Import and use `loadPagePlan()`
  - [x] Pass site metadata to `BaseLayout`
  - [x] Loop through sections and render via `SectionRenderer`
  - [x] Apply token overrides from page plan

- [x] Update `src/layouts/BaseLayout.astro` to:
  - [x] Accept optional token overrides
  - [x] Inject token CSS variables dynamically
  - [x] Use site title/description from page plan

- [x] Stage 4 verification: `npm run build` is green

---

## Stage 5: Fit/Review Route

- [x] Create `src/components/ReviewBanner.astro` with:
  - [x] Project name display
  - [x] Generated timestamp
  - [x] Status badge (draft/review/approved)
  - [x] Sticky positioning at top
  - [x] Distinct styling (yellow/orange warning colors)

- [x] Update `src/pages/fit.astro` to:
  - [x] Import and use `loadPagePlan()`
  - [x] Render `ReviewBanner` with meta info
  - [x] Render full site below banner
  - [x] Add "Approve" / "Request Changes" placeholder buttons

- [x] Stage 5 verification: `npm run build` is green

---

## Stage 6: Error Handling

- [x] Create `src/components/ErrorDisplay.astro` for:
  - [x] Schema validation errors
  - [x] Missing page plan file
  - [x] Invalid section types

- [x] Update loader to return error object instead of throwing (for graceful UI)

- [x] Update pages to show `ErrorDisplay` when validation fails

- [x] Stage 6 verification: `npm run build` is green

---

## Stage 7: Documentation

- [x] Create `docs/PAGE_PLAN_CONTRACT.md` documenting:
  - [x] Full JSON structure
  - [x] All section types and variants
  - [x] Required vs optional props
  - [x] Example valid page plans

- [x] Create `docs/SECTION_LIBRARY.md` with:
  - [x] Visual examples of each section variant
  - [x] Props reference table
  - [x] Guidelines for adding new sections

- [x] Update `README.md` with links to contract docs

- [x] Stage 7 verification: `npm run build` is green

---

## Stage 8: Testing & Validation

- [x] Verify Docker dev build works (`docker compose up --build`)
- [x] Verify Docker prod build works (`docker compose -f docker-compose.prod.yml up --build`)

- [x] Validate page plan (automated):
  - [x] Valid plan passes: `npm run validate:plan`
  - [x] Invalid plan fails clearly: `npm run validate:plan:invalid`
  - [x] Missing plan fails clearly: `npm run validate:plan:missing`

- [x] Manual smoke checks:
  - [x] `/fit` route shows review banner (dev or prod)
  - [x] Token overrides from page plan apply (primary/accent)

- [x] Stage 8 verification: `npm run build` is green

---

## Stage 9: Cleanup

- [x] Remove `.cursorrules` (migrated to `.github/copilot-instructions.md`)
- [x] Remove `requirements.txt` (deprecated) (if present)
- [x] Delete `.gitkeep` files from populated directories
- [ ] Final `npm audit fix` if needed (deferred: remaining vulns require a semver-major bump of `@astrojs/check`)
- [ ] Commit all changes with clear message

- [x] Stage 9 verification: `npm run build` is green
