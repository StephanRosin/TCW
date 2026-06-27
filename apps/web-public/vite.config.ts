import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PUBLIC_API_TARGET = process.env.IC_PUBLIC_API_URL ?? "http://localhost:8090";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: PUBLIC_API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
