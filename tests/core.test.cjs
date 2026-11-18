const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Store, DEFAULTS, validateSettings } = require('../lib/store.cjs');
const { runQuestion, validateRequest } = require('../lib/engine.cjs');
const { cleanEnvironment, execute } = require('../lib/process.cjs');
const { parseAnswer } = require('../lib/providers.cjs');
test('saved instructions survive reopening and history is an independent opt-in', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ron-assistant-test-'));
  const first = new Store(dir);
  await first.saveSettings({ ...DEFAULTS, instructions: 'Call me Ron.', fontSize: 22 });
  await first.saveRun({ id: 'first', task: 'unsaved' });
  const reopened = new Store(dir);
  assert.equal((await reopened.settings()).instructions, 'Call me Ron.');
  assert.equal((await reopened.settings()).fontSize, 22);
  assert.deepEqual(await reopened.history(), []);
  await reopened.saveSettings({ ...await reopened.settings(), retainHistory: true });
  await reopened.saveRun({ id: 'second', task: 'saved', final: 'answer' });
  assert.equal((await new Store(dir).history())[0].final, 'answer');
  await reopened.saveSettings({ ...await reopened.settings(), retainHistory: false });
  await reopened.saveRun({ id: 'third', task: 'not saved' });
  assert.equal((await reopened.history()).length, 1);
});
test('corrupt saved settings are reported and preserved rather than overwritten', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ron-assistant-test-'));
  await fs.writeFile(path.join(dir, 'settings.json'), '{bad json');
  await assert.rejects(new Store(dir).settings(), /left intact/);
  assert.equal(await fs.readFile(path.join(dir, 'settings.json'), 'utf8'), '{bad json');
});
test('validation bounds requests, enabled models and preferences', () => {
  assert.throws(() => validateRequest({ task: ' ', ids: ['claude'] }));
  assert.throws(() => validateRequest({ task: 'ok', ids: ['other'] }));
  assert.equal(validateSettings({ fontSize: 99 }).fontSize, 26);
  assert.deepEqual(validateSettings({ enabled: ['claude', 'claude', 'unknown'] }).enabled, ['claude']);
  assert.equal(validateSettings({ models: { codex: 'model; bad-command' } }).models.codex, '');
});
test('each model answers independently before seeing peer responses', async () => {
  const calls = [];
  const state = await runQuestion({ task: 'What is 17 * 19?', ids: ['claude', 'codex'], mode: 'review' }, DEFAULTS, async (id, prompt) => { calls.push({ id, prompt }); return `${id}-answer-${calls.length}`; }, () => {}, new AbortController().signal);
  assert.equal(calls.length, 5);
  assert.ok(calls[0].prompt.includes('independently'));
  assert.ok(!calls[0].prompt.includes('codex-answer'));
  assert.ok(!calls[1].prompt.includes('claude-answer'));
  assert.ok(calls[2].prompt.includes('codex-answer-2'));
  assert.ok(calls[3].prompt.includes('claude-answer-1'));
  assert.equal(state.reviews.length, 2); assert.equal(state.finalProvider, 'codex'); assert.equal(state.state, 'done');
});
test('compare mode makes exactly one request per model and no synthesis', async () => {
  let count = 0;
  const state = await runQuestion({ task: 'Question', ids: ['claude', 'codex'], mode: 'compare' }, DEFAULTS, async () => { count++; return 'Answer'; }, () => {}, new AbortController().signal);
  assert.equal(count, 2); assert.equal(state.final, ''); assert.deepEqual(state.reviews, []);
});
test('provider failure keeps useful answers without claiming a joint review', async () => {
  const state = await runQuestion({ task: 'Question', ids: ['claude', 'codex'], mode: 'review' }, DEFAULTS, async id => { if (id === 'codex') throw new Error('Quota'); return 'Useful answer'; }, () => {}, new AbortController().signal);
  assert.equal(state.final, 'Useful answer'); assert.equal(state.finalProvider, 'claude'); assert.ok(state.warnings.some(w => w.includes('no peer review')));
  assert.equal(state.answers.find(a => a.id === 'codex').status, 'failed');
});
test('cancellation preserves finished results and never generates a final answer', async () => {
  const control = new AbortController();
  const state = await runQuestion({ task: 'Question', ids: ['claude', 'codex'], mode: 'review' }, DEFAULTS, async id => { if (id === 'codex') control.abort(); return 'Answer'; }, () => {}, control.signal);
  assert.equal(state.state, 'stopped'); assert.equal(state.final, '');
});
test('retry retains successful independent answers and repeats only the failed answer', async () => {
  const calls = [];
  const previous = { id: 'retry', answers: [{ id: 'claude', text: 'Already done', status: 'done' }, { id: 'codex', status: 'failed', error: 'Quota' }] };
  const state = await runQuestion({ task: 'Question', ids: ['claude', 'codex'], mode: 'compare' }, DEFAULTS, async id => { calls.push(id); return 'Retried'; }, () => {}, new AbortController().signal, previous);
  assert.deepEqual(calls, ['codex']); assert.equal(state.id, 'retry'); assert.equal(state.answers[0].text, 'Already done');
});
test('credentials and execution customizations are not inherited by reviewers', () => {
  assert.deepEqual(cleanEnvironment({ Path: 'path', API_KEY: 'secret', GEMINI_API_KEY: 'secret', NODE_OPTIONS: '--require attacker', CLAUDECODE: '1' }), { Path: 'path', RON_ASSISTANT_CHILD: '1' });
});
test('subprocess input is literal and cancellation ends only its process tree', async () => {
  const text = 'Quotes " & backticks ` $(not-a-command)';
  const echo = await execute(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { input: text });
  assert.equal(echo.out, text);
  const control = new AbortController();
  const result = execute(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: control.signal });
  setTimeout(() => control.abort(), 100);
  await assert.rejects(result, /Stopped by you/);
});
test('failed provider output never becomes a successful answer', () => {
  assert.throws(() => parseAnswer('claude', '{"is_error":true,"result":"error"}'));
  assert.throws(() => parseAnswer('codex', '{"type":"turn.failed"}'));
  assert.equal(parseAnswer('codex', '{"type":"item.completed","item":{"type":"agent_message","text":"Answer"}}\n{"type":"turn.completed"}'), 'Answer');
});
