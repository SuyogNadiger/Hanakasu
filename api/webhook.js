import process from 'node:process';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const appsScriptUrl = process.env.EMAIL_WEBHOOK_URL;
  if (!appsScriptUrl) {
    return res.status(500).json({ error: 'EMAIL_WEBHOOK_URL is not configured' });
  }

  try {
    if (req.method === 'GET') {
      const response = await fetch(`${appsScriptUrl}?action=pull_db&t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow'
      });
      const text = await response.text();
      return res.status(200).send(text);
    }

    if (req.method === 'POST') {
      const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr
      });
      const text = await response.text();
      return res.status(200).send(text);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}