const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execute } = require('./process.cjs');
const home = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'hermes');
function launcherPython(buffer) {
  // Match the installed distlib launcher's interpreter; never rely on PATH's Python.
  const line = buffer.toString('utf8').match(/#!([^\r\n]+) -I\r?\nPK/)?.[1]?.replace(/^"|"$/g, '');
  if (!line || !path.isAbsolute(line) || path.basename(line).toLowerCase() !== 'python.exe') throw new Error('Hermes runtime was not recognized. Open Hermes and check its installation.');
  return line;
}
async function request(value, options = {}) {
  const launcher = await fs.readFile(path.join(home, 'bin', 'hermes.exe'));
  const python = launcherPython(launcher);
  const script = path.join(__dirname, 'hermes-text.py').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  const result = await execute(python, ['-I', '-u', script, home], { ...options, input: JSON.stringify(value) });
  let data;
  try { data = JSON.parse(result.out); } catch { throw new Error('Hermes returned an unreadable response. Check its installation.'); }
  if (typeof data.ready !== 'boolean') throw new Error('Hermes returned an invalid response.');
  return data;
}
async function discover() {
  try { return await request({ action: 'probe' }, { timeout: 12000 }); }
  catch { return { ready: false, error: 'Hermes connector needs an installed Hermes runtime and a Nous sign-in.' }; }
}
async function ask(prompt, { model, cwd, signal, timeout } = {}) {
  const value = await request({ action: 'ask', prompt, model }, { cwd, signal, timeout });
  if (!value.ready || !value.answer?.trim()) throw new Error(value.error || 'Hermes returned no completed text answer.');
  return value.answer;
}
module.exports = { discover, ask, launcherPython };
