const cfg = require('../lib/config');
const { sanitizeMessages, rateLimited, clientIp } = require('../lib/guard');
const { stream } = require('../lib/respond');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (rateLimited(clientIp(req), 'chat')) {
    return res.status(429).json({ error: 'Too many messages for now. Please try again in a few minutes.' });
  }
  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) return res.status(400).json({ error: 'Invalid messages' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const send = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const { deltas, sources } = await stream(messages);
    send({ type: 'sources', sources });
    for await (const d of deltas) send({ type: 'delta', text: d });
    send({ type: 'done' });
  } catch (err) {
    console.error('[chat]', err.message);
    send({ type: 'error', message: 'Something went wrong on my side. Please try again.' });
  }
  res.end();
};
