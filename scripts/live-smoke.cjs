const fs = require('node:fs/promises');
const path = require('node:path');
const { discover, ask } = require('../lib/providers.cjs');
const { DEFAULTS } = require('../lib/store.cjs');
const { runQuestion } = require('../lib/engine.cjs');
async function main() {
  const catalog = await discover();
  console.log(catalog.map(({ id, ready, detail }) => ({ id, ready, detail })));
  const ids = ['claude', 'codex'].filter(id => catalog.some(p => p.id === id && p.ready));
  if (ids.length !== 2) throw new Error('Both Claude and Codex must be signed in for the live release check.');
  const cwd = path.resolve('work', 'live'); await fs.mkdir(cwd, { recursive: true });
  const control = new AbortController();
  let phase = '';
  const result = await runQuestion({ task: 'Explain why 23 times 7 equals 161. Keep the final answer to one sentence. Include no citations for this arithmetic test.', ids, mode: 'review' }, DEFAULTS, (id, prompt, signal) => ask(id, prompt, { model: DEFAULTS.models[id], cwd, signal, timeoutSeconds: 180, catalog }), run => { const p = run.phase || 'independent answers'; if (p !== phase) { phase = p; console.log(`Phase: ${phase}`); } }, control.signal);
  await fs.writeFile('work/live-result.json', JSON.stringify(result, null, 2));
  if (result.state !== 'done' || result.answers.some(a => a.status !== 'done') || result.reviews.some(r => r.status !== 'done') || !result.final.includes('161')) throw new Error('The live review did not complete correctly. Inspect work/live-result.json.');
  console.log(`Live comparison + reciprocal review + synthesis passed: ${result.final}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
