import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { suggestTransaction } from './server/gemini-transaction.js'
import { generateFinancialAdvice } from './server/gemini-financial-advice.js'
import { verifyFirebaseIdToken } from './server/firebase-auth.js'
import { forwardWebhookRequest } from './server/webhook-proxy.js'

function apiRoutesPlugin({ apiKey, projectId, webhookUrl }) {
  return {
    name: 'hanakasu-api-routes',
    configureServer(server) {
      const readBody = async (request, limit = 65536) => {
        let body = ''
        for await (const chunk of request) {
          body += chunk
          if (body.length > limit) {
            const error = new Error('Request is too large.')
            error.statusCode = 413
            throw error
          }
        }
        return body
      }

      const sendError = (response, error) => {
        response.statusCode = error.statusCode || 500
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ error: error.message || 'Request failed.' }))
      }

      server.middlewares.use('/api/parse-transaction', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          await verifyFirebaseIdToken(request.headers.authorization, projectId)
          const body = await readBody(request, 20000)
          let input
          try {
            input = JSON.parse(body)
          } catch {
            const error = new Error('Invalid transaction request.')
            error.statusCode = 400
            throw error
          }
          const result = await suggestTransaction(input, apiKey)
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(result))
        } catch (error) {
          sendError(response, error)
        }
      })

      server.middlewares.use('/api/financial-advice', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          await verifyFirebaseIdToken(request.headers.authorization, projectId)
          const body = await readBody(request, 20000)
          let input
          try {
            input = JSON.parse(body)
          } catch {
            const error = new Error('Invalid financial analysis request.')
            error.statusCode = 400
            throw error
          }
          const result = await generateFinancialAdvice(input, apiKey)
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(result))
        } catch (error) {
          sendError(response, error)
        }
      })

      server.middlewares.use('/api/webhook', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const identity = await verifyFirebaseIdToken(request.headers.authorization, projectId)
          const body = await readBody(request)
          const result = await forwardWebhookRequest(
            'POST',
            body,
            webhookUrl,
            identity.email,
          )
          response.statusCode = result.status
          response.setHeader('Content-Type', result.contentType)
          response.end(result.body)
        } catch (error) {
          sendError(response, error)
        }
      })

    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    optimizeDeps: {
      include: ['@firebase/firestore'],
    },
    plugins: [
      react(),
      tailwindcss(),
      apiRoutesPlugin({
        apiKey: env.GEMINI_API_KEY,
        projectId: env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID,
        webhookUrl: env.EMAIL_WEBHOOK_URL,
      }),
    ],
  }
})