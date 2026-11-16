# Hanakasu Mantri

## Local development

1. Copy `.env.example` to `.env`.
2. Set `EMAIL_WEBHOOK_URL` in `.env` to the Google Apps Script endpoint.
3. Run `npm install` and `npm run dev`.

The webhook URL is used only by a server-side function; it is not exposed as a `VITE_` client variable.

## Deployment

Set `EMAIL_WEBHOOK_URL` in the hosting provider's environment settings, then redeploy:

- **Vercel:** Add it under Project Settings → Environment Variables. `api/webhook.js` handles `/api/webhook`.
- **Netlify:** Add it under Site configuration → Environment variables. The Netlify function and rewrite in `netlify.toml` handle `/api/webhook`.
- **Other static hosts:** A static site cannot send email by itself. Configure a serverless function at `/api/webhook` that forwards to the Apps Script endpoint, and set `EMAIL_WEBHOOK_URL` in that function's runtime environment.

The OTP is only accepted after the server reports successful delivery. Check the hosting function logs if sending fails.

Build with `npm run build`; the production assets are written to `dist`.
