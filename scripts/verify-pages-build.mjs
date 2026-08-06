import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { constants as fsConstants } from 'node:fs'

const expectedBase = '/planning/'
const distDir = process.env.DIST_DIR ?? 'dist'

const viteConfig = await readFile('vite.config.ts', 'utf8')
const iconVersion = viteConfig.match(/ICON_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1]
if (!iconVersion) throw new Error('ICON_VERSION not found in vite.config.ts')

const requiredFiles = [
  `favicon-${iconVersion}.svg`,
  `apple-touch-icon-${iconVersion}.png`,
  `pwa-192-${iconVersion}.png`,
  `pwa-512-${iconVersion}.png`,
  'index.html',
  'manifest.webmanifest',
  'sw.js',
]

for (const file of requiredFiles) {
  try {
    await access(join(distDir, file), fsConstants.R_OK)
  } catch {
    throw new Error(`Missing required Pages artifact: ${file}`)
  }
}

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
  [!html.includes('%ICON_VERSION%'), 'icon version placeholders resolved'],
  [html.includes(`${expectedBase}assets/`), 'index.html asset URLs'],
  [html.includes(`${expectedBase}manifest.webmanifest`), 'manifest URL'],
  [html.includes(`favicon-${iconVersion}.svg`), 'versioned favicon'],
  [html.includes(`apple-touch-icon-${iconVersion}.png`), 'versioned apple-touch-icon'],
  [manifest.start_url === expectedBase, 'manifest start_url'],
  [manifest.scope === expectedBase, 'manifest scope'],
  [
    Array.isArray(manifest.icons) &&
      manifest.icons.some(
        (icon) =>
          typeof icon?.src === 'string' &&
          icon.src.includes(`pwa-192-${iconVersion}.png`) &&
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

console.log(`GitHub Pages artifact verified (icons ${iconVersion}).`)
