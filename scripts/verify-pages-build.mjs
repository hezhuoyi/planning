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
