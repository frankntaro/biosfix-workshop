import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

function apiRuntimeCaching(apiPrefix) {
  const rules = [];
  if (apiPrefix.startsWith("http")) {
    try {
      const origin = new URL(apiPrefix).origin;
      rules.push({
        urlPattern: ({ url, request }) => url.origin === origin && request.method === "GET",
        handler: "NetworkFirst",
        options: {
          cacheName: "biosfix-api-remote",
          networkTimeoutSeconds: 8,
          expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 },
          cacheableResponse: { statuses: [0, 200] },
        },
      });
    } catch {
      /* invalid URL */
    }
  } else {
    rules.push({
      urlPattern: ({ url, request }) => url.pathname.startsWith("/api/") && request.method === "GET",
      handler: "NetworkFirst",
      options: {
        cacheName: "biosfix-api",
        networkTimeoutSeconds: 8,
        expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] },
      },
    });
  }
  return rules;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPrefix = env.VITE_API_PREFIX || "/api";

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: [
          "favicon-16x16.png",
          "favicon-32x32.png",
          "apple-touch-icon.png",
          "icon.svg",
          "icon-maskable.svg",
          "biosfix-logo.png",
          "install-app-icon.png",
          "biosfix-app-icon-source.jpg",
        ],
        manifest: {
          id: "/",
          name: "BIOSFIX Technology Workshop",
          short_name: "BIOSFIX",
          description: "Computer and laptop repair workshop management.",
          theme_color: "#0d6b73",
          background_color: "#0d6b73",
          display: "standalone",
          display_override: ["standalone", "minimal-ui", "browser"],
          orientation: "any",
          start_url: "/",
          scope: "/",
          lang: "en",
          dir: "ltr",
          categories: ["business", "productivity", "utilities"],
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/pwa-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          ],
          shortcuts: [
            { name: "Dashboard", short_name: "Dashboard", url: "/", description: "Workshop overview" },
            { name: "Jobs", short_name: "Jobs", url: "/jobs", description: "View jobs" },
            { name: "New job", short_name: "New", url: "/jobs/new", description: "Create a new repair job" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,svg,png,jpg,webmanifest,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            ...apiRuntimeCaching(apiPrefix),
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "biosfix-images",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "google-fonts-stylesheets" },
            },
            {
              urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: "module",
          navigateFallback: "index.html",
          suppressWarnings: true,
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
  };
});
