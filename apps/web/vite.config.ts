import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envDir: path.resolve(__dirname, "../.."),
  plugins: [react()],
  resolve: {
    alias: {
      "@dmacq/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/activities": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
