/* ILQ popup — yalnızca background üzerinden offscreen'e mesaj gönderir. */
import { t, getLang, setLang, applyI18n } from './i18n.js';
import QRCode from 'qrcode';
import { startVoiceRecorder, createCallPeerConnection, attachLocalTracks } from './voice.js';

const $ = (id) => document.getElementById(id);
let activePeer = null;
let trustVerified = false;
window.__sessions = [];
window.__unread = {};
window.__readAckOff = {}; // username -> true (o sohbette k:12 gönderme kapalı), RAM-only
window.__pendingRead = {}; // username -> Set<mid> — henüz k:12 gönderilmemiş mesajlar
window.__voiceUrls = {}; // mid -> objectURL (RAM-only; expired/panik/reset revoke)
window.__voiceRec = null; // { stop, elapsed } — aktif kayıt
window.__voiceDraft = null; // { url, blob, mime, bytes }
window.__call = null; // { callId, username, mode, pc, localStream, remoteStream, phase, pendingIce }
window.__callPendingDesc = null; // gelen 'request' içindeki offer
window.__callTimerId = null;

function sendToOffscreen(action, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ target: 'offscreen', action, ...payload }, (resp) => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(resp || { ok: false, error: 'cevap yok' });
    });
  });
}

function showView(view) {
  $('loginView').classList.toggle('hidden', view !== 'login');
  $('mainView').classList.toggle('hidden', view !== 'main');
}

function showPanel(panel) {
  ['connect', 'code', 'chat'].forEach((p) => {
    $('panel' + p[0].toUpperCase() + p.slice(1)).classList.toggle('hidden', p !== panel);
  });
  ['tabConnect', 'tabCode', 'tabChat'].forEach((t, i) => {
    const isActive = ['connect', 'code', 'chat'][i] === panel;
    $(t).classList.toggle('active', isActive);
    if (isActive) $(t).setAttribute('aria-selected', 'true');
    else $(t).setAttribute('aria-selected', 'false');
  });
  // Sohbet paneline dönüş: aktif sohbet için bekleyen okundu kaşelerini boşalt.
  // (connect/code panellerinde boşaltma — k:12 yalnızca sohbet görünürken gider.)
  if (panel === 'chat' && activePeer) flushReads(activePeer);
}

function addMessage(text, who, msgType, mid, ts) {
  const div = document.createElement('div');
  div.className = 'msg ' + (msgType || 'in');
  if (mid) div.dataset.mid = mid;
  div.dataset.user = who === 'ben' ? activePeer : who;
  const inner = document.createElement('div');
  inner.className = 'msg-bubble';
  if (who) {
    const whoSpan = document.createElement('span');
    whoSpan.className = 'who';
    whoSpan.textContent = who;
    inner.appendChild(whoSpan);
  }
  const bodyEl = document.createElement('span');
  bodyEl.className = 'msg-body';
  bodyEl.textContent = text;
  inner.appendChild(bodyEl);
  if (msgType === 'out') {
    const st = document.createElement('span');
    st.className = 'msg-status';
    st.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
    inner.appendChild(st);
    const menu = document.createElement('button');
    menu.className = 'msg-menu';
    menu.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></svg>';
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      openMessageMenu(menu, div);
    });
    inner.appendChild(menu);
  }
  if (ts) {
    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    inner.appendChild(time);
  }
  div.appendChild(inner);
  $('chatMessages').appendChild(div);
  div.hidden = div.dataset.user !== activePeer;
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

/* --- paket 4: çoklu sohbet sekmeleri --- */
function renderTabs() {
  const tabs = $('chatTabs');
  tabs.innerHTML = '';
  for (const username of window.__sessions || []) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'chat-tab' + (username === activePeer ? ' active' : '');
    const n = (window.__unread || {})[username] || 0;
    tab.appendChild(document.createTextNode(username));
    if (n) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = n;
      tab.appendChild(badge);
    }
    tab.setAttribute('data-username', username);
    tab.addEventListener('click', () => openPeer(username));
    tabs.appendChild(tab);
  }
}

function sendReadIfVisible(username, mid) {
  if (window.__readAckOff[username]) return; // per-sohbet kapatma: k:12 gönderilmez
  if (!isChatVisible()) return; // sohbet görünür değil
  sendToOffscreen('sendRead', { username, mid });
}

function queueRead(username, mid) {
  if (username === activePeer && isChatVisible()) {
    sendReadIfVisible(username, mid);
  } else {
    if (!window.__pendingRead[username]) window.__pendingRead[username] = new Set();
    window.__pendingRead[username].add(mid);
  }
}

function flushReads(username) {
  const set = window.__pendingRead[username];
  if (!set || set.size === 0) return;
  // Sohbet görünür hale geldi: bekleyen her mesaj artık okundu — her biri için k:12.
  // (Per-sohbet kapatma sendReadIfVisible içindeki __readAckOff kontrolüyle elenir.)
  for (const mid of set) sendReadIfVisible(username, mid);
  set.clear();
}

function isChatVisible() {
  const mainHidden = $('mainView').classList.contains('hidden');
  const panelHidden = $('panelChat').classList.contains('hidden');
  return !mainHidden && !panelHidden;
}

function openPeer(username) {
  activePeer = username;
  if (username && window.__unread) window.__unread[username] = 0;
  document.querySelectorAll('#chatMessages .msg').forEach((n) => { n.hidden = n.dataset.user !== username; });
  $('chatPeer').textContent = username || '';
  renderTabs();
  renderReadToggle();
  if (username) flushReads(username);
}

/* --- paket 6: "yazıyor…" ipucu --- */
let _typingHintTimer = null;
function showTypingHint(peer) {
  if (peer && peer !== activePeer) return;
  const hint = $('typingHint');
  if (!hint) return;
  hint.hidden = false;
  clearTimeout(_typingHintTimer);
  _typingHintTimer = setTimeout(() => { hint.hidden = true; }, 3000);
}

function refreshSessions() {
  sendToOffscreen('status').then((res) => {
    if (res && res.ok) {
      window.__sessions = res.sessions || [];
      applyTheme(res.theme || 'bone');
      renderTabs();
    }
  });
}

/* --- paket 4: adres defteri (RAM-only) --- */
async function refreshContacts() {
  const r = await sendToOffscreen('listContacts', {});
  const list = $('contactList');
  if (!list) return;
  list.innerHTML = '';
  if (r && r.contacts) {
    for (const c of r.contacts) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'contact-item';
      btn.textContent = c.username + ' · ' + (c.verified ? t('contact.verified') : t('contact.new'));
      btn.addEventListener('click', async () => {
        const res = await sendToOffscreen('reconnectContact', { username: c.username });
        if (!res || !res.ok) showTempError((res && res.error) ? errorText(res.error) : t('err.reconnectFailed'));
      });
      list.appendChild(btn);
    }
  }
}

/* --- paket 4: tema sistemi (bone|dark|hc|system) --- */
// system modunu gerçek bir tema adına çözer; diğerleri olduğu gibi döner.
function schemeFor(mode) {
  if (mode === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'bone';
  return mode;
}

function applyTheme(mode) {
  const doc = document.documentElement;
  doc.dataset.theme = schemeFor(mode);
  doc.dataset.themeMode = mode;
  const sel = $('themeSelect');
  if (sel && sel.value !== mode) sel.value = mode;
}

// Açılışta durum (status) üzerinden kayıtlı temayı geri yükler.
function initTheme() {
  refreshSessions();
}

const themeMQ = window.matchMedia('(prefers-color-scheme: dark)');
themeMQ.addEventListener('change', () => {
  if (document.documentElement.dataset.themeMode === 'system') applyTheme('system');
});

$('themeSelect').addEventListener('change', () => {
  const mode = $('themeSelect').value || 'bone';
  sendToOffscreen('setTheme', { mode });
  applyTheme(mode);
});

function openMessageMenu(btn, bubble) {
  const menu = document.createElement('div');
  menu.className = 'msg-menu-popup';
  const local = document.createElement('button');
  local.textContent = t('menu.local');
  local.addEventListener('click', () => bubble.remove());
  menu.appendChild(local);
  const remote = document.createElement('button');
  remote.textContent = t('menu.remote');
  remote.className = 'danger';
  const mid = bubble.dataset.mid;
  const rec = window.__sentMids && window.__sentMids[mid];
  const expired = !rec || (Date.now() - rec.ts) > 5 * 60 * 1000;
  remote.disabled = !!expired;
  if (expired) remote.title = t('menu.expired');
  remote.addEventListener('click', () => {
    if (!mid) return;
    sendToOffscreen('recallMessage', { username: activePeer, mid }).then((res) => {
      if (res && res.ok) {
        markDeleted(mid);
        showTempError(t('err.recallSent'));
      } else {
        showTempError((res && res.error) ? errorText(res.error) : t('err.recallFailed'));
      }
    });
    menu.remove();
  });
  menu.appendChild(remote);
  btn.parentNode.appendChild(menu);
  const close = (e2) => {
    if (!menu.contains(e2.target) && e2.target !== btn) menu.remove();
    document.removeEventListener('click', close);
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

function markDeleted(mid) {
  const el = document.querySelector('.msg[data-mid="' + mid + '"] .msg-body');
  if (!el) return;
  el.textContent = t('chat.recalled');
  el.setAttribute('data-i18n', 'chat.recalled');
  el.classList.add('recalled');
}

function markRecallAcked(mid) {
  const bubble = document.querySelector('.msg[data-mid="' + mid + '"]');
  if (!bubble) return;
  const note = document.createElement('div');
  note.className = 'msg-note';
  note.textContent = t('chat.deletedRemote');
  note.setAttribute('data-i18n', 'chat.deletedRemote');
  bubble.appendChild(note);
}

/* --- paket 4: dosya paylaşımı (k:7/8/9/10) --- */
function fileSizeLabel(bytes) {
  if (!bytes) return '0 B';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.max(1, Math.ceil(bytes / 1024)) + ' KB';
}

function addFileCard(mid, name, size, type, peer, side) {
  const div = document.createElement('div');
  div.className = 'msg ' + (side === 'out' ? 'out' : 'in');
  div.dataset.file = mid;
  div.dataset.user = peer || activePeer;
  const inner = document.createElement('div');
  inner.className = 'msg-bubble file-card';
  const head = document.createElement('div');
  head.className = 'file-head';
  const icon = document.createElement('span');
  icon.className = 'file-icon';
  icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8L9.5 18a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/></svg>';
  const meta = document.createElement('div');
  meta.className = 'file-meta';
  const nm = document.createElement('div');
  nm.className = 'file-name';
  nm.textContent = name;
  const si = document.createElement('div');
  si.className = 'file-sub';
  si.textContent = fileSizeLabel(size) + (type ? ' · ' + type : '');
  meta.appendChild(nm);
  meta.appendChild(si);
  head.appendChild(icon);
  head.appendChild(meta);
  inner.appendChild(head);
  const prog = document.createElement('div');
  prog.className = 'file-progress hidden';
  const track = document.createElement('div');
  track.className = 'file-progress-track';
  const fill = document.createElement('div');
  fill.className = 'file-progress-fill';
  track.appendChild(fill);
  const pct = document.createElement('span');
  pct.className = 'file-progress-pct';
  prog.appendChild(track);
  prog.appendChild(pct);
  inner.appendChild(prog);
  const actions = document.createElement('div');
  actions.className = 'file-actions hidden';
  if (side === 'in') {
    actions.classList.remove('hidden');
    const accept = document.createElement('button');
    accept.className = 'primary';
    accept.textContent = t('file.accept');
    accept.addEventListener('click', async () => {
      const res = await sendToOffscreen('acceptFileTransfer', { username: peer, mid, accept: true });
      if (res && res.ok) {
        actions.classList.add('hidden');
        prog.classList.remove('hidden');
      } else {
        showTempError((res && res.error) ? errorText(res.error) : t('err.fileRecvFailed'));
      }
    });
    const reject = document.createElement('button');
    reject.className = 'danger';
    reject.textContent = t('file.decline');
    reject.addEventListener('click', async () => {
      const res = await sendToOffscreen('acceptFileTransfer', { username: peer, mid, accept: false });
      if (res && res.ok) {
        div.remove();
        if (window.__fileCards) delete window.__fileCards[mid];
      } else showTempError((res && res.error) ? errorText(res.error) : t('err.fileRejectFailed'));
    });
    actions.appendChild(accept);
    actions.appendChild(reject);
  } else {
    prog.classList.remove('hidden');
    pct.textContent = '0%';
  }
  inner.appendChild(actions);
  div.appendChild(inner);
  $('chatMessages').appendChild(div);
  div.hidden = (peer || activePeer) !== activePeer;
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  if (!window.__fileCards) window.__fileCards = {};
  window.__fileCards[mid] = div;
  return div;
}

function updateFileCard(mid, opts) {
  const div = (window.__fileCards || {})[mid];
  if (!div) return;
  const prog = div.querySelector('.file-progress');
  const fill = div.querySelector('.file-progress-fill');
  const pct = div.querySelector('.file-progress-pct');
  if (typeof opts.percent === 'number') {
    prog.classList.remove('hidden');
    fill.style.transform = 'scaleX(' + Math.min(1, (opts.percent || 0) / 100) + ')';
    pct.textContent = opts.percent + '%';
  }
  if (opts.complete) {
    const link = document.createElement('a');
    link.className = 'file-preview';
    link.href = opts.url;
    link.textContent = t('file.view');
    link.target = '_blank';
    div.querySelector('.msg-bubble').appendChild(link);
    if (fill) fill.style.transform = 'scaleX(1)';
    if (pct) pct.textContent = '100%';
  }
  if (opts.note) {
    const note = document.createElement('div');
    note.className = 'msg-note file-note' + (opts.danger ? ' danger-text' : '');
    note.textContent = opts.note;
    if (opts.noteKey) note.setAttribute('data-i18n', opts.noteKey);
    div.querySelector('.msg-bubble').appendChild(note);
  }
}

function clearFileCards() {
  window.__fileCards = {};
  for (const mid in (window.__fileUrls || {})) {
    try { URL.revokeObjectURL(window.__fileUrls[mid]); } catch (e) {}
  }
  window.__fileUrls = {};
  document.querySelectorAll('#chatMessages .msg[data-file]').forEach((n) => n.remove());
}

/* --- paket 5: sesli mesaj (k:13) --- */
function addVoiceChip(mid, bytes, mime, who) {
  const div = document.createElement('div');
  div.className = 'msg ' + (who === 'out' ? 'out' : 'in');
  div.dataset.voice = mid;
  div.dataset.mid = mid;
  div.dataset.user = who === 'out' ? activePeer : (activePeer || 'in');
  div.hidden = div.dataset.user !== activePeer;
  const inner = document.createElement('div');
  inner.className = 'msg-bubble voice-chip';
  if (window.__voiceUrls[mid]) { try { URL.revokeObjectURL(window.__voiceUrls[mid]); } catch (e) {} }
  const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'audio/webm' }));
  window.__voiceUrls[mid] = url;
  const audio = document.createElement('audio');
  audio.src = url;
  audio.preload = 'metadata';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'voice-play';
  toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l10-6.5Z"/></svg>';
  const progressWrap = document.createElement('div');
  progressWrap.className = 'voice-progress';
  const fill = document.createElement('div');
  fill.className = 'voice-progress-fill';
  progressWrap.appendChild(fill);
  const durEl = document.createElement('span');
  durEl.className = 'voice-time mono';
  toggle.addEventListener('click', () => {
    if (audio.paused) { audio.play(); toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z"/></svg>'; }
    else { audio.pause(); toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l10-6.5Z"/></svg>'; }
  });
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 0;
    fill.style.transform = 'scaleX(' + (d ? audio.currentTime / d : 0) + ')';
  });
  audio.addEventListener('loadedmetadata', () => {
    durEl.textContent = (audio.duration ? Math.ceil(audio.duration) : 0) + 's';
  });
  audio.addEventListener('ended', () => {
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l10-6.5Z"/></svg>';
  });
  inner.appendChild(toggle);
  inner.appendChild(progressWrap);
  inner.appendChild(durEl);
  if (who === 'out') {
    const st = document.createElement('span');
    st.className = 'msg-status';
    st.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
    inner.appendChild(st);
  }
  div.appendChild(inner);
  $('chatMessages').appendChild(div);
  div.hidden = div.dataset.user !== activePeer;
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  // 'expired' balon kaldırma (.msg[data-mid]) voice fişleri için de çalışır
  return div;
}

function clearVoiceCards() {
  for (const mid in (window.__voiceUrls || {})) {
    try { URL.revokeObjectURL(window.__voiceUrls[mid]); } catch (e) {}
  }
  window.__voiceUrls = {};
  document.querySelectorAll('#chatMessages .msg[data-voice]').forEach((n) => n.remove());
}

function clearVoiceDraft() {
  const d = window.__voiceDraft;
  if (!d) return;
  try { URL.revokeObjectURL(d.url); } catch (e) {}
  window.__voiceDraft = null;
  $('voiceDraftBar').classList.add('hidden');
  const a = $('voiceDraftAudio');
  if (a) a.removeAttribute('src');
}

/* --- paket 5: kayıt + gönderim --- */
function stopActiveRecording() {
  if (window.__voiceRec) {
    try { window.__voiceRec.stop(); } catch (e) {}
    window.__voiceRec = null;
  }
  $('micBtn').classList.remove('recording');
  $('micBtn').textContent = '';
}

function showRecordingTick(seconds) {
  const btn = $('micBtn');
  const left = Math.max(0, 60 - seconds);
  btn.textContent = ':' + String(left).padStart(2, '0');
}

function showVoiceDraftBar(blob) {
  const url = blob ? URL.createObjectURL(blob) : null;
  window.__voiceDraft = blob ? { url, blob, mime: blob.type || 'audio/webm' } : null;
  const bar = $('voiceDraftBar');
  const audio = $('voiceDraftAudio');
  bar.classList.remove('hidden');
  if (audio && url) {
    audio.src = url;
    audio.load();
  }
}

async function startVoiceRecording() {
  if (!activePeer) { showTempError(t('err.openChatFirst')); return; }
  if (window.__voiceRec) return; // zaten kayıt
  try {
    window.__voiceRec = await startVoiceRecorder({
      onTick: showRecordingTick,
      onComplete: (blob) => {
        window.__voiceRec = null;
        $('micBtn').classList.remove('recording');
        $('micBtn').textContent = '';
        if (blob && blob.size) showVoiceDraftBar(blob);
      },
      onError: (e) => {
        window.__voiceRec = null;
        $('micBtn').classList.remove('recording');
        $('micBtn').textContent = '';
        showTempError(errorText(e.message));
      },
    });
    $('micBtn').classList.add('recording');
    showRecordingTick(0);
  } catch (e) {
    showTempError(errorText(e.message || 'err.micDenied'));
  }
}

async function sendVoiceDraft() {
  const d = window.__voiceDraft;
  if (!d) return;
  if (!activePeer) { showTempError(t('err.openChatFirst')); return; }
  try {
    const bytes = await d.blob.arrayBuffer();
    const expiryEl = $('expirySelect');
    const expSeconds = parseInt((expiryEl && expiryEl.value) || '0', 10);
    const res = await sendToOffscreen('sendVoiceMessage', { username: activePeer, bytes, mime: d.mime, expSeconds });
    if (res && res.ok) {
      addVoiceChip(res.mid, bytes, d.mime, 'out');
      if (res.mid) {
        if (!window.__sentMids) window.__sentMids = {};
        window.__sentMids[res.mid] = { ts: Date.now() };
        if (expSeconds) {
          if (!window.__expiryMids) window.__expiryMids = {};
          window.__expiryMids[res.mid] = expSeconds;
          if (!window.__expiryTimers) window.__expiryTimers = {};
          window.__expiryTimers[res.mid] = setTimeout(() => removeMessageBubble(res.mid), expSeconds * 1000);
        }
      }
      clearVoiceDraft();
    } else {
      showTempError((res && res.error) ? errorText(res.error) : t('err.voiceSendFailed'));
    }
  } catch (e) {
    showTempError(t('err.voiceSendFailed'));
  }
}

$('micBtn').addEventListener('click', startVoiceRecording);
$('voiceDraftSendBtn').addEventListener('click', sendVoiceDraft);
$('voiceDraftCancelBtn').addEventListener('click', clearVoiceDraft);

/* --- paket 5: arama başlatma --- */
async function handleCallStart(mode) {
  if (!activePeer) { showTempError(t('err.openChatFirst')); return; }
  if (window.__call) { showTempError(t('error.callActive')); return; }
  const startRes = await sendToOffscreen('startCall', { username: activePeer, mode });
  if (!startRes || !startRes.ok) { showTempError((startRes && startRes.error) ? errorText(startRes.error) : t('err.callStartFailed')); return; }
  $('callPeer').textContent = activePeer;
  callUiPhase('outgoing', mode);
  let localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia(mode === 'video' ? { audio: true, video: true } : { audio: true });
  } catch (e) {
    showTempError(t('err.micDenied'));
    sendToOffscreen('callSignal', { username: activePeer, callId: startRes.callId, c: 'end' }).catch(() => {});
    closeCallUi();
    return;
  }
  window.__call = { callId: startRes.callId, username: activePeer, mode, pc: null, localStream, remoteStream: null, phase: 'outgoing', pendingIce: [] };
  if ($('localVideo')) $('localVideo').srcObject = localStream;
  const pc = createCallPeerConnection({
    iceServers: startRes.iceServers,
    onIce: (candidate) => {
      const call = window.__call;
      if (call && call.phase !== 'closed') {
        sendToOffscreen('callSignal', { username: call.username, callId: call.callId, c: 'ice', candidate });
      }
    },
    onTrack: (stream) => {
      const call = window.__call;
      if (call && call.phase !== 'closed') {
        call.remoteStream = stream;
        if ($('remoteVideo')) { $('remoteVideo').srcObject = stream; $('remoteVideo').play().catch(() => {}); }
      }
    },
    onStateChange: () => {},
    onFail: () => { showTempError(t('call.unsupported')); teardownCall(); },
  });
  if (!pc) return;
  window.__call.pc = pc;
  attachLocalTracks(pc, localStream);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendToOffscreen('callSignal', { username: activePeer, callId: startRes.callId, c: 'request', mode, desc: offer.toJSON() });
}

$('callBtn').addEventListener('click', () => handleCallStart('audio'));
$('callVideoBtn').addEventListener('click', () => handleCallStart('video'));

// Paket 3: süresi dolan mesaj balonunu sohbetten kaldır (her iki taraf da bu yoldan geçer)
function removeMessageBubble(mid) {
  const bubble = document.querySelector('.msg[data-mid="' + mid + '"]');
  if (bubble) bubble.remove();
}

// Paket 3: popup tarafı düz metin izlerini ve süreli mesaj zamanlayıcılarını temizle.
// Panik ve sıfırlama sonrası stale mid takibi / balon kaldırma zamanlayıcıları kalmasın.
function clearPopupExpiryState() {
  window.__sentMids = {};
  window.__expiryMids = {};
  if (window.__expiryTimers) {
    for (const mid in window.__expiryTimers) clearTimeout(window.__expiryTimers[mid]);
  }
  window.__expiryTimers = {};
}

function setStatus(text, state) {
  const el = $('connectionState');
  el.setAttribute('data-state', state || 'offline');
  el.querySelector('.pill-text').textContent = text;
}

/* --- parmak izi doğrulama --- */
function groupFingerprint(fp) {
  const digits = fp.replace(/\D/g, '');
  return digits.match(/.{1,10}/g) || [];
}

function renderFingerprint(fp) {
  const groups = groupFingerprint(fp);
  const el = document.createElement('div');
  el.className = 'fp-digits';
  groups.forEach((g) => {
    const row = document.createElement('div');
    row.className = 'fp-row';
    const half = Math.ceil(g.length / 2);
    row.innerHTML =
      '<span>' + g.slice(0, half) + '</span><span>' + g.slice(half) + '</span>';
    el.appendChild(row);
  });
  return el;
}

function setTrustVerified(verified) {
  trustVerified = verified;
  const card = $('fpCard');
  if (card) card.classList.toggle('verified', verified);
  // Doğrulanana kadar mesaj gönderilemez (offscreen da aynı kuralı zorlar).
  if ($('sendBtn')) $('sendBtn').disabled = !verified;
  if (verified) {
    setStatus(t('status.verified'), 'verified');
    $('chatHeader').classList.add('verified');
  } else {
    $('chatHeader').classList.remove('verified');
    setStatusToConnection();
  }
}

function setStatusToConnection() {
  if ($('mainView').classList.contains('hidden')) return;
  if (trustVerified) {
    setStatus(t('status.verified'), 'verified');
    return;
  }
  if (activePeer) setStatus(t('status.chatPrefix') + activePeer, 'chatting');
  else setStatus(t('status.online'), 'online');
}

/* --- paket 5: canlı arama (k:14 + panel RTCPeerConnection) --- */
function callUiPhase(phase, mode) {
  $('callOverlay').classList.remove('hidden');
  const isVideo = mode === 'video';
  $('callVideos') && $('callVideos').classList.toggle('hidden', !isVideo);
  $('callAvatar') && $('callAvatar').classList.toggle('hidden', isVideo);
  $('callAcceptBtn').classList.toggle('hidden', phase !== 'incoming');
  $('callEndBtn').classList.toggle('hidden', phase !== 'active');
  $('callMuteBtn').classList.toggle('hidden', phase !== 'active');
  $('callVideoToggleBtn') && $('callVideoToggleBtn').classList.toggle('hidden', isVideo || phase !== 'active');
  if (phase === 'outgoing') $('callStatus').textContent = t('call.calling');
  if (phase === 'incoming') $('callStatus').textContent = t('call.ringing');
  if (phase === 'active') $('callStatus').textContent = t('call.activeNote');
}

function closeCallUi() {
  $('callOverlay').classList.add('hidden');
  if ($('localVideo')) $('localVideo').srcObject = null;
  if ($('remoteVideo')) $('remoteVideo').srcObject = null;
  $('callTimer').hidden = true;
  if (window.__callTimerId) { clearInterval(window.__callTimerId); window.__callTimerId = null; }
}

function startCallTimer() {
  const start = Date.now();
  $('callTimer').hidden = false;
  clearInterval(window.__callTimerId);
  window.__callTimerId = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    $('callTimer').textContent = mm + ':' + ss;
  }, 1000);
}

function teardownCall() {
  const c = window.__call;
  if (!c) return;
  if (c.pc) { try { c.pc.close(); } catch (e) {} }
  if (c.localStream) c.localStream.getTracks().forEach((t) => t.stop());
  window.__call = null;
  closeCallUi();
}

/* --- olaylar (offscreen -> background -> popup) --- */
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'popup' || !msg.ev) return;
  switch (msg.ev) {
    case 'message':
      setStatusToConnection();
      addMessage(msg.payload.text, msg.payload.from, 'in', msg.payload.mid, msg.payload.ts);
      queueRead(msg.payload.from, msg.payload.mid);
      if (!window.__unread) window.__unread = {};
      if (msg.payload.from !== activePeer) {
        window.__unread[msg.payload.from] = (window.__unread[msg.payload.from] || 0) + 1;
        renderTabs();
      }
      break;
    case 'typing':
      showTypingHint(msg.payload.from);
      break;
    case 'connected':
      openPeer(msg.payload.peer || msg.payload.username);
      setStatusToConnection();
      trustVerified = false;
      $('chatHeader').classList.remove('verified');
      if ($('sendBtn')) $('sendBtn').disabled = true;
      addMessage(t('chat.secure'), msg.payload.peer || msg.payload.username, 'in');
      refreshSessions();
      refreshContacts();
      break;
    case 'fingerprint':
      trustVerified = false;
      $('fpToast').classList.remove('hidden');
      $('fpToast').textContent = '';
      const card = document.createElement('div');
      card.id = 'fpCard';
      card.className = 'fp-card';
      card.innerHTML =
        '<div class="fp-head">' +
        '<span class="fp-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="5.2"/><path d="M12 9.5V14.5M9.5 12H14.5"/></svg></span>' +
        '<div><div class="fp-title" data-i18n="fp.title">' + t('fp.title') + '</div>' +
        '<div class="fp-sub" data-i18n="fp.sub">' + t('fp.sub') + '</div></div>' +
        '</div>';
      card.appendChild(renderFingerprint(msg.payload.fingerprint));
      const actions = document.createElement('div');
      actions.className = 'fp-actions';
      const yes = document.createElement('button');
      yes.className = 'primary';
      yes.textContent = t('fp.match');
      yes.setAttribute('data-i18n', 'fp.match');
      const dontMatch = document.createElement('button');
      dontMatch.className = 'danger';
      dontMatch.textContent = t('fp.mismatch');
      dontMatch.setAttribute('data-i18n', 'fp.mismatch');
      actions.appendChild(yes);
      actions.appendChild(dontMatch);
      card.appendChild(actions);
      const confirmed = document.createElement('div');
      confirmed.className = 'fp-confirmed';
      confirmed.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.6 4.6L19 7.5"/></svg>' +
        '<span data-i18n="fp.verified">' + t('fp.verified') + '</span>';
      card.appendChild(confirmed);
      $('fpToast').appendChild(card);

      yes.addEventListener('click', async () => {
        const res = await sendToOffscreen('verifyFingerprint', { username: msg.payload.username });
        if (res && res.ok) {
          setTrustVerified(true);
          $('fpToast').classList.add('hidden');
          $('fpToast').textContent = '';
          refreshContacts(); // Paket 4: onay sonrası adres defteri rozeti anında "doğrulanmış" olur
        } else {
          showTempError((res && res.error) ? errorText(res.error) : t('err.verificationFailed'));
        }
      });
      dontMatch.addEventListener('click', async () => {
        const res = await sendToOffscreen('rejectFingerprint', { username: msg.payload.username });
        setTrustVerified(false);
        $('fpToast').classList.add('hidden');
        $('fpToast').textContent = '';
        showTempError(t('fp.mismatchEnded'));
      });
      break;
    case 'error':
      setStatus(t('status.error'), 'error');
      showTempError(errorText(msg.payload.message));
      break;
    case 'codeUsed':
      refreshSessions();
      break;
    case 'status':
      if (msg.payload.status === 'error') showTempError(t('err.connectionError') + msg.payload.detail);
      refreshSessions();
      break;
    case 'deleted':
      markDeleted(msg.payload.mid);
      break;
    case 'recallAck':
      markRecallAcked(msg.payload.mid);
      break;
    case 'delivered': {
      const midEl = document.querySelector('#chatMessages .msg[data-mid="' + msg.payload.mid + '"] .msg-status');
      if (midEl) midEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 13l4.5 4.5L20.5 6"/><path d="M10.5 13.5 15 18.5 20.5 13"/></svg>';
      break;
    }
    case 'read': {
      const midEl = document.querySelector('#chatMessages .msg[data-mid="' + msg.payload.mid + '"] .msg-status');
      if (midEl) midEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 13l4.5 4.5L20.5 6"/><path d="M10.5 13.5 15 18.5 20.5 13" stroke="var(--trust-deep)"/></svg>';
      break;
    }
    case 'fileOffer': {
      const p = msg.payload;
      addFileCard(p.mid, p.name, p.size, p.type, p.from, 'in');
      if (activePeer && p.from !== activePeer) {
        if (!window.__unread) window.__unread = {};
        window.__unread[p.from] = (window.__unread[p.from] || 0) + 1;
        renderTabs();
      }
      break;
    }
    case 'fileProgress':
      updateFileCard(msg.payload.mid, { percent: Math.round(((msg.payload.idx + 1) / (msg.payload.total || 1)) * 100) });
      break;
    case 'fileComplete': {
      const p = msg.payload;
      if (!window.__fileUrls) window.__fileUrls = {};
      const url = URL.createObjectURL(new Blob([p.bytes]));
      window.__fileUrls[p.mid] = url;
      updateFileCard(p.mid, { complete: true, url });
      break;
    }
    case 'fileDeclined':
      updateFileCard(msg.payload.mid, { note: t('file.declined'), noteKey: 'file.declined', danger: true });
      break;
    case 'fileSent':
      updateFileCard(msg.payload.mid, { note: t('file.sent'), noteKey: 'file.sent' });
      break;
    case 'fileAck':
      updateFileCard(msg.payload.mid, { note: t('file.complete'), noteKey: 'file.complete' });
      break;
    case 'voiceMessage': {
      const p = msg.payload;
      addVoiceChip(p.mid, p.bytes, p.mime, 'in');
      if (p.from && activePeer && p.from !== activePeer) {
        if (!window.__unread) window.__unread = {};
        window.__unread[p.from] = (window.__unread[p.from] || 0) + 1;
        renderTabs();
      }
      break;
    }
    case 'voiceSent': {
      const el = document.querySelector('#chatMessages .msg[data-mid="' + msg.payload.mid + '"] .msg-status');
      if (el) el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 13l4.5 4.5L20.5 6"/><path d="M10.5 13.5 15 18.5 20.5 13"/></svg>';
      break;
    }
    case 'callSignal': {
      const p = msg.payload;
      const call = window.__call;
      if (p.c === 'request') {
        if (call) { // meşgul: offscreen otomatik reject gönderdi
          return;
        }
        $('callPeer').textContent = p.from;
        callUiPhase('incoming', p.mode);
        window.__call = { callId: p.callId, username: p.from, mode: p.mode, pc: null, localStream: null, remoteStream: null, phase: 'incoming', pendingIce: [] };
        window.__callPendingDesc = p.desc;
      } else if (p.c === 'answer') {
        if (call && call.callId === p.callId && call.phase === 'outgoing') {
          call.phase = 'active';
          callUiPhase('active', call.mode);
          startCallTimer();
          awaitRemoteAnswer(call, p.desc);
        }
      } else if (p.c === 'ice') {
        if (call && call.callId === p.callId) {
          if (call.pc && call.pc.remoteDescription) {
            try { call.pc.addIceCandidate(p.candidate).catch(() => {}); } catch (e) {}
          } else {
            call.pendingIce.push(p.candidate);
          }
        }
      } else if (p.c === 'reject') {
        showTempError(t('call.endedNote'));
        teardownCall();
      }
      break;
    }
    case 'callEnded':
      teardownCall();
      break;
    case 'callBlocked':
      showTempError(t('err.callBlocked'));
      break;
    case 'expired':
      removeMessageBubble(msg.payload.mid);
      break;
    case 'chatTimer':
      if (msg.payload && typeof msg.payload.seconds === 'number') {
        $('chatTimerSelect').value = String(msg.payload.seconds);
      }
      break;
    case 'panic':
      clearPopupExpiryState();
      $('chatMessages').textContent = '';
      clearFileCards();
      stopActiveRecording();
      clearVoiceDraft();
      clearVoiceCards();
      teardownCall();
      $('chatTimerSelect').value = '0';
      $('expirySelect').value = '0';
      clearInterval(codeCountdownTimer);
      $('codeCountdown').hidden = true;
      renderQr('');
      showDecoy();
      break;
    case 'reset':
      clearPopupExpiryState();
      activePeer = null;
      window.__unread = {};
      $('chatMessages').textContent = '';
      clearFileCards();
      stopActiveRecording();
      clearVoiceDraft();
      clearVoiceCards();
      teardownCall();
      $('chatPeer').textContent = t('chat.peer');
      $('chatTimerSelect').value = '0';
      $('expirySelect').value = '0';
      $('myPeerId').textContent = msg.payload.peerId;
      $('generatedCode').textContent = '—';
      clearInterval(codeCountdownTimer);
      $('codeCountdown').hidden = true;
      renderQr('');
      setStatus(t('status.online'), 'online');
      showPanel('connect');
      refreshSessions();
      refreshContacts();
      break;
  }
});

async function awaitRemoteAnswer(call, desc) {
  if (desc) {
    await call.pc.setRemoteDescription(desc);
    for (const cand of call.pendingIce.splice(0)) {
      try { call.pc.addIceCandidate(cand).catch(() => {}); } catch (e) {}
    }
  }
}

async function answerCall(accept) {
  const call = window.__call;
  if (!call || call.phase !== 'incoming') return;
  if (!accept) {
    sendToOffscreen('callSignal', { username: call.username, callId: call.callId, c: 'reject' });
    teardownCall();
    return;
  }
  let localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia(call.mode === 'video' ? { audio: true, video: true } : { audio: true });
  } catch (e) {
    showTempError(t('err.micDenied'));
    sendToOffscreen('callSignal', { username: call.username, callId: call.callId, c: 'reject' }).catch(() => {});
    teardownCall();
    return;
  }
  call.localStream = localStream;
  if ($('localVideo')) $('localVideo').srcObject = localStream;
  const pc = createCallPeerConnection({
    iceServers: [],
    onIce: (candidate) => {
      const c2 = window.__call;
      if (c2 && c2.phase !== 'closed') sendToOffscreen('callSignal', { username: c2.username, callId: c2.callId, c: 'ice', candidate });
    },
    onTrack: (stream) => {
      const c2 = window.__call;
      if (c2 && c2.phase !== 'closed') {
        c2.remoteStream = stream;
        if ($('remoteVideo')) { $('remoteVideo').srcObject = stream; $('remoteVideo').play().catch(() => {}); }
      }
    },
    onFail: () => { showTempError(t('call.unsupported')); teardownCall(); },
  });
  if (!pc) return;
  call.pc = pc;
  attachLocalTracks(pc, localStream);
  await pc.setRemoteDescription(window.__callPendingDesc);
  for (const cand of call.pendingIce.splice(0)) { try { pc.addIceCandidate(cand).catch(() => {}); } catch (e) {} }
  window.__callPendingDesc = null;
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  call.phase = 'active';
  callUiPhase('active', call.mode);
  startCallTimer();
  sendToOffscreen('callSignal', { username: call.username, callId: call.callId, c: 'answer', desc: answer.toJSON() });
}

$('callAcceptBtn').addEventListener('click', () => answerCall(true));
$('callRejectBtn').addEventListener('click', () => answerCall(false));
$('callEndBtn').addEventListener('click', () => {
  const call = window.__call;
  if (!call) return;
  sendToOffscreen('callSignal', { username: call.username, callId: call.callId, c: 'end' });
  teardownCall();
});
$('callMuteBtn').addEventListener('click', () => {
  const call = window.__call;
  if (!call || !call.localStream) return;
  const mic = call.localStream.getAudioTracks()[0];
  if (mic) { mic.enabled = !mic.enabled; $('callMuteBtn').textContent = t(mic.enabled ? 'call.mute' : 'call.unmute'); }
});
$('callVideoToggleBtn').addEventListener('click', () => {
  const call = window.__call;
  if (!call || !call.localStream) return;
  const vid = call.localStream.getVideoTracks()[0];
  if (vid) { vid.enabled = !vid.enabled; $('callVideoToggleBtn').textContent = t(vid.enabled ? 'call.videoOff' : 'call.videoOn'); if ($('localVideo')) $('localVideo').style.opacity = vid.enabled ? '1' : '0.25'; }
});

function errorText(e) {
  if (typeof e === 'string' && e.indexOf('error.') === 0) return t(e);
  return e || t('err.sendFailed');
}

function showTempError(text) {
  let el = document.querySelector('.error');
  const host = $('loginView').classList.contains('hidden') ? $('mainView') : $('loginView');
  if (!el) {
    el = document.createElement('div');
    el.className = 'error';
    host.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
  el.textContent = text;
}

/* --- kopyala --- */
function flashCopied(btn, backup) {
  const prev = btn.textContent;
  btn.textContent = t('code.copied');
  btn.style.color = 'var(--trust-deep)';
  btn.style.borderColor = 'var(--trust-line)';
  btn.style.background = 'var(--trust-bg)';
  setTimeout(() => {
    btn.textContent = prev;
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.style.background = '';
  }, 1400);
}

$('copyCodeBtn').addEventListener('click', () => {
  const v = $('generatedCode').textContent.trim();
  if (!v || v === '—') return;
  navigator.clipboard.writeText(v).then(() => flashCopied($('copyCodeBtn'))).catch(() => {});
});

/* --- giriş --- */
function readNetworkConfig() {
  const cfg = {};
  const host = $('netHost') && $('netHost').value.trim();
  if (host) {
    cfg.host = host;
    const port = $('netPort') && $('netPort').value.trim();
    if (port) cfg.port = Number(port);
    const path = $('netPath') && $('netPath').value.trim();
    if (path) cfg.path = path;
  }
  const iceRaw = $('netIce') && $('netIce').value.trim();
  if (iceRaw) {
    try {
      const parsed = JSON.parse(iceRaw);
      if (Array.isArray(parsed)) cfg.iceServers = parsed;
    } catch (e) {
      /* geçersiz JSON sessizce yoksay */
    }
  }
  return Object.keys(cfg).length ? cfg : undefined;
}

$('loginBtn').addEventListener('click', async () => {
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = t('app.busy');
  const network = readNetworkConfig();
  const res = await sendToOffscreen('initPeer', { network });
  if (res.ok) {
    $('myPeerId').textContent = res.peerId;
    showView('main');
    showPanel('connect');
    $('chatPeer').textContent = t('chat.peer');
    setStatus(t('status.online'), 'online');
    refreshContacts();
  } else {
    showTempError(errorText(res.error) === t('err.sendFailed') ? t('err.initFailed') : errorText(res.error));
  }
  $('loginBtn').disabled = false;
  $('loginBtn').textContent = t('app.start');
});

/* --- bağlan (karşı tarafın kodunu gir) --- */
async function attemptConnect(code) {
  const text = (code || '').trim();
  if (!text) {
    showTempError(t('err.noCode'));
    return;
  }
  if (/^[a-z2-7]{20}$/.test(text)) {
    showTempError(t('err.isAddress'));
    return;
  }
  const btn = $('connectBtn');
  btn.disabled = true;
  btn.textContent = t('connect.busy');
  $('safetyInfo').classList.remove('hidden');
  const res = await sendToOffscreen('connectCode', { code: text });
  if (res.ok) {
    openPeer(res.peer);
    showPanel('chat');
    setStatus(t('status.connecting'), 'chatting');
    refreshSessions();
  } else {
    showTempError(res.error ? errorText(res.error) : t('err.connectFailed'));
  }
  btn.disabled = false;
  btn.textContent = t('connect.btn');
}

$('connectBtn').addEventListener('click', () => attemptConnect($('codeInput').value));

/* --- kod üret --- */
let codeCountdownTimer = null;
function renderCodeCountdown(exp) {
  const el = $('codeCountdown');
  const tick = () => {
    const left = (exp || 0) - Date.now();
    if (left <= 0) { el.textContent = t('code.expired'); el.classList.add('expired'); clearInterval(codeCountdownTimer); return; }
    el.classList.remove('expired');
    const s = Math.floor(left / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    el.textContent = t('code.validFor') + mm + ':' + ss;
  };
  el.hidden = false;
  tick();
  clearInterval(codeCountdownTimer);
  codeCountdownTimer = setInterval(tick, 1000);
}

function renderQr(text) {
  const wrap = document.querySelector('.qr-wrap');
  const canvas = $('qrCanvas');
  if (!wrap || !canvas) return;
  if (!text || text === '—' || text === '-') {
    wrap.hidden = true;
    return;
  }
  QRCode.toCanvas(canvas, text, { errorCorrectionLevel: 'M', margin: 1, width: 128 })
    .then(() => { wrap.hidden = false; })
    .catch(() => { wrap.hidden = true; });
}

$('genCodeBtn').addEventListener('click', async () => {
  const res = await sendToOffscreen('generateCode');
  if (res.ok) {
    $('generatedCode').textContent = res.code;
    renderQr(res.code);
    if (res.exp) renderCodeCountdown(res.exp);
    activePeer = null;
    $('copyCodeBtn').textContent = t('code.copy');
    $('chatPeer').textContent = t('chat.peer');
  } else {
    showTempError(res.error ? errorText(res.error) : t('err.genFailed'));
  }
});

/* --- sohbet --- */
$('sendBtn').addEventListener('click', sendMessage);
$('messageInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});
// Paket 6: her dokunuşta 1 sn debounce ile "yazıyor…" sinyali (fire-and-forget)
let _typingDebounce = null;
$('messageInput').addEventListener('input', () => {
  if (_typingDebounce) clearTimeout(_typingDebounce);
  _typingDebounce = setTimeout(() => {
    if (activePeer) sendToOffscreen('sendTyping', { username: activePeer });
  }, 1000);
});

/* --- paket 4: dosya paylaşımı --- */
$('fileBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', async () => {
  const f = $('fileInput').files && $('fileInput').files[0];
  $('fileInput').value = '';
  if (!f) return;
  if (!activePeer) {
    showTempError(t('err.openChatFirst'));
    return;
  }
  try {
    const bytes = await f.arrayBuffer();
    const res = await sendToOffscreen('sendFileOffer', { username: activePeer, name: f.name, mime: f.type, bytes });
    if (res && res.ok) {
      addFileCard(res.mid, f.name, bytes.byteLength, f.type, activePeer, 'out');
    } else {
      showTempError((res && res.error) ? errorText(res.error) : t('err.fileSendFailed'));
    }
  } catch (e) {
    showTempError(t('err.fileRead') + errorText(e.message));
  }
});

// Paket 3: sohbet düzeyi otomatik yok etme süresi seçici
$('chatTimerSelect').addEventListener('change', () => {
  if (!activePeer) return;
  const seconds = parseInt($('chatTimerSelect').value || '0', 10);
  sendToOffscreen('setChatTimer', { username: activePeer, seconds });
});

/* --- paket read: per-sohbet okundu kapatma --- */
const readAckBtn = $('readAckBtn');
function renderReadToggle() {
  if (!readAckBtn) return; // buton yoksa (eski/özelleştirilmiş panel) güvenli no-op
  const off = !!window.__readAckOff[activePeer];
  readAckBtn.textContent = t(off ? 'chat.readOff' : 'chat.readOn');
  readAckBtn.classList.toggle('off', off);
  readAckBtn.setAttribute('aria-pressed', String(!off));
  readAckBtn.title = t(off ? 'chat.readTitleOff' : 'chat.readTitle');
}
if (readAckBtn) {
  readAckBtn.addEventListener('click', () => {
    if (!activePeer) return;
    window.__readAckOff[activePeer] = !window.__readAckOff[activePeer];
    renderReadToggle();
  });
  renderReadToggle();
}

async function sendMessage() {
  if (!activePeer) return;
  const text = $('messageInput').value.trim();
  if (!text) return;
  const expiryEl = $('expirySelect');
  const expSeconds = parseInt((expiryEl && expiryEl.value) || '0', 10);
  const res = await sendToOffscreen('sendMessageTimed', { username: activePeer, text, expSeconds });
  if (res.ok) {
    const mid = (res && res.mid) || null;
    addMessage(text, 'ben', 'out', mid, Date.now());
    if (mid) {
      if (!window.__sentMids) window.__sentMids = {};
      window.__sentMids[mid] = { ts: Date.now() };
      if (expSeconds) {
        if (!window.__expiryMids) window.__expiryMids = {};
        window.__expiryMids[mid] = expSeconds;
        if (!window.__expiryTimers) window.__expiryTimers = {};
        window.__expiryTimers[mid] = setTimeout(() => removeMessageBubble(mid), expSeconds * 1000);
      }
    }
    $('messageInput').value = '';
  } else {
    showTempError(errorText(res.error));
  }
}

/* --- sekmeler --- */
$('tabConnect').addEventListener('click', () => showPanel('connect'));
$('tabCode').addEventListener('click', () => showPanel('code'));
$('tabChat').addEventListener('click', () => showPanel('chat'));

/* --- kimlik sıfırlama --- */
function openResetModal() {
  $('resetModal').classList.remove('hidden');
}
function closeResetModal() {
  $('resetModal').classList.add('hidden');
}
async function confirmReset() {
  closeResetModal();
  const res = await sendToOffscreen('resetIdentity');
  if (res && res.ok) {
    activePeer = null;
    trustVerified = false;
    $('chatMessages').textContent = '';
    $('chatPeer').textContent = t('chat.peer');
    $('myPeerId').textContent = res.peerId;
    $('generatedCode').textContent = '—';
    clearInterval(codeCountdownTimer);
    $('codeCountdown').hidden = true;
    renderQr('');
    setStatus(t('status.online'), 'online');
    showPanel('connect');
  } else {
    showTempError(errorText(res && res.error) === t('err.sendFailed') ? t('err.resetFailed') : errorText(res && res.error));
  }
}
$('resetIdentityBtn').addEventListener('click', openResetModal);
$('resetCancelBtn').addEventListener('click', closeResetModal);
$('resetConfirmBtn').addEventListener('click', confirmReset);

/* --- paket 3: panik modu + tuzak ekran --- */
$('panicBtn').addEventListener('click', () => {
  sendToOffscreen('panic', {});
  showDecoy();
});
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
    sendToOffscreen('panic', {});
    showDecoy();
  }
});
function showDecoy() {
  $('loginView').classList.add('hidden');
  $('mainView').classList.add('hidden');
  $('decoyView').hidden = false;
}
$('decoyRestartBtn').addEventListener('click', () => {
  $('decoyView').hidden = true;
  sendToOffscreen('resetIdentity', {}).then(() => {
    showView('main');
    showPanel('connect');
  });
});

/* --- paket QR: kamera ile kod okuma --- */
let scanStream = null;
let scanDetector = null;
let scanRaf = 0;
let scanActive = false;

async function startScan() {
  if (scanActive) return; // çift tıklama: kamera zaten açılıyor/açık
  scanActive = true; // await penceresi boyunca yeniden girişe karşı erken kilit
  try {
    if (!('BarcodeDetector' in window)) { scanActive = false; return; } // gerileme: buton zaten gizli
    scanDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (e) {
    scanActive = false;
    showTempError(t('err.cameraDenied'));
    return;
  }
  $('scanModal').classList.remove('hidden');
  $('scanVideo').srcObject = scanStream;
  scanActive = true;
  const tick = () => {
    if (!scanActive) return;
    scanDetector.detect($('scanVideo')).then((codes) => {
      if (codes && codes[0] && codes[0].rawValue) {
        closeScan();
        $('codeInput').value = codes[0].rawValue;
        attemptConnect(codes[0].rawValue);
      } else if (scanActive) {
        scanRaf = requestAnimationFrame(tick);
      }
    }).catch(() => { if (scanActive) scanRaf = requestAnimationFrame(tick); });
  };
  scanRaf = requestAnimationFrame(tick);
}

function closeScan() {
  scanActive = false;
  cancelAnimationFrame(scanRaf);
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  $('scanModal').classList.add('hidden');
  const v = $('scanVideo');
  if (v) v.srcObject = null;
}

$('scanBtn').addEventListener('click', startScan);
$('scanCancelBtn').addEventListener('click', closeScan);
$('scanModal').addEventListener('click', (e) => { if (e.target === $('scanModal')) closeScan(); });

/* --- paket 3: ekran maskeleme (blur) + kopyalama engeli --- */
let screenMasked = false;
function applyMask(masked) {
  screenMasked = masked;
  const mask = $('screenMask');
  if (mask) mask.hidden = !masked;
}
window.addEventListener('blur', () => applyMask(true));
window.addEventListener('focus', () => applyMask(false));
document.addEventListener('contextmenu', (e) => { if (screenMasked) e.preventDefault(); });

// init tepeye, setStatus öncesi:
$('langSelect').value = getLang();
applyI18n(document);
// chatMessages data-empty senkronu:
const chatEl = $('chatMessages');
if (chatEl && chatEl.dataset.empty) chatEl.dataset.empty = t(chatEl.dataset.empty);

$('langSelect').addEventListener('change', () => {
  setLang($('langSelect').value);
  $('chatMessages').dataset.empty = t('chat.empty');
  $('langSelect').value = getLang();
  applyI18n(document);
  // statik süpürme canlı değerleri (peer adı, durum rozeti) statik anahtarlarla ezdi —
  // süpürme sonrası dinamik durumu geri yükle.
  if (activePeer) $('chatPeer').textContent = activePeer;
  renderReadToggle();
  setStatusToConnection();
});

setStatus(t('status.offline'));
initTheme();
refreshContacts();
if (!('BarcodeDetector' in window)) $('scanBtn').classList.add('hidden');
window.addEventListener('beforeunload', teardownCall);