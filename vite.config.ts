import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const requestedBase = process.env.VITE_BASE_PATH ?? '/'
const normalizedPath = requestedBase.replace(/^\/+|\/+$/g, '')
const base = normalizedPath ? `/${normalizedPath}/` : '/'
/** Bump + rename icon files when replacing app icons (iOS caches by URL path). */
const ICON_CACHE_VERSION = '20260806g'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        `favicon-${ICON_CACHE_VERSION}.svg`,
        `apple-touch-icon-${ICON_CACHE_VERSION}.png`,
        `pwa-192-${ICON_CACHE_VERSION}.png`,
        `pwa-512-${ICON_CACHE_VERSION}.png`,
        `pwa-192-${ICON_CACHE_VERSION}.svg`,
        `pwa-512-${ICON_CACHE_VERSION}.svg`,
      ],
      manifest: {
        name: 'Planning',
        short_name: 'Planning',
        description: '用时间轴安排家庭生活',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#fffaf6',
        theme_color: '#e08a55',
        icons: [
          {
            src: `${base}pwa-192-${ICON_CACHE_VERSION}.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}pwa-512-${ICON_CACHE_VERSION}.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}pwa-512-${ICON_CACHE_VERSION}.png`,
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
              cacheName: `planning-icons-v${ICON_CACHE_VERSION}`,
              expiration: {
                maxEntries: 16,
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
