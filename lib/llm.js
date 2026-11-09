const OpenAI = require('openai');
const cfg = require('./config');

let client;
function getClient() {
  if (!cfg.apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  if (!client) {
    client = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL,
      timeout: 45000,
      defaultHeaders: { 'X-Title': 'Mini-Me' },
    });
  }
  return client;
}

// ---- offline fake (MINIME_FAKE=1): lets the pipeline be tested without a key ----
function fakeEmbed(text) {
  const v = new Array(256).fill(0);
  const s = text.toLowerCase().replace(/\s+/g, ' ');
  for (let i = 0; i < s.length - 1; i++) {
    const h = (s.codePointAt(i) * 31 + s.codePointAt(i + 1)) % 256;
    v[h] += 1;
  }
  return v;
}

async function embed(texts) {
  if (cfg.FAKE) return texts.map(fakeEmbed);
  const out = [];
  for (let i = 0; i < texts.length; i += 64) {
    const res = await getClient().embeddings.create({
      model: cfg.embedModel,
      input: texts.slice(i, i + 64),
    });
    out.push(...res.data.map(d => d.embedding));
  }
  return out;
}

// Returns an async iterable of text deltas.
async function* chatStream({ messages, model, temperature, maxTokens }) {
  if (cfg.FAKE) {
    const last = [...messages].reverse().find(m => m.role === 'user');
    yield `[fake reply] You said: ${last ? last.content.slice(0, 80) : ''}`;
    return;
  }
  const stream = await getClient().chat.completions.create({
    model: model || cfg.chatModel,
    temperature: temperature ?? cfg.temperature,
    max_tokens: maxTokens || cfg.maxTokens,
    stream: true,
    messages,
  });
  for await (const chunk of stream) {
    const d = chunk.choices?.[0]?.delta?.content;
    if (d) yield d;
  }
}

async function chatOnce(opts) {
  let text = '';
  for await (const d of chatStream(opts)) text += d;
  return text;
}

module.exports = { embed, chatStream, chatOnce };
