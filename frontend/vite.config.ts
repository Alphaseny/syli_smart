import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icons/icon-192.png", "icons/icon-512.png"],

      // ── Manifest (informations de l'application) ───────────────────────────
      manifest: {
        name: "Syli Bureau",
        short_name: "Syli Bureau",
        description: "Gestion et contrôle à distance d'un bureau connecté",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "fr",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      // ── Service Worker (stratégies de cache) ───────────────────────────────
      workbox: {
        // Pages de l'application : réseau en priorité, cache en secours
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "local-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 2 },
              networkTimeoutSeconds: 8,
            },
          },
        ],
        // Assets statiques : cache en priorité
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },

      // ── Dev : activer le SW en mode développement ──────────────────────────
      devOptions: {
        enabled: false, // passer à true pour tester le SW en dev
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
