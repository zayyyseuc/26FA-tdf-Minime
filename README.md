# Mini-Me

A website agent that talks to visitors in Zia's voice, from her own writing and projects. TDF DesComp Project 1.
Behavior is specified in `system-card/` (versioned), not in code.

## Run
```bash
npm install
cp .env.example .env        # add OPENROUTER_API_KEY
npm run sync                # copy publishable notes from the Mini-Me vault -> corpus/ (scrubs emails/phones)
npm run index               # embed corpus -> index/index.json (commit this; Vercel serves it)
npm start                   # http://localhost:3000
```
Offline test without a key: `MINIME_FAKE=1 npm start` (the model just echoes).

## Where behavior comes from
| Thing | Where | Deterministic? |
|---|---|---|
| What Mini-Me may know | `corpus/` (only what you put in the Mini-Me vault) | yes |
| Retrieval | `lib/retrieve.js` | yes |
| Greeting, AI label, starter prompts | `site/opening.json` | yes |
| Input caps, rate limits, no client-supplied system role | `lib/guard.js` | yes |
| Visitor's words in handoff | `api/handoff.js` (verbatim) | yes |
| Tone, restating, gap pattern, skills mapping | system card + model | no |

Change model / temperature / card via `.env` (see `.env.example`), then re-run evals.

## Evals
```bash
npm run eval -- --label v1-baseline --runs 3
CARD_FILE=system-card/v2.md npm run eval -- --label v2
```
Results land in `evals/results/` (json + md with a rating column). Auto-checks are a floor; read the outputs.

## Deploy (Vercel)
Commit `index/index.json`, set `OPENROUTER_API_KEY` (and optionally `HANDOFF_WEBHOOK_URL`) in Vercel env. `api/*.js` are the functions, `public/` is static.
The in-memory rate limit is per instance; add a real limiter before sharing widely.

## Privacy
Everything in `corpus/` and `index/` is public once the repo or site is. Regex scrubbing only catches emails/phones; review the corpus yourself.
