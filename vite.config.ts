import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function hmrCompatPlugin(): Plugin {
  const dummyHot = {
    send: () => {},
    close: () => {},
    on: () => {},
    off: () => {},
    listen: () => {},
    clients: new Set(),
  };

  return {
    name: 'hmr-disabled-compat',
    enforce: 'pre',
    configureServer(server) {
      if (!server.ws) {
        (server as any).ws = dummyHot;
      } else if (!server.ws.send) {
        server.ws.send = () => {};
      }
      if (!server.hot) {
        (server as any).hot = dummyHot;
      } else if (!server.hot.send) {
        (server.hot as any).send = () => {};
      }
      if (server.environments) {
        for (const env of Object.values(server.environments) as any[]) {
          if (!env.hot) {
            env.hot = dummyHot;
          } else if (!env.hot.send) {
            env.hot.send = () => {};
          }
        }
      }
    },
    hotUpdate(this: any, { server }) {
      if (this.environment && !this.environment.hot) {
        this.environment.hot = dummyHot;
      }
      if (server) {
        if (!server.hot) (server as any).hot = dummyHot;
        if (!server.ws) (server as any).ws = dummyHot;
        if (server.environments) {
          for (const env of Object.values(server.environments) as any[]) {
            if (!env.hot) env.hot = dummyHot;
          }
        }
      }
      if (process.env.DISABLE_HMR === 'true') {
        return [];
      }
    },
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs') || id.includes('@vite/client')) {
        return code
          .replace(/ws\.send\(JSON\.stringify\(data\)\);/g, 'if (ws && typeof ws.send === "function") { try { ws.send(JSON.stringify(data)); } catch {} }')
          .replace(/wsTransport\.send\(data\);/g, 'if (wsTransport && typeof wsTransport.send === "function") { try { wsTransport.send(data); } catch {} }')
          .replace(/this\.transport\.send\(payload\)\.catch/g, '(this.transport?.send?.(payload) || Promise.resolve()).catch')
          .replace(/error:\s*\(err\)\s*=>\s*console\.error\(\"\[vite\]\",\s*err\)/g, 'error: (err) => { if (err && (String(err).includes("send") || String(err).includes("WebSocket") || String(err).includes("connect"))) return; console.error("[vite]", err); }');
      }
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const errorShieldScript = `<script>
(function() {
  var orig = console.error;
  console.error = function() {
    var first = arguments[0];
    var second = arguments[1];
    if (first === '[vite]' && second && (String(second).indexOf('send') !== -1 || String(second).indexOf('WebSocket') !== -1)) {
      return;
    }
    if (typeof first === 'string' && first.indexOf('[vite]') !== -1 && (first.indexOf('send') !== -1 || first.indexOf('WebSocket') !== -1)) {
      return;
    }
    return orig.apply(console, arguments);
  };
})();
</script>`;
        if (html.includes('<head>')) {
          return html.replace('<head>', '<head>' + errorShieldScript);
        }
        return errorShieldScript + html;
      },
    },
  };
}

function devServiceWorkerCleanupPlugin(): Plugin {
  // vite-plugin-pwa is disabled in development, so nothing generates /sw.js here. Earlier
  // versions of this app registered a hand-written cache-first worker at that path, which
  // pinned stale HTML and modules in the browser — including the very code that would have
  // stopped registering it. Serving a self-destroying worker lets any browser still holding
  // that registration update to one that drops the caches and unregisters itself.
  const selfDestroyingWorker = [
    "self.addEventListener('install', () => self.skipWaiting());",
    "self.addEventListener('activate', (event) => {",
    '  event.waitUntil((async () => {',
    '    const keys = await caches.keys();',
    '    await Promise.all(keys.map((key) => caches.delete(key)));',
    '    await self.registration.unregister();',
    "    const windows = await self.clients.matchAll({ type: 'window' });",
    '    windows.forEach((client) => client.navigate(client.url));',
    '  })());',
    '});',
  ].join('\n');

  return {
    name: 'dev-service-worker-cleanup',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/sw.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-store');
        res.end(selfDestroyingWorker);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      hmrCompatPlugin(),
      devServiceWorkerCleanupPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Lock In - Focus & Break Suite',
          short_name: 'Lock In',
          description: 'A warm, minimalistic study suite with automated focus and break timers for Pomodoro, Flowtime, 90-Minute Cycles, Time Boxing, and the 52/17 Rule.',
          theme_color: '#FAF8F5',
          background_color: '#FAF8F5',
          display: 'standalone',
          orientation: 'portrait-primary',
          categories: ['education', 'productivity', 'utilities'],
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      hotUpdateEnvironments: process.env.DISABLE_HMR === 'true' ? () => Promise.resolve() : undefined,
    },
  };
});
