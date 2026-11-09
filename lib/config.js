// All tunable behavior lives here (or in env). Nothing else hard-codes a model, temperature or path.
require('dotenv').config({ quiet: true });
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FAKE = process.env.MINIME_FAKE === '1'; // offline test mode: no API calls

module.exports = {
  ROOT,
  FAKE,
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',

  // Model selection is a design decision: change via env, record in evals/results.
  chatModel: process.env.CHAT_MODEL || 'anthropic/claude-sonnet-4.5',
  embedModel: FAKE ? 'fake' : (process.env.EMBED_MODEL || 'openai/text-embedding-3-small'),
  temperature: Number(process.env.TEMPERATURE ?? 0.5),
  maxTokens: Number(process.env.MAX_TOKENS ?? 700),

  // Retrieval
  topK: Number(process.env.TOP_K ?? 5),
  minScore: Number(process.env.MIN_SCORE ?? 0.25),

  // Which system card is live. Switch v1 -> v2 here, then re-run evals.
  cardFile: path.resolve(ROOT, process.env.CARD_FILE || 'system-card/v1.md'),

  // Paths
  corpusDir: path.resolve(ROOT, process.env.CORPUS_DIR || 'corpus'),
  indexFile: path.resolve(ROOT, process.env.INDEX_FILE || 'index/index.json'),
  openingFile: path.resolve(ROOT, 'site/opening.json'),

  // Guards (deterministic)
  maxQuestionChars: 1500,
  maxHistoryTurns: 12,
  maxMessageChars: 2000,
  rateLimit: { windowMs: 10 * 60 * 1000, chat: 30, handoff: 3 },

  handoffWebhook: process.env.HANDOFF_WEBHOOK_URL || '',
};
