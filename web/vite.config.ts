import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import svgr from "vite-plugin-svgr"
import { resolve } from "path"
import os from "os"

// Get all local network IP addresses
function getNetworkIPs(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    // Allow connections from any host (needed for Kit streaming)
    host: "0.0.0.0",
    port: 8081,
    // Proxy API requests to backend (for NVCF mode)
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        ws: true,
      }
    },
    // Allow cross-origin requests (needed for local Kit streaming)
    cors: true,
  },
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Multi-page app configuration
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@arcgis/core")) return "vendor-arcgis";
            if (id.includes("react-router") || id.includes("/react-dom/") || id.includes("/react/")) return "vendor-react";
            if (id.includes("@mantine")) return "vendor-mantine";
            if (id.includes("@nvidia/omniverse-webrtc")) return "vendor-webrtc";
            if (id.includes("recharts")) return "vendor-charts";
          }
        },
      },
    },
  },
})
