import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const requestedBase = process.env.VITE_BASE_PATH ?? '/'
const normalizedPath = requestedBase.replace(/^\/+|\/+$/g, '')
const base = normalizedPath ? `/${normalizedPath}/` : '/'

/**
 * Single icon version for cache-busting.
 * When replacing icons: bump this value and rename the 4 files in /public.
 */
const ICON_VERSION = '20260804f'

function injectIconVersion(): Plugin {
  return {
    name: 'inject-icon-version',
    transformIndexHtml(html) {
      return html.replaceAll('%ICON_VERSION%', ICON_VERSION)
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    injectIconVersion(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        `favicon-${ICON_VERSION}.svg`,
        `apple-touch-icon-${ICON_VERSION}.png`,
        `pwa-192-${ICON_VERSION}.png`,
        `pwa-512-${ICON_VERSION}.png`,
      ],
      manifest: {
        name: 'Planning',
        short_name: 'Planning',
        description: '用时间轴安排家庭生活',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#100e0c',
        theme_color: '#1a1612',
        icons: [
          {
            src: `${base}pwa-192-${ICON_VERSION}.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}pwa-512-${ICON_VERSION}.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}pwa-512-${ICON_VERSION}.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              /favicon[^/]*\.(svg|ico)$|apple-touch-icon[^/]*\.png$|pwa-\d+[^/]*\.(svg|png)$|manifest\.webmanifest$/i.test(
                url.pathname,
              ),
            handler: 'NetworkFirst',
            options: {
              cacheName: `planning-icons-${ICON_VERSION}`,
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24,
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
})
