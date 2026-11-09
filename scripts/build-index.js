// Chunks corpus/ and embeds it into index/index.json. Commit the result: Vercel serves it as a static file.
const fs = require('fs');
const path = require('path');
const cfg = require('../lib/config');
const { embed } = require('../lib/llm');
const { normalize } = require('../lib/retrieve');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(md|txt)$/i.test(e.name) && e.name !== 'README.md') out.push(full);
  }
  return out;
}

function chunk(text, max = 600) {
  text = text.replace(/^---\n[\s\S]*?\n---\n?/, ''); // frontmatter
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let cur = '';
  const flush = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ''; };
  for (const p of paras) {
    if (p.length > max) { // oversized paragraph: split on sentence-ish boundaries
      flush();
      for (let i = 0; i < p.length; i += max) chunks.push(p.slice(i, i + max));
      continue;
    }
    if ((cur + '\n\n' + p).length > max) flush();
    cur += (cur ? '\n\n' : '') + p;
  }
  flush();
  return chunks;
}

(async () => {
  const files = walk(cfg.corpusDir);
  if (!files.length) { console.error(`No .md/.txt files in ${cfg.corpusDir}. Run: npm run sync`); process.exit(1); }

  const items = [];
  for (const f of files) {
    const source = path.relative(cfg.corpusDir, f);
    const title = path.basename(f).replace(/\.(md|txt)$/i, '');
    for (const c of chunk(fs.readFileSync(f, 'utf-8'))) items.push({ source, text: `${title}\n${c}` });
  }
  console.log(`${files.length} files -> ${items.length} chunks. Embedding with ${cfg.embedModel}...`);

  const vectors = await embed(items.map(i => i.text));
  items.forEach((it, i) => { it.vector = normalize(vectors[i]).map(x => Math.round(x * 1e5) / 1e5); });

  fs.mkdirSync(path.dirname(cfg.indexFile), { recursive: true });
  fs.writeFileSync(cfg.indexFile, JSON.stringify({ embedModel: cfg.embedModel, built: new Date().toISOString(), items }));
  console.log(`Wrote ${cfg.indexFile}`);
})().catch(e => { console.error(e.message); process.exit(1); });
