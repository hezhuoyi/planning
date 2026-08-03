# Planning Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved `Ink / Cobalt` family-life visual direction, unify user-facing naming as `Planning`, and verify the existing root deployment plus the GitHub Pages build path.

**Architecture:** Keep the current React/Gantt/task-store boundaries. Centralize the new palette in `src/App.css` and `src/index.css`, update only user-facing copy and export metadata in the existing components, and make Vite/PWA paths build-time configurable for `/planning/`.

**Tech Stack:** React 19, TypeScript, Vite 8, vite-plugin-pwa, Vitest, oxlint, GitHub Actions Pages.

## Global Constraints

- The first screen remains the cross-month Gantt overview; do not replace it with a task list or statistics dashboard.
- Product name, document title, PWA name, PWA short name, and export filename use `Planning`; user-facing copy must not contain `主线`.
- The visual direction is cold white, ink text, cobalt blue structure/accent, and softer low-saturation life-category colors; no large gradients or decorative blobs.
- Existing task fields, seeded tasks, Supabase schema, auth flow, and local-cache migration keys remain compatible.
- Desktop and iPhone Safari layouts must keep the Gantt overview usable through horizontal scrolling with stable lane labels.
- Root builds use `/`; GitHub Pages builds use `/planning/` through `VITE_BASE_PATH`.

---

### Task 1: Naming and page metadata

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: existing app actions, PWA manifest, and test selectors.
- Produces: `Planning` labels and `planning-YYYY-MM-DD.json` exports without changing task behavior.

- [ ] **Step 1: Update user-facing labels and export filename**

In `src/App.tsx`, change the brand heading to `Planning`, change the Gantt section label to a concise life-planning label, and change the download name to ``planning-${format(new Date(), 'yyyy-MM-dd')}.json``. Keep internal sync/storage identifiers unchanged for migration compatibility.

- [ ] **Step 2: Update page and PWA metadata**

In `index.html`, use `Planning` for `<title>`, set the description to a concise family-life timeline description, and set the theme color to the cobalt palette. In `vite.config.ts`, update the manifest `name`, `short_name`, `description`, `background_color`, and `theme_color` while preserving the existing icon entries and path fields.

- [ ] **Step 3: Update the README heading and usage copy**

Rename the README title to `Planning` and describe it as a family-life timeline. Keep the Supabase setup commands and local/offline behavior unchanged.

- [ ] **Step 4: Update the heading assertion before implementation**

Change the first `App.test.tsx` assertion to `screen.getByRole('heading', { name: 'Planning' })` and keep the seeded task assertions intact.

- [ ] **Step 5: Run the focused tests**

Run `npm test -- src/App.test.tsx`. Expected: PASS after the copy changes; no task-store or timeline behavior changes.

- [ ] **Step 6: Commit naming changes**

Run:

```bash
git add src/App.tsx src/App.test.tsx index.html README.md vite.config.ts
git commit -m "refactor: unify Planning product naming"
```

### Task 2: Family-life visual system and responsive Gantt styling

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`
- Modify: `src/components/GanttBoard.tsx`

**Interfaces:**
- Consumes: existing class names and `TaskStatus` rendering from `GanttBoard`.
- Produces: the approved cold-white family-life palette, stable desktop/mobile Gantt geometry, and accessible section naming.

- [ ] **Step 1: Replace global palette tokens**

Set root tokens in `src/index.css` and `src/App.css` to cold white/blue-gray surfaces, ink text, cobalt primary, mint ongoing, sky-blue growth, soft amber home, and restrained red overdue colors. Keep `letter-spacing: 0`, regular/medium font weights, and no gradients.

- [ ] **Step 2: Restyle application chrome**

Update `.app-shell`, `.topbar`, `.workspace-bar`, buttons, zoom switch, sync states, and footer legend to use the new tokens. Keep controls compact, use Lucide icons already present, and limit border radii to 8px. Remove the heavy dark-green brand treatment in favor of a light, friendly cobalt mark.

- [ ] **Step 3: Restyle the Gantt surface and task bars**

Update timeline headers, guide lines, today line, lane hover states, task bars, milestones, ongoing edge, and status legend. Preserve the existing position calculations and drag behavior. Use softer category colors, ensure completed and overdue states remain visually distinct, and keep labels readable over each task bar.

- [ ] **Step 4: Preserve the overview on mobile**

Adjust the existing `max-width: 720px` rules so the toolbar wraps cleanly, the Gantt can scroll horizontally, lane heights remain stable, and text never overlaps controls. Do not shrink fonts with viewport width.

- [ ] **Step 5: Update the Gantt accessible label**

Change the `GanttBoard` section `aria-label` to a `Planning`-appropriate family-life timeline label without using `主线`.

- [ ] **Step 6: Run tests, lint, and a production build**

Run `npm test`, `npm run lint`, and `npm run build`. Expected: all existing tests pass, lint exits 0, and Vite emits a root-path production build.

- [ ] **Step 7: Commit the visual refresh**

Run:

```bash
git add src/index.css src/App.css src/components/GanttBoard.tsx
git commit -m "style: refresh Planning for family life"
```

### Task 3: GitHub Pages base path and deployment verification

**Files:**
- Create: `scripts/verify-pages-build.mjs`
- Create: `.github/workflows/pages.yml`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: the existing app build and the optional `VITE_BASE_PATH` environment variable.
- Produces: a verified `/planning/` Pages artifact and automatic deployment on pushes to `main`.

- [ ] **Step 1: Add the Pages artifact verifier**

Create `scripts/verify-pages-build.mjs` that reads `dist/index.html`, `dist/manifest.webmanifest`, `dist/registerSW.js`, and `dist/sw.js`; assert asset URLs, manifest `start_url`/`scope`, registration path, and navigation fallback all contain `/planning/`. Add `"verify:pages": "node scripts/verify-pages-build.mjs"` to `package.json`.

- [ ] **Step 2: Make the Vite/PWA base configurable**

Compute a normalized base from `process.env.VITE_BASE_PATH ?? '/'` in `vite.config.ts`. Reuse it for Vite `base`, manifest `start_url`, manifest `scope`, and Workbox `navigateFallback`; preserve all other manifest values.

- [ ] **Step 3: Add the GitHub Actions workflow**

Create `.github/workflows/pages.yml` for pushes to `main` and manual dispatch. Use Node setup with npm cache, `npm ci --no-audit --no-fund`, tests, lint, `VITE_BASE_PATH=/planning/ npm run build`, `npm run verify:pages`, then the official Pages artifact upload/deploy actions with `contents: read`, `pages: write`, and `id-token: write` permissions.

- [ ] **Step 4: Verify both deployment targets locally**

Run `npm run build` and confirm root asset URLs. Then run `VITE_BASE_PATH=/planning/ npm run build && npm run verify:pages`. Expected: both builds pass and the verifier prints `GitHub Pages artifact paths verified.`

- [ ] **Step 5: Commit Pages deployment changes**

Run:

```bash
git add scripts/verify-pages-build.mjs .github/workflows/pages.yml vite.config.ts package.json README.md
git commit -m "build: deploy Planning to GitHub Pages"
```

### Task 4: Publish and smoke-test the hosted app

**Files:**
- No source changes unless a verification failure requires a targeted fix.

**Interfaces:**
- Consumes: `main` branch and `.github/workflows/pages.yml`.
- Produces: a reachable `https://hezhuoyi.github.io/planning/` app with static resources returning HTTP 200.

- [ ] **Step 1: Add the GitHub remote and push**

Run `git remote add origin https://github.com/hezhuoyi/planning.git` if no `origin` exists, then `git push -u origin main`.

- [ ] **Step 2: Configure Pages source**

In the repository settings, set Pages source to GitHub Actions, then wait for the Pages workflow to finish successfully.

- [ ] **Step 3: Verify hosted resources**

Check `https://hezhuoyi.github.io/planning/`, its manifest URL, and its service-worker URL with HTTP requests. Confirm the returned HTML references `/planning/assets/` and the app loads without a blank page.

- [ ] **Step 4: Update Supabase redirect allowlist**

Add `https://hezhuoyi.github.io/planning/**` in Supabase Authentication URL Configuration while retaining the existing local and Vercel entries.

- [ ] **Step 5: Run the final regression suite**

Run `npm test`, `npm run lint`, `npm run build`, and the Pages verifier once more after the final commit. Report any iPhone Safari retest limitation explicitly.
