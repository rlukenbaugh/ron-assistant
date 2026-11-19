import { marked } from 'marked';
import DOMPurify from 'dompurify';

const api = window.ron;
const $ = selector => document.querySelector(selector);
const names = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini', hermes: 'Hermes', ollama: 'Local model' };
let settings, catalog = [], run = null, busy = false, toastTimer, spokenRun = '';
let peer = null, audioContext = null, silentTrack = null, oscillator = null, avatarGeneration = 0, avatarLive = false, speechGeneration = 0;
let listeningEnabled = false, speaking = false, avatarSpeaking = false;
async function syncListening() {
  if (listeningEnabled) await api.listeningPause(busy || speaking || avatarSpeaking).catch(error => toast(error.message));
}
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function markdown(text) {
  return DOMPurify.sanitize(marked.parse(text || '', { gfm: true, breaks: false }), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'],
    ALLOWED_ATTR: ['href', 'title', 'start'], ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^https?:\/\//i
  });
}
function plain(text) { const div = document.createElement('div'); div.innerHTML = markdown(text); return div.innerText || div.textContent || ''; }
function toast(text) { clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }
function status(text) { $('#status-line').textContent = text; }
function showView(view) {
  for (const id of ['conversation', 'connections', 'settings']) $(`#${id}-view`).hidden = id !== view;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  $('#view-title').textContent = { conversation: 'Conversation', connections: 'Connections', settings: 'Memory & settings' }[view];
  if (view === 'settings') fillSettings();
}
function applyAppearance() { document.body.classList.toggle('light', settings.theme === 'light'); document.documentElement.style.setProperty('--answer-size', `${settings.fontSize}px`); }
function renderModes() {
  document.querySelectorAll('[data-mode]').forEach(el => { el.classList.toggle('selected', settings.mode === el.dataset.mode); el.setAttribute('aria-pressed', String(settings.mode === el.dataset.mode)); });
  $('#mode-description').textContent = settings.mode === 'review' ? 'Independent answers, peer reviews, one final answer.' : 'Independent answers, side by side. You choose what is useful.';
}
function renderConnections() {
  const ready = catalog.filter(p => p.ready);
  $('#connection-count').textContent = ready.length;
  $('#connection-summary').textContent = `${ready.length} assistant${ready.length === 1 ? '' : 's'} connected · no new accounts required`;
  $('#provider-chips').innerHTML = catalog.filter(p => p.ready).map(p => `<label class="provider-chip ${settings.enabled.includes(p.id) ? 'enabled' : ''}"><input type="checkbox" data-enable="${p.id}" ${settings.enabled.includes(p.id) ? 'checked' : ''} ${busy ? 'disabled' : ''}><span>${esc(p.name)}</span><span class="provider-dot"></span></label>`).join('') || '<span class="muted">No assistants connected. Open Connections to check your setup.</span>';
  $('#connection-cards').innerHTML = catalog.map(p => `<article class="connection-card"><header><div class="assistant-mark">${esc(p.name[0])}</div><div><h3>${esc(p.name)}</h3><small>${esc(p.tag)}</small></div><span class="status-badge ${p.ready ? 'done' : ''}">${p.ready ? 'Connected' : 'Unavailable'}</span></header><p>${esc(p.detail)}</p><label class="check-setting"><input type="checkbox" data-enable="${p.id}" ${settings.enabled.includes(p.id) ? 'checked' : ''} ${!p.ready || busy ? 'disabled' : ''}><span>Include in my questions</span></label><label for="model-${p.id}">Model</label>${p.models?.length ? `<select id="model-${p.id}" data-model="${p.id}" ${busy ? 'disabled' : ''}><option value="">${p.id === 'claude' ? 'Account default' : 'Automatic / configured default'}</option>${[...new Set([...p.models, ...(settings.models[p.id] ? [settings.models[p.id]] : [])])].map(m => `<option value="${esc(m)}" ${settings.models[p.id] === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>` : `<input type="text" id="model-${p.id}" data-model="${p.id}" value="${esc(settings.models[p.id])}" placeholder="Account default" maxlength="160" ${!p.ready || busy ? 'disabled' : ''}>`}</article>`).join('');
  $('#ask').disabled = busy || !ready.some(p => settings.enabled.includes(p.id));
  $('#sharing-note').textContent = settings.retainHistory ? 'History is saved locally.' : 'History saving is off.';
  $('#final-provider').innerHTML = catalog.map(p => `<option value="${p.id}">${esc(p.name)}${!p.ready ? ' (when available)' : ''}</option>`).join('');
  $('#final-provider').value = settings.finalProvider;
}
async function checkConnections() {
  $('#refresh').disabled = true; $('#connection-summary').textContent = 'Checking your installed assistants and sign-ins…';
  try { catalog = await api.connections(); renderConnections(); }
  catch (error) { toast(error.message); $('#connection-summary').textContent = 'Connection check failed. Try again.'; }
  finally { $('#refresh').disabled = false; }
}
function setBusy(value) {
  busy = value; $('#stop').hidden = !value; $('#ask').hidden = value;
  document.querySelectorAll('[data-mode]').forEach(el => { el.disabled = value; });
  $('#new').disabled = value; $('#refresh').disabled = value; renderConnections();
  if (value) syncListening();
}
function copyButtons(type, id = '') { return `<button class="copy-button" data-copy="${type}" data-id="${id}" data-format="plain" title="Copy as plain text">Copy</button><button class="copy-button" data-copy="${type}" data-id="${id}" data-format="markdown" title="Copy Markdown source">Markdown</button>`; }
function bodyFor(answer) {
  if (answer.status === 'done') return `<div class="answer-body">${markdown(answer.text)}</div>`;
  if (answer.status === 'failed' || answer.status === 'stopped') return `<div class="waiting">${esc(answer.error || 'Stopped by you.')}<div><button class="secondary-button" data-retry="${answer.id}" ${busy ? 'disabled' : ''}>↻ Retry ${esc(names[answer.id])}</button></div></div>`;
  return '<div class="waiting"><span class="thinking-dot"></span>Thinking through your question…</div>';
}
function renderRun() {
  if (!run) { $('#results').hidden = true; $('#empty-state').hidden = false; return; }
  $('#results').hidden = false; $('#empty-state').hidden = true;
  const reviewWasOpen = $('#review-details')?.open || false;
  const stateLabels = { running: 'In progress', done: 'Complete', partial: 'Partly complete', stopped: 'Stopped', failed: 'Needs attention' };
  let final = '';
  if (run.mode === 'review' && (run.final || ['review', 'final'].includes(run.phase))) {
    final = `<section class="final-card"><header class="card-header"><div class="card-title"><span class="star">✧</span><div><h3>Final answer</h3><small>${run.final ? `Written by ${esc(names[run.finalProvider])} · ${run.reviews.filter(r => r.status === 'done').length ? 'following the review exchange' : 'single-assistant answer'}` : run.phase === 'final' ? `Bringing the perspectives together with ${esc(names[run.finalProvider])}` : 'Your assistants are reviewing one another’s answers'}</small></div></div>${run.final ? `<div class="card-actions">${copyButtons('final')}<button class="copy-button" data-speak="final" title="Read the final answer using the selected voice">▶ Read</button></div>` : ''}</header>${run.final ? `<div id="final-answer" class="answer-body">${markdown(run.final)}</div>` : '<div class="waiting"><span class="thinking-dot"></span>The final answer will appear here.</div>'}</section>`;
  }
  $('#results').innerHTML = `<header class="question-heading"><span class="eyebrow">YOUR QUESTION</span><h2>${esc(run.task)}</h2><div class="run-meta"><span>${run.mode === 'review' ? 'Review together' : 'Compare answers'}</span><span>${run.ids.map(id => esc(names[id])).join(' · ')}</span><span>${stateLabels[run.state] || ''}</span></div></header>${run.warnings.map(w => `<div class="warning">${esc(w)}</div>`).join('')}${final}<div class="section-heading"><h3>Individual perspectives</h3><span>Each assistant answered independently</span></div><div class="answer-grid">${run.answers.map(a => `<section class="answer-card" data-answer="${a.id}"><header class="card-header"><div class="card-title"><div class="assistant-mark">${esc(names[a.id][0])}</div><div><h3>${esc(names[a.id])}</h3><small>${a.status === 'done' ? 'Independent answer' : 'Response status'}</small></div></div><span class="status-badge ${a.status}">${esc({ thinking: 'Thinking', waiting: 'Waiting', done: 'Answered', failed: 'Unavailable', stopped: 'Stopped' }[a.status] || a.status)}</span></header>${bodyFor(a)}${a.status === 'done' ? `<div class="card-actions answer-copy-actions">${copyButtons('answer', a.id)}</div>` : ''}</section>`).join('')}</div>${run.reviews.length ? `<details id="review-details" class="review-details" ${reviewWasOpen ? 'open' : ''}><summary>Review discussion · ${run.reviews.filter(r => r.status === 'done').length} of ${run.reviews.length} reviews complete</summary><div class="review-inner">${run.reviews.map(r => `<section class="review-item"><h4>${esc(names[r.id])} reviews the other responses</h4>${r.status === 'done' ? `<div class="answer-body">${markdown(r.text)}</div>${copyButtons('review', r.id)}` : `<p class="field-note">${esc(r.error || 'Reading the other perspectives…')}</p>`}</section>`).join('')}</div></details>` : ''}<footer class="run-footer"><button class="secondary-button" id="copy-discussion">Copy discussion</button><button class="secondary-button" id="copy-discussion-markdown">Copy discussion as Markdown</button><button class="secondary-button" id="regenerate" ${busy ? 'disabled' : ''}>↻ Regenerate</button></footer>`;
  const phase = run.state === 'running' ? run.phase === 'final' ? 'Writing the final answer…' : run.phase === 'review' ? 'Reviewing the independent answers…' : 'Your assistants are answering independently…' : run.state === 'done' ? 'Your answers are ready.' : stateLabels[run.state] + '. Your completed responses are still available.';
  status(phase);
}
async function submit(task = $('#question').value) {
  if (busy) return;
  const ids = settings.enabled.filter(id => catalog.some(p => p.id === id && p.ready));
  if (!task.trim()) { $('#question').focus(); return; }
  if (!ids.length) return toast('Wait for the connection check, then choose a connected assistant.');
  stopWindows(); showView('conversation');
  try { setBusy(true); await api.start({ task, ids, mode: settings.mode }); $('#question').value = ''; }
  catch (error) { setBusy(false); toast(error.message); }
}
async function history() {
  const items = await api.history();
  $('#history').innerHTML = items.length ? items.map(r => `<button data-history="${esc(r.id)}" title="${esc(r.task)}">${esc(r.task.slice(0, 75))}</button>`).join('') : `<p>${settings.retainHistory ? 'Your saved conversations will appear here.' : 'History is off.<br>Your questions stay in this session.'}</p>`;
}
function fillSettings() {
  $('#instructions').value = settings.instructions; $('#theme').value = settings.theme; $('#font-size').value = settings.fontSize; $('#font-size-label').textContent = `${settings.fontSize} px`;
  $('#final-provider').value = settings.finalProvider; $('#retain-history').checked = settings.retainHistory; $('#auto-speak').checked = settings.autoSpeak; $('#speech-target').value = settings.speechTarget; $('#timeout').value = settings.timeoutSeconds;
}
function discussion() {
  return `# ${run.task}\n\n${run.final ? `## Final answer (${names[run.finalProvider]})\n\n${run.final}\n\n` : ''}${run.answers.map(a => `## ${names[a.id]} — independent answer\n\n${a.text || a.error || a.status}`).join('\n\n')}${run.reviews.length ? '\n\n# Review discussion\n\n' + run.reviews.map(r => `## ${names[r.id]}\n\n${r.text || r.error || r.status}`).join('\n\n') : ''}${run.warnings.length ? '\n\n## Limitations\n\n' + run.warnings.join('\n\n') : ''}`;
}
function stopWindows() { speechGeneration++; window.speechSynthesis.cancel(); speaking = false; }
async function windowsSpeak(text) {
  stopWindows(); speaking = true; const generation = speechGeneration; await syncListening();
  if (generation !== speechGeneration) return;
  const value = plain(text).slice(0, 16000), chunks = [];
  for (let i = 0; i < value.length; i += 240) chunks.push(value.slice(i, i + 240));
  const voice = speechSynthesis.getVoices().find(v => v.voiceURI === $('#windows-voice').value);
  function next() {
    if (generation !== speechGeneration) return;
    if (!chunks.length) { speaking = false; syncListening(); return; }
    const utterance = new SpeechSynthesisUtterance(chunks.shift());
    if (voice) utterance.voice = voice;
    utterance.rate = 1; utterance.onend = next; utterance.onerror = () => { if (generation !== speechGeneration) return; speaking = false; syncListening(); toast('Windows voice could not finish. Your answer is still available to read.'); };
    speechSynthesis.speak(utterance);
  }
  next();
}
async function speakFinal(target = settings.speechTarget) {
  if (!run?.final) return toast('A final answer will be available after a joint review.');
  if (target === 'windows') return windowsSpeak(run.final);
  if (!avatarLive) { $('#voice-panel').hidden = false; return toast('Connect your avatar first, then send the final answer.'); }
  try { stopWindows(); avatarSpeaking = true; await syncListening(); $('#avatar-audio').muted = false; await $('#avatar-audio').play().catch(() => {}); await api.avatarSpeak(plain(run.final)); $('#avatar-status').textContent = 'Final answer sent. Listening stays paused until you click Resume listening or disconnect the avatar.'; }
  catch (error) { toast(error.message); }
}
function loadVoices() {
  const current = settings.windowsVoice || $('#windows-voice').value;
  const voices = speechSynthesis.getVoices().filter(v => /^en(-|_)/i.test(v.lang));
  $('#windows-voice').innerHTML = '<option value="">System default</option>' + voices.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)}</option>`).join('');
  $('#windows-voice').value = current;
}
function avatarStatus(text) { $('#avatar-status').textContent = text; }
async function disconnectAvatar() {
  avatarGeneration++; avatarLive = false; avatarSpeaking = false;
  if (peer) { peer.onconnectionstatechange = null; peer.close(); peer = null; }
  silentTrack?.stop(); silentTrack = null; oscillator?.stop(); oscillator = null;
  if (audioContext) { await audioContext.close().catch(() => {}); audioContext = null; }
  $('#avatar-video').srcObject = null; $('#avatar-audio').srcObject = null; $('#avatar-frame').hidden = true;
  $('#connect-avatar').disabled = false; $('#disconnect-avatar').hidden = true; $('#mute-avatar').hidden = true;
  avatarStatus('Disconnected. Your printed answers are still available.');
  await api.avatarLeave().catch(() => {});
  syncListening();
}
async function connectAvatar() {
  await disconnectAvatar();
  const generation = ++avatarGeneration;
  $('#connect-avatar').disabled = true; $('#disconnect-avatar').hidden = false;
  avatarStatus('Connecting through your existing Jarvis installation…');
  try {
    settings = await api.saveSettings({ ...settings, avatarId: $('#avatar-choice').value });
    const info = await api.avatarInfo();
    if (!info.available) throw new Error(info.message || 'The Jarvis avatar is currently unavailable.');
    const ice = await api.avatarIce();
    if (generation !== avatarGeneration) return;
    const pc = new RTCPeerConnection({ iceServers: ice.iceServers || [], bundlePolicy: 'max-bundle', iceTransportPolicy: 'all' });
    peer = pc;
    pc.ontrack = event => {
      if (generation !== avatarGeneration) return;
      const element = event.track.kind === 'video' ? $('#avatar-video') : $('#avatar-audio');
      element.srcObject = new MediaStream([event.track]); element.play().catch(() => avatarStatus('Connected. Click Send final answer to enable audio.'));
    };
    pc.onconnectionstatechange = () => {
      if (generation !== avatarGeneration) return;
      if (pc.connectionState === 'connected') { avatarLive = true; $('#avatar-frame').hidden = false; $('#mute-avatar').hidden = false; avatarStatus('Live · final answers only. No microphone or camera is being sent.'); }
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { avatarLive = false; avatarStatus('Avatar connection ended. Reconnect when you are ready.'); $('#connect-avatar').disabled = false; }
    };
    // A silent audio track negotiates the avatar's receive/playback path. It never accesses a microphone.
    audioContext = new AudioContext(); oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain(); gain.gain.value = 0;
    const destination = audioContext.createMediaStreamDestination(); oscillator.connect(gain); gain.connect(destination); oscillator.start();
    silentTrack = destination.stream.getAudioTracks()[0]; pc.addTrack(silentTrack, destination.stream);
    pc.addTransceiver('video', { direction: 'recvonly' });
    await pc.setLocalDescription(await pc.createOffer());
    if (pc.iceGatheringState !== 'complete') await new Promise(resolve => {
      const timer = setTimeout(resolve, 4000);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); } });
    });
    const answer = await api.avatarOffer({ type: 'offer', sdp: pc.localDescription.sdp });
    if (generation !== avatarGeneration) { pc.close(); return; }
    await pc.setRemoteDescription(answer);
    avatarStatus('Waiting for the live video and audio connection…');
  } catch (error) {
    if (generation === avatarGeneration) { await disconnectAvatar(); avatarStatus(error.message + ' You can still use Windows voice.'); }
  }
}
document.addEventListener('click', async event => {
  const link = event.target.closest('a');
  if (link) { event.preventDefault(); try { await api.openLink(link.getAttribute('href')); } catch (error) { toast(error.message); } return; }
  const nav = event.target.closest('[data-view]'); if (nav) { showView(nav.dataset.view); return; }
  const mode = event.target.closest('[data-mode]'); if (mode && !busy) { settings.mode = mode.dataset.mode; settings = await api.saveSettings(settings); renderModes(); return; }
  const suggestion = event.target.closest('[data-question]'); if (suggestion) { $('#question').value = suggestion.dataset.question; $('#question').focus(); return; }
  const copy = event.target.closest('[data-copy]');
  if (copy && run) {
    const source = copy.dataset.copy === 'final' ? run.final : (copy.dataset.copy === 'answer' ? run.answers : run.reviews).find(a => a.id === copy.dataset.id)?.text;
    try { await api.copy(copy.dataset.format === 'markdown' ? source : plain(source)); toast('Copied to clipboard.'); } catch (error) { toast(error.message); } return;
  }
  const retry = event.target.closest('[data-retry]'); if (retry && !busy) { try { setBusy(true); await api.retry(retry.dataset.retry); } catch (error) { setBusy(false); toast(error.message); } return; }
  const entry = event.target.closest('[data-history]'); if (entry) { try { run = await api.loadHistory(entry.dataset.history); showView('conversation'); renderRun(); } catch (error) { toast(error.message); } return; }
  if (event.target.closest('[data-speak]')) speakFinal();
  if (event.target.closest('#copy-discussion') || event.target.closest('#copy-discussion-markdown')) { await api.copy(event.target.closest('#copy-discussion-markdown') ? discussion() : plain(discussion())); toast('Complete discussion copied.'); }
  if (event.target.closest('#regenerate') && run && !busy) submit(run.task);
});
document.addEventListener('change', async event => {
  if (event.target.dataset.enable) {
    const id = event.target.dataset.enable;
    settings.enabled = event.target.checked ? [...new Set([...settings.enabled, id])] : settings.enabled.filter(x => x !== id);
    settings = await api.saveSettings(settings); renderConnections();
  }
  if (event.target.dataset.model) {
    const id = event.target.dataset.model;
    const value = event.target.value.trim();
    if (value && !/^[a-zA-Z0-9_.:/@+-]{1,160}$/.test(value)) { toast('Use a valid model identifier.'); renderConnections(); return; }
    settings.models[id] = value; settings = await api.saveSettings(settings); toast('Model preference saved.');
  }
});
$('#question-form').addEventListener('submit', event => { event.preventDefault(); submit(); });
$('#question').addEventListener('keydown', event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); submit(); } });
$('#paste').addEventListener('click', async () => { const value = await api.paste(); const box = $('#question'); box.setRangeText(value, box.selectionStart, box.selectionEnd, 'end'); box.value = box.value.slice(0, 20000); box.focus(); });
$('#stop').addEventListener('click', async () => { status('Stopping your assistants…'); await api.stop(); });
$('#new').addEventListener('click', () => { if (busy) return; stopWindows(); syncListening(); run = null; showView('conversation'); renderRun(); status('Ready when you are.'); $('#question').value = ''; $('#question').focus(); });
$('#refresh').addEventListener('click', checkConnections);
$('#font-size').addEventListener('input', event => { $('#font-size-label').textContent = `${event.target.value} px`; });
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    settings = await api.saveSettings({ ...settings, instructions: $('#instructions').value, theme: $('#theme').value, fontSize: Number($('#font-size').value), finalProvider: $('#final-provider').value, retainHistory: $('#retain-history').checked, autoSpeak: $('#auto-speak').checked, speechTarget: $('#speech-target').value, timeoutSeconds: Number($('#timeout').value) });
    applyAppearance(); renderConnections(); await history(); $('#save-status').textContent = 'Saved on this computer.'; toast('Settings and memory saved.');
  } catch (error) { toast(error.message); }
});
$('#voice-toggle').addEventListener('click', () => { $('#voice-panel').hidden = !$('#voice-panel').hidden; });
$('#voice-close').addEventListener('click', () => { $('#voice-panel').hidden = true; });
$('#read-final').addEventListener('click', () => speakFinal('windows'));
$('#windows-voice').addEventListener('change', async event => { settings = await api.saveSettings({ ...settings, windowsVoice: event.target.value }); });
$('#stop-speaking').addEventListener('click', () => { stopWindows(); if (peer) disconnectAvatar(); else syncListening(); toast('Speech stopped.'); });
$('#connect-avatar').addEventListener('click', connectAvatar);
$('#disconnect-avatar').addEventListener('click', disconnectAvatar);
$('#speak-avatar').addEventListener('click', () => speakFinal('avatar'));
$('#mute-avatar').addEventListener('click', () => { const audio = $('#avatar-audio'); audio.muted = !audio.muted; $('#mute-avatar').textContent = audio.muted ? 'Unmute avatar' : 'Mute avatar'; });
$('#open-jarvis').addEventListener('click', () => api.openJarvis());
window.addEventListener('beforeunload', () => { stopWindows(); peer?.close(); silentTrack?.stop(); audioContext?.close(); });
// Update immediately: Windows may throttle background renderer timers during long requests.
api.onRun(value => { run = value; renderRun(); });
api.onIdle(async () => {
  setBusy(false); renderRun(); await history();
  if (settings.autoSpeak && run?.state === 'done' && run.final && spokenRun !== run.id + run.final) { spokenRun = run.id + run.final; await speakFinal(); }
  else syncListening();
});
$('#listening-toggle').addEventListener('click', async () => {
  try {
    if (!listeningEnabled && !await api.listeningAvailable()) return toast('Windows English speech recognition is unavailable. Add English (United States) speech in Windows Settings.');
    const value = !listeningEnabled;
    await api.listeningEnable(value); listeningEnabled = value;
    $('#listening-toggle').textContent = value ? 'Turn microphone off' : 'Enable Hey JARVIS';
    $('#listening-toggle').setAttribute('aria-pressed', String(value));
    if (value) { speaking = speechSynthesis.speaking; await syncListening(); }
  } catch (error) { toast(error.message); }
});
$('#listening-resume').addEventListener('click', async () => {
  if (busy) return toast('Your assistants are still answering.');
  if (avatarSpeaking) await disconnectAvatar();
  stopWindows(); await syncListening();
});
api.onListening(value => {
  $('#listening-status').textContent = value.text;
  $('#listening-resume').hidden = value.state !== 'paused';
  if (value.state === 'off' || value.state === 'error') {
    listeningEnabled = false; $('#listening-toggle').textContent = 'Enable Hey JARVIS'; $('#listening-toggle').setAttribute('aria-pressed', 'false');
  }
  if (value.state === 'question') toast('Listening—ask your question now.');
  if (value.state === 'transcript') {
    if (!listeningEnabled) return;
    $('#heard-question').textContent = `Heard: ${value.text}`;
    $('#listening-resume').hidden = false;
    if ($('#question').value.trim()) return toast('Your typed draft was kept. The voice question was not sent.');
    $('#question').value = value.text;
    if (!busy && !speaking && !avatarSpeaking) submit(value.text);
  }
});
async function init() {
  try {
    const state = await api.bootstrap(); settings = state.settings; run = state.current;
    $('#version').textContent = `Version ${state.version}`; $('#avatar-choice').value = settings.avatarId;
    applyAppearance(); renderModes(); fillSettings(); renderRun(); loadVoices(); speechSynthesis.onvoiceschanged = loadVoices;
    await history(); await checkConnections();
    if (!run) status(catalog.some(p => p.ready && settings.enabled.includes(p.id)) ? 'Ready when you are.' : 'Choose a connected assistant in Connections.');
  } catch (error) { status(error.message); toast(error.message); }
}
init();
