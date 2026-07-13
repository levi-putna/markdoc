import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      env: {
        AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY ?? '',
      },
      include: [
        'tests/unit/**/*.test.ts',
        'tests/unit/**/*.test.tsx',
        'tests/component/**/*.test.tsx',
      ],
      exclude: ['tests/e2e/**'],
    },
  }
})
