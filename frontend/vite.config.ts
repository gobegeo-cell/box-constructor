// vite.config.ts — полный рабочий вариант для твоего проекта
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // теперь "@/..." резолвится в "src/"
    },
  },
  server: {
    port: 5173,        // порт фронта
    host: true,        // доступ извне
    strictPort: false, // если занят, пробует следующий
    open: true,        // автозапуск браузера
    proxy: {
      "/api": {
        target: "http://localhost:4000", // твой backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
});