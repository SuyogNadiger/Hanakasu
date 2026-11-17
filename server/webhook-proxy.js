import process from 'node:process';

function webhookError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function forwardWebhookRequest(
  method,
  body,
  configuredUrl = process.env.EMAIL_WEBHOOK_URL,
  authorizedEmail,
) {
  if (method !== 'POST') {
    throw webhookError(405, 'Method not allowed');
  }
  if (!configuredUrl) {
    throw webhookError(503, 'EMAIL_WEBHOOK_URL is not configured');
  }

  let payload;
  try {
    payload = JSON.parse(body || '');
  } catch {
    throw webhookError(400, 'Invalid webhook request.');
  }
  if (payload?.action !== 'send_email') {
    throw webhookError(403, 'This webhook action is disabled.');
  }
  const recipientEmail =
    typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (
    typeof authorizedEmail !== 'string' ||
    !authorizedEmail.trim() ||
    recipientEmail !== authorizedEmail.trim().toLowerCase()
  ) {
    throw webhookError(
      403,
      'Email alerts can only be sent to your signed-in account email.',
    );
  }

  const targetUrl = new URL(configuredUrl);
  if (targetUrl.protocol !== 'https:') {
    throw webhookError(500, 'EMAIL_WEBHOOK_URL must use HTTPS.');
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
  });
  const responseBody = await response.text();
  if (response.ok) {
    let result;
    try {
      result = JSON.parse(responseBody);
    } catch {
      result = null;
    }
    if (
      result &&
      typeof result === 'object' &&
      (result.success === false || result.ok === false || result.error)
    ) {
      const message =
        typeof result.error === 'string' && result.error.trim()
          ? result.error.trim().slice(0, 200)
          : 'The email service reported that delivery failed.';
      throw webhookError(502, message);
    }
  }

  return {
    status: response.status,
    contentType: response.headers.get('content-type') || 'text/plain;charset=utf-8',
    body: responseBody,
  };
}
