// Deterministic retrieval over a prebuilt JSON index (works on Vercel: no writable disk, no server process).
const fs = require('fs');
const cfg = require('./config');
const { embed } = require('./llm');

let cache;
function loadIndex() {
  if (!cache) {
    if (!fs.existsSync(cfg.indexFile)) {
      throw new Error(`Index not found at ${cfg.indexFile}. Run: npm run sync && npm run index`);
    }
    cache = JSON.parse(fs.readFileSync(cfg.indexFile, 'utf-8'));
    if (cache.embedModel !== cfg.embedModel) {
      throw new Error(`Index was built with "${cache.embedModel}" but EMBED_MODEL is "${cfg.embedModel}". Rebuild the index.`);
    }
  }
  return cache;
}

function normalize(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map(x => x / n);
}

async function retrieve(query, k = cfg.topK) {
  const idx = loadIndex();
  const [qv] = await embed([query]);
  const q = normalize(qv);
  const scored = idx.items.map(it => {
    let dot = 0;
    for (let i = 0; i < q.length; i++) dot += q[i] * it.vector[i];
    return { source: it.source, text: it.text, score: dot };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score >= cfg.minScore).slice(0, k);
}

module.exports = { retrieve, normalize };
