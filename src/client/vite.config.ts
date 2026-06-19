/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4970",
        changeOrigin: true,
      },
      // 생성/슬라이스된 카드 아트는 서버가 /media/ 로 서빙한다. dev(:5173)에서도
      // 이미지가 보이려면 /media 도 :4970 으로 프록시해야 한다(안 그러면 404).
      "/media": {
        target: "http://localhost:4970",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
