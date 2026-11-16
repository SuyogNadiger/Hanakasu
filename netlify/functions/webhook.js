import { forwardWebhookRequest } from '../../server/webhook-proxy.js';

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = request.method === 'POST' ? await request.text() : undefined;
    const result = await forwardWebhookRequest(request.method, body);
    return new Response(result.body, {
      status: result.status,
      headers: { 'Content-Type': result.contentType },
    });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Webhook request failed' },
      { status: 500 },
    );
  }
}
