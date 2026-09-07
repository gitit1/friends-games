import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Registered port for this project (global dev-ports registry). 5173/5174 are
  // banned repo-wide; strictPort makes a collision fail loudly instead of
  // silently hopping to another project's port.
  server: {
    port: 5199,
    strictPort: true,
  },
  preview: {
    port: 5199,
    strictPort: true,
  },
})
