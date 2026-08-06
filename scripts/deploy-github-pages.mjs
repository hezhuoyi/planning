#!/usr/bin/env node
/**
 * Robust GitHub Pages deployer.
 *
 * Why not actions/deploy-pages alone:
 * - Its poll timeout is hard-capped at ~10 minutes.
 * - On timeout it CANCELS the Pages deployment, which can kill a publish
 *   that would have succeeded shortly after (we saw ~8m successes vs 10m cancels).
 *
 * This script creates the same Pages deployment, polls longer, and never cancels
 * on timeout so a late backend finish can still go live.
 */
import { writeFileSync } from 'node:fs'

const owner = process.env.GITHUB_REPOSITORY_OWNER
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const runId = process.env.GITHUB_RUN_ID
const sha = process.env.GITHUB_SHA
const token = process.env.GITHUB_TOKEN
const artifactName = process.env.PAGES_ARTIFACT_NAME || 'github-pages'
const maxWaitMs = Number(process.env.PAGES_DEPLOY_TIMEOUT_MS || 25 * 60 * 1000)
const intervalMs = Number(process.env.PAGES_DEPLOY_POLL_MS || 10_000)

if (!owner || !repo || !runId || !sha || !token) {
  throw new Error('Missing GITHUB_REPOSITORY_OWNER / GITHUB_REPOSITORY / GITHUB_RUN_ID / GITHUB_SHA / GITHUB_TOKEN')
}

const api = async (method, path, body) => {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    const message = data?.message || text || response.statusText
    const error = new Error(`${method} ${path} -> ${response.status}: ${message}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function ensureActionsPagesSource() {
  try {
    await api('PUT', `/repos/${owner}/${repo}/pages`, {
      build_type: 'workflow',
    })
    console.log('Pages source ensured: GitHub Actions (workflow).')
  } catch (error) {
    // GITHUB_TOKEN often cannot change site settings; deploy can still work.
    console.warn(`Could not ensure Pages build_type=workflow (${error.message}). Continuing.`)
  }
}

async function cancelStaleDeployments() {
  const deployments = await api(
    'GET',
    `/repos/${owner}/${repo}/deployments?environment=github-pages&per_page=15`,
  )
  for (const deployment of deployments) {
    if (deployment.sha === sha) continue
    try {
      const status = await api('GET', `/repos/${owner}/${repo}/pages/deployments/${deployment.sha}`)
      const state = status?.status
      if (
        state === 'deployment_queued' ||
        state === 'syncing_files' ||
        state === 'in_progress' ||
        state === 'waiting'
      ) {
        console.log(`Canceling stale Pages deployment ${deployment.sha.slice(0, 7)} (${state})`)
        await api('POST', `/repos/${owner}/${repo}/pages/deployments/${deployment.sha}/cancel`)
      }
    } catch (error) {
      if (error.status !== 404) {
        console.warn(`Skip cancel for ${deployment.sha.slice(0, 7)}: ${error.message}`)
      }
    }
  }
}

async function getOidcToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (!requestUrl || !requestToken) {
    throw new Error('Missing ACTIONS_ID_TOKEN_REQUEST_URL / ACTIONS_ID_TOKEN_REQUEST_TOKEN')
  }
  const url = new URL(requestUrl)
  url.searchParams.set('audience', 'github')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${requestToken}` },
  })
  const data = await response.json()
  if (!response.ok || !data.value) {
    throw new Error(`Failed to fetch OIDC token: ${data.message || response.status}`)
  }
  return data.value
}

async function getArtifactId() {
  const data = await api('GET', `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts?per_page=100`)
  const matches = (data.artifacts || []).filter((artifact) => artifact.name === artifactName && !artifact.expired)
  if (matches.length === 0) {
    throw new Error(`No artifact named "${artifactName}" found for run ${runId}`)
  }
  // Prefer newest
  matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  console.log(`Using artifact ${matches[0].id} (${matches[0].name}, ${matches[0].size_in_bytes} bytes)`)
  return matches[0].id
}

async function createDeployment(artifactId, idToken) {
  const payload = {
    artifact_id: artifactId,
    pages_build_version: sha,
    oidc_token: idToken,
  }
  console.log('Creating Pages deployment...')
  return api('POST', `/repos/${owner}/${repo}/pages/deployments`, payload)
}

async function waitForDeployment(deploymentId) {
  const started = Date.now()
  let lastStatus = ''
  const successStates = new Set(['succeed', 'success', 'deployed'])
  const failureStates = new Set([
    'failed',
    'failure',
    'deployment_failed',
    'error',
    'deployment_cancelled',
    'cancelled',
  ])

  while (Date.now() - started < maxWaitMs) {
    const status = await api('GET', `/repos/${owner}/${repo}/pages/deployments/${deploymentId}`)
    const state = status.status || 'unknown'
    if (state !== lastStatus) {
      console.log(`Pages status: ${state}`)
      lastStatus = state
    }
    if (successStates.has(state)) return status
    if (failureStates.has(state)) {
      throw new Error(`Pages deployment failed with status=${state}`)
    }
    await sleep(intervalMs)
  }
  // Do NOT cancel — a late finish can still publish.
  throw new Error(
    `Timed out after ${Math.round(maxWaitMs / 60000)}m waiting for Pages deployment ${deploymentId}. Left running (not canceled).`,
  )
}

function writeOutput(pageUrl) {
  const outputFile = process.env.GITHUB_OUTPUT
  if (!outputFile || !pageUrl) return
  writeFileSync(outputFile, `page_url=${pageUrl}\n`, { flag: 'a' })
}

const staleOnly = process.argv.includes('--cancel-stale-only')

if (staleOnly) {
  await cancelStaleDeployments()
  console.log('Stale deployment cleanup done.')
  process.exit(0)
}

await ensureActionsPagesSource()
await cancelStaleDeployments()
const [artifactId, idToken] = await Promise.all([getArtifactId(), getOidcToken()])

let deployment
try {
  deployment = await createDeployment(artifactId, idToken)
} catch (error) {
  // One retry after cleanup / short wait for flaky queue.
  console.warn(`Create failed once (${error.message}); retrying after cleanup...`)
  await cancelStaleDeployments()
  await sleep(20_000)
  deployment = await createDeployment(artifactId, idToken)
}

// Pages status/cancel APIs expect the build version (commit SHA).
const deploymentId = deployment.page_url ? sha : deployment.id || sha
console.log(`Created deployment; polling id=${deploymentId}`, deployment)
const finalStatus = await waitForDeployment(sha)
const pageUrl = finalStatus.page_url || `https://${owner}.github.io/${repo}/`
console.log(`Deployed: ${pageUrl}`)
writeOutput(pageUrl)
