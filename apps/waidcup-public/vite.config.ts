import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const WAIDCUP_API_TARGET = process.env.IC_WAIDCUP_API_URL ?? "http://localhost:8096";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      "/api": { target: WAIDCUP_API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
