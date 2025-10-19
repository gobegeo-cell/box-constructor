import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Полная конфигурация под твой проект (3D, PDF, логотипы, тяжёлые ассеты)
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000", // локальный backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 8000, // 📦 до 8 МБ — можно добавлять модели, текстуры, PDF, не будет ворнингов
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          three: ["three"],
        },
      },
    },
  },
});
