import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: { '/api': { target: 'http://localhost:5133', changeOrigin: true } },
    },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
