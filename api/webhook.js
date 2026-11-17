import process from 'node:process';
import { forwardWebhookRequest } from '../server/webhook-proxy.js';
import { verifyFirebaseIdToken } from '../server/firebase-auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const identity = await verifyFirebaseIdToken(
      req.headers.authorization,
      process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    );
    const body =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const result = await forwardWebhookRequest('POST', body, undefined, identity.email);
    res.setHeader('Content-Type', result.contentType);
    return res.status(result.status).send(result.body);
  } catch (err) {
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Webhook request failed' });
  }
}