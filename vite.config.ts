import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest i stedet for generateSW: vi skriver selv service
      // workeren (src/sw.ts), så vi kan tilføje push-notifikations-
      // håndtering ved siden af den almindelige offline-caching.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: "auto",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Ugeplan",
        short_name: "Ugeplan",
        description: "Piktogram-baseret ugeplan for børn",
        theme_color: "#1B8272",
        background_color: "#F7F9FB",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      injectManifest: {
        // App-skal, fonte og statiske assets: cache-first, så appen altid åbner
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"]
      }
    })
  ]
});
