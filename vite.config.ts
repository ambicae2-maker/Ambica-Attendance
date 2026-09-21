import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// Keep in sync with --ink in src/theme/tokens.css (used by the OS for the status bar / splash).
const THEME_COLOR = "#101218";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Pre-bundle libraries used by lazy-loaded screens so the dev server never
  // re-optimizes mid-session (which caused a blank page on first navigation).
  optimizeDeps: {
    include: ["date-fns", "framer-motion", "lucide-react", "sonner", "@radix-ui/react-dialog", "html-to-image", "jspdf", "idb-keyval"],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png", "logo.png"],
      manifest: {
        name: "Ambica Attendance",
        short_name: "Attendance",
        description: "Driver attendance and salary for Ambica Enterprise",
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Driver photos + company logo from Supabase Storage
            urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/"),
            handler: "CacheFirst",
            options: { cacheName: "media", expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
    }),
  ],
});
