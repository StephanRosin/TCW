import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const ADMIN_API_TARGET = process.env.IC_ADMIN_API_URL ?? "http://localhost:8091";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": { target: ADMIN_API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
