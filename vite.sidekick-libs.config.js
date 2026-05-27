import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/sidekickLocalLibs.js",
      name: "SidekickLibBundle",
      formats: ["iife"],
      fileName: () => "sidekick-local-libs.js"
    },
    outDir: "public/vendor",
    rollupOptions: {
      output: {
        extend: true
      }
    }
  }
});
