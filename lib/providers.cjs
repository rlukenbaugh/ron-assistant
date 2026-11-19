const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execute } = require('./process.cjs');
const hermes = require('./hermes.cjs');
const home = os.homedir();
const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function jarvisEnv() {
  try {
    const text = await fs.readFile(path.join(local, 'JarvisServer', 'data', '.env'), 'utf8');
    return Object.fromEntries(text.split(/\r?\n/).map(line => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]));
  } catch { return {}; }
}
async function locations() {
  const base = path.join(roaming, 'npm', 'node_modules', '@openai', 'codex');
  const candidates = [path.join(base, 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'), path.join(base, 'vendor', 'x86_64-pc-windows-msvc', 'codex', 'codex.exe')];
  let codex = '';
  for (const candidate of candidates) if (await exists(candidate)) { codex = candidate; break; }
  return { claude: path.join(home, '.local', 'bin', 'claude.exe'), codex, hermes: path.join(local, 'hermes', 'bin', 'hermes.exe'), agy: path.join(local, 'agy', 'bin', 'agy.exe') };
}
function parseAnswer(id, out) {
  if (id === 'claude') {
    const value = JSON.parse(out);
    if (value.is_error || !value.result?.trim()) throw new Error('Claude returned an error. Check your Claude Code sign-in and quota.');
    return value.result.trim();
  }
  if (id === 'codex') {
    const events = out.split(/\r?\n/).filter(x => x.trim()).map(x => JSON.parse(x));
    if (events.some(x => x.type === 'turn.failed' || x.type === 'error')) throw new Error('Codex did not finish. Check your ChatGPT sign-in, model, and quota.');
    const answers = events.filter(x => x.type === 'item.completed' && x.item?.type === 'agent_message').map(x => x.item.text);
    if (!answers.length || !events.some(x => x.type === 'turn.completed')) throw new Error('Codex returned no completed answer.');
    return answers.at(-1).trim();
  }
  // Remove ANSI terminal formatting before displaying a provider's plain-text result.
  // eslint-disable-next-line no-control-regex
  const answer = out.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/^session_id:.*$/gm, '').trim();
  if (!answer) throw new Error('The assistant returned no text answer.');
  return answer;
}
async function discover() {
  const bins = await locations();
  const [env, claudeInstalled, codexInstalled, claudeAuth, codexAuth] = await Promise.all([
    jarvisEnv(), exists(bins.claude), Promise.resolve(Boolean(bins.codex)),
    execute(bins.claude, ['auth', 'status'], { timeout: 10000 }).then(x => JSON.parse(x.out).loggedIn === true).catch(() => false),
    bins.codex ? execute(bins.codex, ['login', 'status'], { timeout: 10000 }).then(x => /logged in/i.test(x.out + x.err)).catch(() => false) : false
  ]);
  let geminiModels = [], geminiDetail = 'Needs your existing Gemini key in Jarvis.', ollamaModels = [], ollamaDetail = 'Start Ollama and install a model to connect.';
  if (env.GEMINI_API_KEY) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('key');
      const data = await response.json();
      geminiModels = (data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent') && /\/((gemini-(?:\d|flash|pro|omni))|gemma-)/.test(m.name) && !/image|tts|audio|robotics|computer-use|transcribe|customtools/i.test(m.name)).map(m => m.name.replace(/^models\//, ''));
      geminiDetail = geminiModels.length ? 'Existing Gemini key from Jarvis · API quota applies.' : 'No compatible text models found for this key.';
    } catch { geminiDetail = 'Could not verify your existing Gemini key. Check its quota or connection.'; }
  }
  try {
    const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2500) });
    if (r.ok) { const data = await r.json(); ollamaModels = (data.models || []).map(m => m.name); if (ollamaModels.length) ollamaDetail = 'Local Ollama models · stays on this computer.'; }
  } catch { /* Optional local service. */ }
  const hermesInstalled = await exists(bins.hermes);
  let hermesModel = '', hermesProvider = '';
  try {
    const text = await fs.readFile(path.join(local, 'hermes', 'config.yaml'), 'utf8');
    const start = text.search(/^model:[ \t]*\r?$/m);
    const block = start < 0 ? '' : text.slice(start + 6).split(/\n(?=[A-Za-z][\w-]*:)/)[0];
    hermesModel = block.match(/^[ \t]+default:[ \t]*['"]?([^'"\r\n#]+)/m)?.[1]?.trim() || '';
    hermesProvider = block.match(/^[ \t]+provider:[ \t]*['"]?([^'"\r\n#]+)/m)?.[1]?.trim() || '';
  } catch { /* Optional configuration. */ }
  const hermesConnection = hermesInstalled ? await hermes.discover() : { ready: false, error: 'Hermes is not installed.' };
  return [
    { id: 'claude', name: 'Claude', tag: 'Anthropic', ready: claudeInstalled && claudeAuth, detail: claudeAuth ? 'Claude Code · existing subscription sign-in.' : claudeInstalled ? 'Installed. Sign in with Claude Code first.' : 'Claude Code is not installed.', models: ['sonnet', 'opus', 'haiku'] },
    { id: 'codex', name: 'Codex', tag: 'OpenAI', ready: codexInstalled && codexAuth, detail: codexAuth ? 'Codex CLI · existing ChatGPT sign-in.' : codexInstalled ? 'Installed. Sign in with Codex first.' : 'Codex CLI is not installed.', models: [] },
    { id: 'gemini', name: 'Gemini', tag: 'Google', ready: geminiModels.length > 0, detail: geminiDetail, models: geminiModels },
    { id: 'hermes', name: 'Hermes', tag: 'Nous · text only', ready: hermesConnection.ready, detail: hermesConnection.ready ? `Hermes saved Nous sign-in · ${hermesConnection.model || hermesModel}. Text answers only; Hermes tools and private memories are not loaded.` : hermesConnection.error || `Check ${hermesProvider || 'your provider'} sign-in in Hermes.`, models: hermesModel ? [hermesModel] : [] },
    { id: 'ollama', name: 'Local model', tag: 'Ollama', ready: ollamaModels.length > 0, detail: ollamaDetail, models: ollamaModels }
  ];
}
async function ask(id, prompt, { model = '', cwd, signal, timeoutSeconds = 180, catalog = [] } = {}) {
  const timeout = timeoutSeconds * 1000;
  if (id === 'hermes') return hermes.ask(prompt, { model, cwd, signal, timeout });
  if (id === 'gemini') {
    const env = await jarvisEnv();
    const models = catalog.find(p => p.id === id)?.models || [];
    model ||= models.find(m => m === 'gemini-flash-latest') || models.find(m => /flash/.test(m) && !/preview|experimental/.test(m)) || models[0];
    if (!env.GEMINI_API_KEY || !model) throw new Error('No verified Gemini key/model is available. Refresh Connections.');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4096 } }), signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(timeout)]) });
    if (!response.ok) throw new Error(`Gemini could not answer (HTTP ${response.status}). Check key access and quota.`);
    const value = await response.json();
    const text = value.candidates?.[0]?.content?.parts?.filter(x => !x.thought).map(x => x.text || '').join('').trim();
    if (!text) throw new Error('Gemini returned no text answer.');
    return text;
  }
  if (id === 'ollama') {
    model ||= catalog.find(p => p.id === id)?.models[0];
    if (!model) throw new Error('Choose an installed local model first.');
    const response = await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, prompt, stream: false, options: { num_predict: 2048 } }), signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(timeout)]) });
    if (!response.ok) throw new Error(`The local model could not answer (HTTP ${response.status}).`);
    const value = await response.json(); if (!value.response?.trim()) throw new Error('The local model returned no answer.'); return value.response.trim();
  }
  const bins = await locations();
  let args, command = bins[id];
  if (id === 'claude') args = ['-p', '--output-format', 'json', '--safe-mode', '--restricted', '--tools', '', '--strict-mcp-config', '--no-session-persistence', ...(model ? ['--model', model] : [])];
  else if (id === 'codex') args = ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '-c', 'approval_policy="never"', '-c', 'features.shell_tool=false', '-c', 'features.view_image=false', '-c', 'features.remote_plugin=false', '-c', 'agents.enabled=false', '-c', 'web_search="disabled"', '--json', ...(model ? ['--model', model] : []), '-'];
  else throw new Error('This assistant does not have an available text-only adapter.');
  if (!command || !await exists(command)) throw new Error('This assistant is not installed. Refresh Connections.');
  const result = await execute(command, args, { input: prompt, cwd, signal, timeout });
  return parseAnswer(id, result.out);
}
module.exports = { discover, ask, locations, parseAnswer, jarvisEnv };
