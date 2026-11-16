import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const webhookUrl = env.EMAIL_WEBHOOK_URL
  const webhookEndpoint = webhookUrl ? new URL(webhookUrl) : undefined
  const webhookProxy = webhookEndpoint
    ? {
        '/api/webhook': {
          target: webhookEndpoint.origin,
          changeOrigin: true,
          rewrite: (path) =>
            path.replace('/api/webhook', webhookEndpoint.pathname),
        },
      }
    : undefined

  return {
    plugins: [react(), tailwindcss()],
    server: webhookProxy ? { proxy: webhookProxy } : undefined,
  }
})