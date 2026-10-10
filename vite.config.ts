import { defineConfig } from "vitest/config";

// Tauri expects a fixed dev port and serves the built files from dist/.
export default defineConfig({
  root: "src",
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "chrome120",
    sourcemap: false,
  },
  test: { root: ".", include: ["src/**/*.test.ts"] },
});
