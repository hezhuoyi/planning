import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const expectedBase = '/planning/'
const distDir = process.env.DIST_DIR ?? 'dist'
const [html, manifestText, serviceWorker] = await Promise.all([
  readFile(join(distDir, 'index.html'), 'utf8'),
  readFile(join(distDir, 'manifest.webmanifest'), 'utf8'),
  readFile(join(distDir, 'sw.js'), 'utf8'),
])
const manifest = JSON.parse(manifestText)
const entryPath = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]
const entryBundle =
  entryPath?.startsWith(expectedBase)
    ? await readFile(join(distDir, entryPath.slice(expectedBase.length)), 'utf8')
    : ''

const checks = [
  [html.includes(`${expectedBase}assets/`), 'index.html asset URLs'],
  [html.includes(`${expectedBase}manifest.webmanifest`), 'manifest URL'],
  [html.includes('apple-touch-icon'), 'apple-touch-icon link'],
  [html.includes('apple-touch-icon-20260804e.png'), 'versioned apple-touch-icon'],
  [manifest.start_url === expectedBase, 'manifest start_url'],
  [manifest.scope === expectedBase, 'manifest scope'],
  [
    Array.isArray(manifest.icons) &&
      manifest.icons.some(
        (icon) =>
          typeof icon?.src === 'string' &&
          icon.src.includes('pwa-192-20260804e.png') &&
          icon.type === 'image/png',
      ),
    'manifest png icons',
  ],
  [!html.includes('registerSW.js'), 'single app-managed service worker registration'],
  [entryBundle.includes(`${expectedBase}sw.js`), 'service worker registration'],
  [entryBundle.includes('visibilitychange'), 'foreground update check'],
  [serviceWorker.includes(`${expectedBase}index.html`), 'navigation fallback'],
]

const failed = checks.filter(([passed]) => !passed).map(([, label]) => label)
if (failed.length) throw new Error(`Invalid GitHub Pages build: ${failed.join(', ')}`)

console.log('GitHub Pages artifact paths verified.')
