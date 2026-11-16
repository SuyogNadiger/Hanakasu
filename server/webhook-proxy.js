import process from 'node:process';

export async function forwardWebhookRequest(method, body) {
  const configuredUrl = process.env.EMAIL_WEBHOOK_URL;
  if (!configuredUrl) {
    throw new Error('EMAIL_WEBHOOK_URL is not configured');
  }

  const targetUrl = new URL(configuredUrl);
  if (method === 'GET') {
    targetUrl.searchParams.set('action', 'pull_db');
    targetUrl.searchParams.set('t', String(Date.now()));
  }

  const response = await fetch(targetUrl, {
    method,
    redirect: 'follow',
    ...(method === 'POST'
      ? {
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body,
        }
      : {}),
  });

  return {
    status: response.status,
    contentType: response.headers.get('content-type') || 'text/plain;charset=utf-8',
    body: await response.text(),
  };
}
