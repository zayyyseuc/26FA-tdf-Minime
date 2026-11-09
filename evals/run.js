// Fixed prompt set, run N times, results saved so card/model changes can be compared.
//   node evals/run.js --label v1-sonnet --runs 3
//   CARD_FILE=system-card/v2.md CHAT_MODEL=... node evals/run.js --label v2-x
// Automatic checks (mustMatch / mustNotMatch) are only a floor. Judge the `expect` column by reading.
const fs = require('fs');
const path = require('path');
const cfg = require('../lib/config');
const { respond } = require('../lib/respond');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const runs = Number(arg('runs', 3));
const label = arg('label', 'run');
const only = arg('only', '');

const toRe = s => { const m = s.match(/^\(\?i\)(.*)$/s); return m ? new RegExp(m[1], 'i') : new RegExp(s); };

(async () => {
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf-8'))
    .filter(c => !only || c.id.includes(only));
  const results = [];
  for (const c of cases) {
    for (let r = 1; r <= runs; r++) {
      const msgs = [];
      let last;
      for (const turn of c.turns) {
        msgs.push({ role: 'user', content: turn });
        last = await respond(msgs);
        msgs.push({ role: 'assistant', content: last.text });
      }
      const failed = [];
      (c.mustMatch || []).forEach(p => { if (!toRe(p).test(last.text)) failed.push('missing: ' + p); });
      (c.mustNotMatch || []).forEach(p => { if (toRe(p).test(last.text)) failed.push('forbidden: ' + p); });
      results.push({ id: c.id, category: c.category, run: r, output: last.text, sources: last.sources, autoPass: failed.length === 0, failed, expect: c.expect });
      process.stdout.write(failed.length ? 'F' : '.');
    }
  }
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const meta = { label, at: new Date().toISOString(), model: cfg.chatModel, temperature: cfg.temperature, card: path.basename(cfg.cardFile), embedModel: cfg.embedModel, topK: cfg.topK, runs };
  const base = path.join(__dirname, 'results', `${stamp}-${label}`);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  fs.writeFileSync(base + '.json', JSON.stringify({ meta, results }, null, 2));

  const pass = results.filter(r => r.autoPass).length;
  let md = `# Eval ${label}\n\n${JSON.stringify(meta)}\n\nAuto-check pass: ${pass}/${results.length}\n\n`;
  for (const r of results) {
    md += `## ${r.id} (run ${r.run}) ${r.autoPass ? '' : '**AUTO-FAIL** ' + r.failed.join('; ')}\n- expect: ${r.expect}\n- sources: ${r.sources.join(', ') || '(none)'}\n- my rating (1-5 / notes): \n\n> ${r.output.replace(/\n/g, '\n> ')}\n\n`;
  }
  fs.writeFileSync(base + '.md', md);
  console.log(`\nAuto-check pass ${pass}/${results.length}. Saved ${base}.md`);
})().catch(e => { console.error('\n' + e.message); process.exit(1); });
