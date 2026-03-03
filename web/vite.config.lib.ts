import { defineConfig } from "vite";
import path, { resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ mode }) => ({
  publicDir: false,
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode === "development",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    // Keep peer/runtime dependencies external for library consumers.
    rollupOptions: {
      external: (id) =>
        id === "@nvidia/omniverse-webrtc-streaming-library" ||
        /^react(-dom)?(\/.*)?$/.test(id),
    },
  },
}));
