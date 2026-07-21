import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
      workbox: {
        // App-skal, fonte og statiske assets: cache-first, så appen altid åbner
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        runtimeCaching: [
          {
            // ARASAAC-piktogrammer: cache-first, lang levetid (de ændrer sig ikke)
            urlPattern: /^https:\/\/static\.arasaac\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "arasaac-pictograms",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 dage
              }
            }
          },
          {
            // OpenSymbols-piktogrammer (Sclera, Mulberry m.fl.) - hostes typisk
            // via Google Cloud Storage eller CloudFront, samme cache-strategi
            urlPattern: /^https:\/\/(storage\.googleapis\.com|.*\.cloudfront\.net)\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "opensymbols-pictograms",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90
              }
            }
          },
          {
            // Supabase data-kald: network-first med fallback til cache, så seneste kendte ugeplan vises offline
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-data",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 dage
              }
            }
          }
        ]
      }
    })
  ]
});
