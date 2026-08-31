import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Mapbox GL is intentionally isolated behind the lazy globe/map boundary.
    // Its vendor chunk is large but never part of the initial application load.
    chunkSizeWarningLimit: 1_900,
  },
  server: {
    port: 5173,
  },
});
