import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  // убираем ворнинги "preloaded but not used"
  optimizeDeps: {
    preload: false,
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})