// Visitor-triggered only. Sends Zia: (a) the visitor's own words, verbatim (deterministic),
// (b) an analysis that quotes those words and only uses skills present in the knowledge base (probabilistic).
const fs = require('fs');
const path = require('path');
const cfg = require('../lib/config');
const { sanitizeMessages, rateLimited, clientIp } = require('../lib/guard');
const { retrieve } = require('../lib/retrieve');
const { chatOnce } = require('../lib/llm');

const ANALYSIS_PROMPT = `You prepare a handoff note for Zia from a website visitor's own messages.
1. Quote, in the visitor's exact words, whatever they said about their work, business, or needs. If they said nothing about it, write "No business described."
2. For each quoted need, list which of Zia's skills/methods could apply, using the visitor's wording, and ONLY skills that appear in the excerpts. If none clearly apply, say so.
Do not invent needs or skills. Be brief.`;

async function deliver(text) {
  const url = cfg.handoffWebhook;
  if (url) {
    const feishu = /feishu|larksuite/.test(url);
    const body = feishu ? { msg_type: 'text', content: { text } } : { text };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`webhook ${r.status}`);
    return 'webhook';
  }
  // Local fallback. On Vercel the disk is read-only, so also log (visible in Vercel logs).
  console.log('[handoff]\n' + text);
  try {
    const f = path.join(cfg.ROOT, 'data/handoffs.jsonl');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), text }) + '\n');
  } catch {}
  return 'log';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (rateLimited(clientIp(req), 'handoff')) return res.status(429).json({ error: 'Too many requests. Please try again later.' });

  const messages = sanitizeMessages(req.body?.messages);
  const contact = String(req.body?.contact || '').trim().slice(0, 200);
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  if (!messages) return res.status(400).json({ error: 'No conversation to send' });
  if (!contact) return res.status(400).json({ error: 'Please leave a way to reach you' });

  const visitorWords = messages.filter(m => m.role === 'user').map(m => `- ${m.content}`).join('\n');

  let analysis = '(analysis unavailable)';
  try {
    const excerpts = await retrieve(visitorWords);
    const kb = excerpts.map(e => e.text).join('\n---\n') || '(none)';
    analysis = await chatOnce({
      messages: [
        { role: 'system', content: `${ANALYSIS_PROMPT}\n\nExcerpts about Zia:\n${kb}` },
        { role: 'user', content: `Visitor messages:\n${visitorWords}` },
      ],
      temperature: 0.2,
    });
  } catch (err) {
    console.error('[handoff analysis]', err.message);
  }

  const text = `New note for Zia\nContact: ${contact}\n${note ? `Note: ${note}\n` : ''}\nVisitor's words (verbatim):\n${visitorWords}\n\nAnalysis (AI-generated, check against the quotes):\n${analysis}`;
  try {
    await deliver(text);
    res.json({ ok: true });
  } catch (err) {
    console.error('[handoff deliver]', err.message);
    res.status(502).json({ error: 'Could not deliver your note. Please try again.' });
  }
};
