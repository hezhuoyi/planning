# GitHub Pages Deployment Design

## Goal

Publish the existing Mainline Planner source repository to GitHub and serve the production PWA at `https://hezhuoyi.github.io/planning/`. Keep the current Vercel deployment working at the root path.

## Approach

Use GitHub Actions and GitHub Pages' official deployment actions. The `main` branch stores source code. Every push to `main` installs dependencies from `package-lock.json`, runs the existing verification commands, builds the app for the `/planning/` base path, and deploys `dist` to Pages.

## Path Handling

Vite and the PWA manifest must use a build-time base path:

- Local development and Vercel: `/`
- GitHub Pages: `/planning/`

The GitHub workflow supplies the Pages base path during the production build. Asset URLs, the manifest `start_url`, service worker scope, and navigation fallback must all resolve under the same base path.

## Deployment Workflow

The workflow will:

1. Check out `main`.
2. Set up the repository's Node.js version and npm cache.
3. Run `npm ci`.
4. Run tests and linting.
5. Build with the GitHub Pages base path.
6. Upload `dist` as the Pages artifact.
7. Deploy through the `github-pages` environment.

GitHub Pages will use GitHub Actions as its publishing source. Future pushes to `main` will redeploy automatically.

## Supabase Authentication

After Pages is live, Supabase Authentication URL Configuration must include:

- Redirect URL: `https://hezhuoyi.github.io/planning/**`

The Site URL may remain the Vercel URL because the application explicitly sends `window.location.origin` as the email redirect. The GitHub Pages URL must be in the allow list.

## Verification

Completion requires:

- Local tests, lint, and both root-path and Pages-path builds pass.
- Source is present in `https://github.com/hezhuoyi/planning`.
- The GitHub Actions Pages deployment succeeds.
- The Pages HTML, JavaScript bundle, manifest, and service worker return HTTP 200.
- The app renders at `https://hezhuoyi.github.io/planning/` on desktop and the user can retest it on iPhone Safari.

## Scope

This change only adds deployment configuration and path handling. It does not change task data, Supabase schema, or application behavior.
