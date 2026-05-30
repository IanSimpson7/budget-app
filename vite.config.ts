/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Hardcoded base per RESEARCH.md Open Question 3 (D-18): GitHub Pages subpath is stable.
export default defineConfig({
  base: '/budget-app/',
  plugins: [react()],
  server: {
    open: true,
    // Permit the Vite dev server to serve files from the workspace root
    // (one level above the project root), enabling the import.meta.glob
    // plan loader in food.atoms.ts to serve ../schedule-meal-coordinator/plans/*.md.
    // Without this, the dev server blocks cross-directory requests with a 403.
    // Build (npm run build) is unaffected — it bundles at build time without
    // the dev-server fs restriction. [Pitfall 2 fix, RESEARCH Pattern 1]
    fs: {
      allow: ['..'],
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
