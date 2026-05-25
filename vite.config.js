import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // Prevent code-splitting so the popup loads from a single JS file
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
