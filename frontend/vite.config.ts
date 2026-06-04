import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    /**
     * AMÉLIORATION : proxy Vite pour éviter les problèmes CORS en dev.
     * Les appels à /api/* sont redirigés vers le backend FastAPI.
     * Cela évite d'avoir à gérer CORS explicitement en développement.
     */
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})