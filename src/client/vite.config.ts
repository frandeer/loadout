/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// dev 프록시 타깃은 서버 포트를 따른다 — server.mjs 가 PORT 환경변수를 존중하므로 여기서도 맞춘다
// (PORT=5000 으로 서버를 띄웠는데 프록시는 4970 으로 가서 404 나는 불일치 방지).
const apiTarget = `http://localhost:${process.env.PORT || 4970}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      // 생성/슬라이스된 카드 아트는 서버가 /media/ 로 서빙한다. dev(:5173)에서도
      // 이미지가 보이려면 /media 도 서버 포트로 프록시해야 한다(안 그러면 404).
      "/media": {
        target: apiTarget,
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
