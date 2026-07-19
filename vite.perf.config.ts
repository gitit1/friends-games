import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Perf-audit-only vite config. Uses a private cacheDir OUTSIDE the junctioned
// node_modules so the dep optimizer doesn't collide with the owner's own vite
// (which shares the same node_modules on port 5199). Port 6199 per global rule.
export default defineConfig({
  plugins: [react()],
  cacheDir: 'C:/Users/gitit/AppData/Local/Temp/claude/c--Users-gitit-Git-Workplace-Games-assaf-friends-games/d9336cf1-a35e-4110-b00c-de845c83c9ed/scratchpad/vite-cache',
  server: { port: 6199, strictPort: true },
})
