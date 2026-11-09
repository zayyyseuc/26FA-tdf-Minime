// Deterministic guards: input shaping and rate limiting. None of this depends on the model behaving.
const cfg = require('./config');

// Accepts only {role: user|assistant, content: string}. Clients cannot inject a "system" message.
function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, cfg.maxMessageChars) }))
    .slice(-cfg.maxHistoryTurns);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  const last = msgs[msgs.length - 1];
  last.content = last.content.slice(0, cfg.maxQuestionChars).trim();
  if (!last.content) return null;
  return msgs;
}

// In-memory sliding window. On serverless this is per-instance (best effort); add Vercel/Upstash limits for real protection.
const hits = new Map();
function rateLimited(ip, bucket) {
  const { windowMs } = cfg.rateLimit;
  const max = cfg.rateLimit[bucket];
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

function clientIp(req) {
  const xf = req.headers?.['x-forwarded-for'];
  return (typeof xf === 'string' ? xf.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
}

module.exports = { sanitizeMessages, rateLimited, clientIp };
