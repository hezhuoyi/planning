#!/usr/bin/env node
/**
 * GitHub Pages deploy that mirrors actions/deploy-pages, with two differences:
 * 1) polls longer than the 10-minute hard cap
 * 2) never cancels on timeout (canceling aborts a publish that may still finish)
 */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const owner = process.env.GITHUB_REPOSITORY_OWNER
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const sha = process.env.GITHUB_SHA
const token = process.env.GITHUB_TOKEN
const artifactName = process.env.PAGES_ARTIFACT_NAME || 'github-pages'
const maxWaitMs = Number(process.env.PAGES_DEPLOY_TIMEOUT_MS || 25 * 60 * 1000)
const intervalMs = Number(process.env.PAGES_DEPLOY_POLL_MS || 10_000)

if (!owner || !repo || !sha || !token) {
  throw new Error('Missing GITHUB_REPOSITORY_OWNER / GITHUB_REPOSITORY / GITHUB_SHA / GITHUB_TOKEN')
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
    throw error
  }
  return data
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function cancelStaleDeployments() {
  const deployments = await api(
    'GET',
    `/repos/${owner}/${repo}/deployments?environment=github-pages&per_page=20`,
  )
  for (const deployment of deployments) {
    const id = deployment.sha
    if (!id || id === sha) continue
    try {
      const status = await api('GET', `/repos/${owner}/${repo}/pages/deployments/${id}`)
      const state = status?.status
      if (
        state === 'deployment_queued' ||
        state === 'syncing_files' ||
        state === 'in_progress' ||
        state === 'waiting' ||
        state === 'deployment_in_progress'
      ) {
        console.log(`Canceling stale Pages deployment ${id.slice(0, 7)} (${state})`)
        await api('POST', `/repos/${owner}/${repo}/pages/deployments/${id}/cancel`)
      }
    } catch (error) {
      if (error.status !== 404) {
        console.warn(`Skip cancel for ${id.slice(0, 7)}: ${error.message}`)
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
  // Match actions/deploy-pages: default audience (do not force "github")
  const response = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${requestToken}` },
  })
  const data = await response.json()
  if (!response.ok || !data.value) {
    throw new Error(`Failed to fetch OIDC token: ${data.message || response.status}`)
  }
  return data.value
}

async function getArtifactId() {
  const require = createRequire(import.meta.url)
  const { DefaultArtifactClient } = require('@actions/artifact')
  const client = new DefaultArtifactClient()
  const result = await client.listArtifacts()
  const matches = (result.artifacts || []).filter((artifact) => artifact.name === artifactName)
  if (matches.length === 0) {
    throw new Error(`No artifacts named "${artifactName}" found for this workflow run`)
  }
  if (matches.length > 1) {
    throw new Error(`Multiple artifacts named "${artifactName}" found (${matches.length})`)
  }
  console.log(`Using artifact id=${matches[0].id} name=${matches[0].name} size=${matches[0].size}`)
  return matches[0].id
}

async function createDeployment(artifactId, idToken) {
  console.log('Creating Pages deployment...')
  return api('POST', `/repos/${owner}/${repo}/pages/deployments`, {
    artifact_id: artifactId,
    pages_build_version: sha,
    oidc_token: idToken,
  })
}

async function waitForDeployment(deploymentId) {
  const started = Date.now()
  let lastStatus = ''
  const success = new Set(['succeed', 'success', 'deployed'])
  const failure = new Set([
    'deployment_failed',
    'failed',
    'failure',
    'error',
    'deployment_cancelled',
    'cancelled',
    'deployment_content_failed',
    'deployment_lost',
  ])

  while (Date.now() - started < maxWaitMs) {
    const status = await api('GET', `/repos/${owner}/${repo}/pages/deployments/${deploymentId}`)
    const state = status.status || 'unknown'
    if (state !== lastStatus) {
      console.log(`Pages status: ${state}`)
      lastStatus = state
    }
    if (success.has(state)) return status
    if (failure.has(state)) {
      throw new Error(`Pages deployment failed with status=${state}`)
    }
    await sleep(intervalMs)
  }

  throw new Error(
    `Timed out after ${Math.round(maxWaitMs / 60000)}m waiting for ${deploymentId}. Left running (not canceled).`,
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
  console.log('Stale cleanup done.')
  process.exit(0)
}

await cancelStaleDeployments()
const [artifactId, idToken] = await Promise.all([getArtifactId(), getOidcToken()])

let deployment
try {
  deployment = await createDeployment(artifactId, idToken)
} catch (error) {
  console.warn(`Create failed (${error.message}); cleanup and retry once...`)
  await cancelStaleDeployments()
  await sleep(30_000)
  deployment = await createDeployment(artifactId, idToken)
}

const deploymentId = deployment.id || deployment.status_url?.split('/')?.pop() || sha
console.log(`Created deployment id=${deploymentId}`)
console.log(JSON.stringify(deployment))
const finalStatus = await waitForDeployment(deploymentId)
const pageUrl = finalStatus.page_url || `https://${owner}.github.io/${repo}/`
console.log(`Deployed: ${pageUrl}`)
writeOutput(pageUrl)
