import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    preload: false, // Отключаем предзагрузку зависимостей в dev
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    modulePreload: false, // ❌ отключаем предзагрузку модулей в проде
    rollupOptions: {
      output: {
        manualChunks: undefined, // Всё в один JS-файл
      },
    },
  },
  base: "./", // важно для корректной работы на Render
});
