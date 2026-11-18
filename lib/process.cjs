const { spawn } = require('node:child_process');
function cleanEnvironment(source = process.env) {
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => !/(?:API_?KEY|TOKEN|PASSWORD|SECRET|CREDENTIAL|ELECTRON_RUN_AS_NODE|NODE_OPTIONS)/i.test(key)));
  delete env.CLAUDECODE;
  env.RON_ASSISTANT_CHILD = '1';
  return env;
}
function execute(command, args, { input = '', cwd, signal, timeout = 180000, env = cleanEnvironment(), maxBytes = 2000000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Stopped by you.'));
    let out = '', err = '', reason = '', settled = false;
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stop = message => {
      reason = message;
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => child.kill());
      } else child.kill();
    };
    const cancel = () => stop('Stopped by you.');
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => stop('This assistant reached the time limit. You can retry it.'), timeout);
    const finish = (error, value) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve(value);
    };
    child.on('error', () => finish(new Error('This assistant could not start. Check its connection and installation.')));
    child.stdout.on('data', data => { out += data; if (Buffer.byteLength(out) > maxBytes) stop('The response was too large. Try a narrower question.'); });
    child.stderr.on('data', data => { err = (err + data).slice(-12000); });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    child.on('close', code => {
      if (reason) return finish(new Error(reason));
      if (code !== 0) return finish(new Error(`The assistant exited without a completed answer (code ${code}). Check its sign-in, selected model, or quota.`));
      finish(null, { out, err });
    });
  });
}
module.exports = { cleanEnvironment, execute };
