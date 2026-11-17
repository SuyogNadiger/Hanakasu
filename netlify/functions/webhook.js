import process from 'node:process';
import { forwardWebhookRequest } from '../../server/webhook-proxy.js';
import { verifyFirebaseIdToken } from '../../server/firebase-auth.js';

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const identity = await verifyFirebaseIdToken(
      request.headers.get('authorization'),
      process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    );
    const body = await request.text();
    const result = await forwardWebhookRequest('POST', body, undefined, identity.email);
    return new Response(result.body, {
      status: result.status,
      headers: { 'Content-Type': result.contentType },
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Webhook request failed' },
      { status: err.statusCode || 500 },
    );
  }
}
