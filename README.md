# Hanakasu Mantri

## Local development

1. Copy `.env.example` to `.env`.
2. Set `EMAIL_WEBHOOK_URL` in `.env` to the Google Apps Script endpoint.
3. Run `npm install` and `npm run dev`.

The webhook URL is used only by the local Vite proxy and the server-side `/api/webhook` handler; it is not exposed as a `VITE_` client variable. Configure the same `EMAIL_WEBHOOK_URL` in your deployment provider's environment settings.

## Deployment

Build with `npm run build`; the production assets are written to `dist`.
