import { defineConfig } from "vite";

export default defineConfig({
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
