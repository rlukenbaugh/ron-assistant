const { spawn } = require('node:child_process');
const path = require('node:path');
const { cleanEnvironment, execute } = require('./process.cjs');
const powershell = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const script = path.join(__dirname, 'listen.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
function argumentsFor(probe = false) {
  return ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script, ...(probe ? ['-Probe'] : [])];
}
class Listening {
  constructor(notify, launch = spawn) { this.notify = notify; this.launch = launch; this.child = null; this.enabled = false; this.paused = false; }
  async available() {
    try {
      const result = await execute(powershell, argumentsFor(true), { timeout: 10000 });
      return JSON.parse(result.out.trim()).state === 'available';
    } catch { return false; }
  }
  stopChild() { const child = this.child; this.child = null; child?.kill(); }
  setEnabled(value) {
    if (this.enabled === value) return;
    this.enabled = value; this.stopChild();
    if (value && !this.paused) this.startChild();
    else this.notify({ state: value ? 'paused' : 'off', text: value ? 'Listening paused.' : 'Microphone off.' });
  }
  pause(value) {
    this.paused = value;
    if (!this.enabled) return;
    if (value) { this.stopChild(); this.notify({ state: 'paused', text: 'Listening paused while answering or speaking.' }); }
    else this.startChild();
  }
  startChild() {
    if (this.child || !this.enabled || this.paused) return;
    this.notify({ state: 'starting', text: 'Starting local speech recognition…' });
    const child = this.launch(powershell, argumentsFor(), { windowsHide: true, shell: false, env: cleanEnvironment(), stdio: ['ignore', 'pipe', 'ignore'] });
    this.child = child;
    let buffer = '', terminal = false;
    const fail = () => {
      if (this.child !== child || terminal) return;
      terminal = true; this.enabled = false; this.stopChild();
      this.notify({ state: 'error', text: 'Listening stopped. Check your Windows speech and microphone settings, then turn it on again.' });
    };
    child.on('error', fail);
    child.on('close', fail);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', data => {
      if (this.child !== child) return;
      buffer += data;
      if (buffer.length > 40000) return fail();
      const lines = buffer.split(/\r?\n/); buffer = lines.pop();
      for (const line of lines) {
        let value; try { value = JSON.parse(line); } catch { continue; }
        if (!['wake', 'question', 'missed', 'transcript', 'error'].includes(value.state) || typeof value.text !== 'string') continue;
        if (value.state === 'transcript') { terminal = true; this.paused = true; this.stopChild(); }
        if (value.state === 'error') { terminal = true; this.enabled = false; this.stopChild(); }
        this.notify({ state: value.state, text: value.text.slice(0, 20000) });
      }
    });
  }
  close() { this.enabled = false; this.stopChild(); }
}
module.exports = { Listening, argumentsFor };
