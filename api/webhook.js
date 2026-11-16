import { forwardWebhookRequest } from '../server/webhook-proxy.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const result = await forwardWebhookRequest(req.method, body);
    res.setHeader('Content-Type', result.contentType);
    return res.status(result.status).send(result.body);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Webhook request failed' });
  }
}