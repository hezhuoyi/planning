# GitHub Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Mainline Planner from the `main` branch to `https://hezhuoyi.github.io/planning/` with automatic GitHub Actions deployments while preserving the root-path Vercel build.

**Architecture:** Vite receives an optional `VITE_BASE_PATH` at build time. GitHub Actions sets it to `/planning/`, verifies the generated artifact paths, and deploys `dist` through GitHub Pages' official actions; local and Vercel builds default to `/`.

**Tech Stack:** React 19, Vite 8, vite-plugin-pwa, Vitest, oxlint, GitHub Actions, GitHub Pages

## Global Constraints

- Local development and Vercel must continue using `/`.
- GitHub Pages must use `/planning/` for assets, manifest URLs, service worker scope, and navigation fallback.
- No new runtime dependency is required.
- The Supabase schema and task behavior must remain unchanged.

---

### Task 1: Build-Time Base Path and Artifact Verification

**Files:**
- Create: `scripts/verify-pages-build.mjs`
- Modify: `vite.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `VITE_BASE_PATH`, defaulting to `/`.
- Produces: a Vite/PWA build rooted at the selected base path and `npm run verify:pages` for artifact validation.

- [ ] **Step 1: Add the failing Pages artifact verifier**

Create `scripts/verify-pages-build.mjs`:

```js
import { readFile } from 'node:fs/promises'

const expectedBase = '/planning/'
const [html, manifestText, registerSw, serviceWorker] = await Promise.all([
  readFile('dist/index.html', 'utf8'),
  readFile('dist/manifest.webmanifest', 'utf8'),
  readFile('dist/registerSW.js', 'utf8'),
  readFile('dist/sw.js', 'utf8'),
])
const manifest = JSON.parse(manifestText)

const checks = [
  [html.includes(`${expectedBase}assets/`), 'index.html asset URLs'],
  [html.includes(`${expectedBase}manifest.webmanifest`), 'manifest URL'],
  [manifest.start_url === expectedBase, 'manifest start_url'],
  [manifest.scope === expectedBase, 'manifest scope'],
  [registerSw.includes(`${expectedBase}sw.js`), 'service worker registration'],
  [serviceWorker.includes(`${expectedBase}index.html`), 'navigation fallback'],
]

const failed = checks.filter(([passed]) => !passed).map(([, label]) => label)
if (failed.length) throw new Error(`Invalid GitHub Pages build: ${failed.join(', ')}`)
console.log('GitHub Pages artifact paths verified.')
```

Add to `package.json`:

```json
"verify:pages": "node scripts/verify-pages-build.mjs"
```

- [ ] **Step 2: Confirm the current root build fails Pages verification**

Run:

```bash
npm run build
npm run verify:pages
```

Expected: the build succeeds and `verify:pages` fails with `Invalid GitHub Pages build` because paths still start at `/`.

- [ ] **Step 3: Make the Vite and PWA base path configurable**

Update `vite.config.ts` to compute and reuse one base value:

```ts
const requestedBase = process.env.VITE_BASE_PATH ?? '/'
const base = `/${requestedBase.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        // Preserve existing manifest values.
        start_url: base,
        scope: base,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
})
```

Keep every existing manifest field and icon entry; only replace the fixed `start_url`, `scope`, and `navigateFallback`, then add the top-level `base`.

- [ ] **Step 4: Verify both deployment targets**

Run root-path verification:

```bash
npm run build
rg 'src="/assets/|href="/manifest.webmanifest' dist/index.html
```

Expected: root-path asset and manifest references are present.

Run Pages-path verification:

```bash
VITE_BASE_PATH=/planning/ npm run build
npm run verify:pages
```

Expected: `GitHub Pages artifact paths verified.`

- [ ] **Step 5: Run regression checks**

Run:

```bash
npm test
npm run lint
```

Expected: all tests pass and oxlint exits with code 0.

- [ ] **Step 6: Commit the base-path change**

```bash
git add vite.config.ts package.json scripts/verify-pages-build.mjs
git commit -m "build: support GitHub Pages base path"
```

### Task 2: GitHub Actions Pages Workflow

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: the `VITE_BASE_PATH` build interface and `npm run verify:pages` from Task 1.
- Produces: an automatic Pages deployment for every push to `main`.

- [ ] **Step 1: Add the Pages workflow**

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - uses: actions/configure-pages@v5
      - run: npm ci --no-audit --no-fund
      - run: npm test
      - run: npm run lint
      - run: npm run build
        env:
          VITE_BASE_PATH: /planning/
      - run: npm run verify:pages
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Document the source and published URLs**

Add to `README.md`:

```markdown
## 在线地址

- GitHub Pages: https://hezhuoyi.github.io/planning/
- Vercel: https://mainline-planner.vercel.app/

推送到 `main` 后，`.github/workflows/pages.yml` 会自动验证并发布 GitHub Pages。
```

- [ ] **Step 3: Validate workflow syntax and full local verification**

Run:

```bash
npm test
npm run lint
VITE_BASE_PATH=/planning/ npm run build
npm run verify:pages
```

Expected: 31 tests pass, lint exits 0, build exits 0, and Pages verification succeeds.

- [ ] **Step 4: Commit the workflow**

```bash
git add .github/workflows/pages.yml README.md
git commit -m "ci: deploy app to GitHub Pages"
```

### Task 3: Publish Source and Enable Pages

**Files:**
- No application files changed.
- Git remote: `https://github.com/hezhuoyi/planning.git`

**Interfaces:**
- Consumes: committed source and workflow from Tasks 1-2.
- Produces: `main` on GitHub and an active Pages deployment.

- [ ] **Step 1: Add the remaining project source to Git**

Run:

```bash
git add .
git status --short
```

Confirm `.env.local`, `node_modules`, `dist`, and `.vercel` are absent from the staged files.

- [ ] **Step 2: Commit the application source**

```bash
git commit -m "feat: add Mainline Planner application"
```

- [ ] **Step 3: Configure the GitHub remote**

```bash
git remote add origin https://github.com/hezhuoyi/planning.git
git remote -v
```

Expected: fetch and push URLs both point to `hezhuoyi/planning.git`.

- [ ] **Step 4: Authenticate GitHub CLI if required**

Run `gh auth status`. If unauthenticated, run:

```bash
gh auth login --hostname github.com --git-protocol https --web
```

Complete the browser authorization without sharing passwords or tokens.

- [ ] **Step 5: Set GitHub Pages source to GitHub Actions**

Open `https://github.com/hezhuoyi/planning/settings/pages` and select **GitHub Actions** under **Build and deployment → Source** if it is not already selected.

- [ ] **Step 6: Push `main`**

```bash
git push -u origin main
```

Expected: the source and workflow appear in `https://github.com/hezhuoyi/planning` and the Pages workflow starts.

### Task 4: Verify Pages and Supabase Redirect

**Files:**
- No local files changed.

**Interfaces:**
- Consumes: the Pages deployment URL from Task 3.
- Produces: a verified public PWA and an allowed Supabase authentication redirect.

- [ ] **Step 1: Wait for the Pages workflow**

Use GitHub Actions or `gh run watch` until the latest `Deploy GitHub Pages` run completes.

Expected: build and deploy jobs both succeed.

- [ ] **Step 2: Verify published resources**

Run:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://hezhuoyi.github.io/planning/
curl -sS -o /dev/null -w '%{http_code}\n' https://hezhuoyi.github.io/planning/manifest.webmanifest
curl -sS -o /dev/null -w '%{http_code}\n' https://hezhuoyi.github.io/planning/sw.js
```

Expected: all three commands print `200`.

- [ ] **Step 3: Verify the rendered app**

Open `https://hezhuoyi.github.io/planning/` and confirm the Gantt board renders, the initial 11 tasks are visible, and browser console logs contain no errors.

- [ ] **Step 4: Add the Supabase redirect URL**

In Supabase Authentication URL Configuration, add:

```text
https://hezhuoyi.github.io/planning/**
```

Keep `https://mainline-planner.vercel.app/**` so both deployments can authenticate.

- [ ] **Step 5: Retest on iPhone Safari**

Open `https://hezhuoyi.github.io/planning/` on the user's iPhone 14 Pro Max with iOS 18.7.8. Confirm the board renders without the previous `vercel.app` resource timeout, then use Safari Share → **Add to Home Screen**.
