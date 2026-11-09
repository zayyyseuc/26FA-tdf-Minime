const fs = require('fs');
const cfg = require('../lib/config');

// Deterministic: the greeting, AI label and starter prompts are fixed text, not model output.
module.exports = (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(JSON.parse(fs.readFileSync(cfg.openingFile, 'utf-8')));
  } catch (err) {
    res.status(500).json({ error: 'config unavailable' });
  }
};
