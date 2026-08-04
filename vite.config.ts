import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const requestedBase = process.env.VITE_BASE_PATH ?? '/'
const normalizedPath = requestedBase.replace(/^\/+|\/+$/g, '')
const base = normalizedPath ? `/${normalizedPath}/` : '/'
/** Bump when replacing app icons so clients drop stale SVG/manifest entries. */
const ICON_CACHE_VERSION = '20260804b'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'Planning',
        short_name: 'Planning',
        description: '用时间轴安排家庭生活',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f7ebe3',
        theme_color: '#e08a55',
        icons: [
          {
            src: `${base}pwa-192x192.svg?v=${ICON_CACHE_VERSION}`,
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: `${base}pwa-512x512.svg?v=${ICON_CACHE_VERSION}`,
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              /favicon\.svg$|pwa-\d+x\d+\.svg$|icons\.svg$|manifest\.webmanifest$/i.test(
                url.pathname,
              ),
            handler: 'NetworkFirst',
            options: {
              cacheName: `planning-icons-v${ICON_CACHE_VERSION}`,
              expiration: {
                maxEntries: 12,
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
