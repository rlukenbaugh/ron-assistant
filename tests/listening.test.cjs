const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { Listening } = require('../lib/listening.cjs');
const { launcherPython } = require('../lib/hermes.cjs');
test('microphone is off by default, stops for responses and stays off after the user disables it', () => {
  const events = [], children = [];
  const listener = new Listening(value => events.push(value), (_command, args, options) => {
    assert.equal(options.shell, false); assert.ok(!args.includes('-ExecutionPolicy'));
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.killed = false;
    child.kill = () => { child.killed = true; child.emit('close', 0); };
    children.push(child); return child;
  });
  assert.equal(children.length, 0);
  listener.setEnabled(true); assert.equal(children.length, 1);
  listener.pause(false); listener.pause(false); listener.setEnabled(true);
  assert.equal(children.length, 1, 'startup synchronization must reuse the live worker');
  assert.equal(children[0].killed, false);
  children[0].stdout.write('{"state":"transcript","text":"What is seventeen times nineteen?"}\n');
  assert.equal(children[0].killed, true); assert.equal(listener.paused, true);
  assert.equal(events.at(-1).state, 'transcript');
  listener.pause(false); assert.equal(children.length, 2);
  listener.pause(false); assert.equal(children.length, 2, 'repeated resume must not restart recognition');
  listener.pause(true); assert.equal(children[1].killed, true);
  listener.setEnabled(false); listener.pause(false);
  assert.equal(children.length, 2); assert.equal(listener.enabled, false);
  listener.close();
});
test('Hermes connector requires a recognized absolute Python launcher and rejects arbitrary commands', () => {
  assert.throws(() => launcherPython(Buffer.from('#!cmd.exe -I\nPK')));
  assert.throws(() => launcherPython(Buffer.from('#!python.exe -I\nPK')));
  assert.throws(() => launcherPython(Buffer.from('unknown launcher')));
  if (process.platform === 'win32') assert.equal(launcherPython(Buffer.from('#!C:\\Hermes Runtime\\python.exe -I\nPK')), 'C:\\Hermes Runtime\\python.exe');
});
