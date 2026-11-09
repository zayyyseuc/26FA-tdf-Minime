// Copies publishable notes from the Mini-Me Obsidian vault into corpus/, scrubbing obvious PII.
// Usage: npm run sync            (source = CORPUS_SOURCE or /Users/chen/Mini-Me)
//        node scripts/sync-corpus.js /path/to/vault
// Skipped: dot-folders (.obsidian), anything starting with "_", files with `private: true` in frontmatter.
const fs = require('fs');
const path = require('path');
const cfg = require('../lib/config');

const SRC = path.resolve(process.argv[2] || process.env.CORPUS_SOURCE || '/Users/chen/Mini-Me');
const DEST = cfg.corpusDir;

const PII = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email removed]'],
  [/\+\d{1,3}[\s-]?\d[\d\s-]{7,}\d/g, '[phone removed]'],
  [/\b1[3-9]\d{9}\b/g, '[phone removed]'],
  [/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, '[phone removed]'],
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(md|txt)$/i.test(e.name)) out.push(full);
  }
  return out;
}

if (!fs.existsSync(SRC)) { console.error(`Source not found: ${SRC}`); process.exit(1); }
fs.mkdirSync(DEST, { recursive: true });
for (const f of walk(DEST)) if (path.basename(f) !== 'README.md') fs.unlinkSync(f); // no stale copies

let copied = 0, skipped = 0, redactions = 0;
for (const file of walk(SRC)) {
  let text = fs.readFileSync(file, 'utf-8');
  if (/^---\n[\s\S]*?\bprivate:\s*true\b[\s\S]*?\n---/.test(text)) { skipped++; console.log(`skip (private): ${path.relative(SRC, file)}`); continue; }
  for (const [re, label] of PII) text = text.replace(re, () => { redactions++; return label; });
  const rel = path.relative(SRC, file);
  const out = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  copied++;
}
console.log(`\nSynced ${copied} files from ${SRC} -> ${DEST} (${skipped} private skipped, ${redactions} PII redactions).`);
console.log('Regex scrubbing catches emails/phones only. Addresses and names are NOT detected: review corpus/ yourself before publishing.');
