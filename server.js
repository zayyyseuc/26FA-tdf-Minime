// Local dev server. On Vercel, the files in api/ run as serverless functions instead.
const express = require('express');
const path = require('path');
const cfg = require('./lib/config');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/config', require('./api/config'));
app.post('/api/chat', require('./api/chat'));
app.post('/api/handoff', require('./api/handoff'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Mini-Me on http://localhost:${port}  model=${cfg.chatModel} card=${path.basename(cfg.cardFile)}${cfg.FAKE ? '  [FAKE MODE]' : ''}`);
});
