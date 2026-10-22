import { loadEnv, type ProxyOptions } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.API_URL ?? ''
  const apiUser = env.API_USER ?? env.CANDIDATE_ID ?? ''

  if (command === 'serve' && (!apiUrl || !apiUser)) {
    console.warn(
      '[vite.config] API_URL or API_USER is empty. The /api proxy will not work correctly.',
    )
  }

  const apiProxy: Record<string, ProxyOptions> = {
    '/api': {
      target: apiUrl,
      changeOrigin: true,
      secure: true,
      rewrite: (path) => {
        const [base, query] = path.split('?')
        const userParam = `user=${encodeURIComponent(apiUser)}`
        return query ? `${base}?${query}&${userParam}` : `${base}?${userParam}`
      },
    },
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    server: {
      proxy: apiProxy,
    },
    preview: {
      proxy: apiProxy,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      restoreMocks: true,
    },
  }
})
