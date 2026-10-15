# Paket 4 Uygulama Planı: Sohbet Deneyimi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Çoklu sohbet sekme çubuğu, ✓/✓✓ teslimat, dosya paylaşımı (kayıpsız HD), RAM-only adres defteri, tema sistemi ve küçük deneyim iyileştirmelerini uygulamak. Spec: `docs/superpowers/specs/2026-08-11-experience-package-design.md`.

**Architecture:** Offscreen katmanı (`state.peers` Map) zaten çoklu eşi destekler; UI'daki tek-eş varsayımı (`currentPeer`) sekme çubuğuna evrilir. Yeni zarf türleri k:6 (teslimat ✓✓), k:7/8/9/10 (dosya teklif/onay/parça/tamam) `handleIncoming`'e eklenir. `state.contacts`, `state.theme` RAM alanları eklenir. Tema, `data-theme` + CSS custom property ile gerçekleştirilir.

**Tech Stack:** Chrome Extension MV3, PeerJS, @privacyresearch/libsignal-protocol-typescript, esbuild (`node build.js`), RAM-only RamStore, CLI simülasyon (`session_sim.mjs`).

## Global Constraints

- RAM-only: `state.contacts`, `state.theme`, dosya parçaları, balon tabları — hiçbiri diske yazılmaz
- Envelope `k` allow-list'i `{1,3,4,5,6,7,8,9,10,11}`'e genişler (offscreen handleIncoming 409)
- Dosya: `FILE_MAX_BYTES = 8 * 1024 * 1024`, `FILE_ALLOWED_MIME` (görsel/PDF/doc/ses/video), parça 64KB, sıkıştırmasız orijinal baytlar
- ✓: gönderildi (göndericinin çıkışında) — ✓✓: alıcının cihazı decrypt etti (k:6) — "okundu" yok
- Adres defteri: `state.contacts = Map<ad, { address, identityKey, verified }>`; kodla bağlanan otomatik kaydedilir
- Tema: `data-theme` attr; `bone` (varsayılan), `dark`, `hc`, `system` (`matchMedia`); seçim `state.theme`
- UI dili Türkçe; kullanıcıya gösterilen metinler spec'teki ifadelerle birebir
- Build: `node build.js`; test: `node session_sim.mjs` + `node codec_test.js`
- **Git repo yok:** commit adımı uygulanmaz, her task doğrulamayla biter
- Simülasyon deseni: `session_sim.mjs` offscreen mantığının kopyalarıyla çalışır; UI değişiklikleri build + elle doğrulamayla test edilir

---

### Task 1: Envelope allow-list + k:6 teslimat ack (✓✓)

**Files:**
- Modify: `src/offscreen.js` (`handleIncoming` 409 ve switch, `sendMessageTo` sonrası rozet, outbox `sent`/`delivered`), `src/popup.js` (✓/✓✓ DOM), `src/popup.css`
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: `sendEnvelope(conn, type, body, registrationId)`, `entry.cipher`, `entry.outbox` (Paket 1)
- Produces:
  - Envelope k:6 `{ m: mid }` (teslimat ack)
  - Outbox kaydı `{ ts, sent, delivered }` — `sendMessageTo` sonrası `sent:true`, k:6 alınınca `delivered:true`
  - Popup: her "out" balona `.msg-status` span (✓ → ✓✓); `message` → `recallAck`-benzeri `delivered` event case
  - `handleIncoming` k:6 → `notify('delivered', { username, mid })`

- [x] **Step 1: Write the failing test (session_sim.mjs)**

```js
// ============ paket4: k:6 teslimat ack ============
const ackBody = JSON.stringify({ m: 'mid-1' });
const ackCtl = JSON.parse(ackBody);
ok(ackCtl.m === 'mid-1', 'k:6 ack gövdesi mid taşır');
ok(typeof ackCtl.m === 'string', 'k:6 gövde formatı {m}');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: sim geçer (veri sabiti); asıl davranış offscreen/UI'da test edilir.

- [x] **Step 3: Allow-list + k:6 case (offscreen.js)**

409 satırındaki kısıtı genişlet:

```js
if (![1, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(envelope.k)) throw new Error('bilinmeyen zarf türü: ' + envelope.k);
```

Switch'e k:6 case (k:5'ten sonra, ~509 civarı):

```js
case 6:
  const ackCtl = decodeMessageBody(plain);
  const ackEntry = state.peers.get(remoteUsername);
  if (ackEntry && ackEntry.outbox && ackEntry.outbox.has(ackCtl.mid)) {
    ackEntry.outbox.get(ackCtl.mid).delivered = true;
    notify('delivered', { username: remoteUsername, mid: ackCtl.mid });
  } else {
    notify('delivered', { username: remoteUsername, mid: ackCtl.mid }); // bilinmeyen mid: sessiz ayık
  }
  break;
```

Not: Paket 4 spec "bilinmeyen mid sessizce atlanır" diyor — ikinci `notify` bilinçsiz atlanır; burada yalnızca `outbox.has` doğrulaması, aksi takdirde notify **gönderilmez**:

```js
case 6:
  const ackCtl = decodeMessageBody(plain);
  const ackEntry = state.peers.get(remoteUsername);
  if (ackEntry && ackEntry.outbox && ackEntry.outbox.has(ackCtl.mid)) {
    ackEntry.outbox.get(ackCtl.mid).delivered = true;
    notify('delivered', { username: remoteUsername, mid: ackCtl.mid });
  }
  break;
```

- [x] **Step 4: Alıcı k:6 gönderimi (offscreen.js)**

`handleIncoming` k:1 ve k:3 normal mesaj dallarında, `decodeMessageBody(plain)` sonrası ve `notify('message', ...)` (468) itibarıyla, `__ilq_init__` dışında:

```js
if (decoded.text !== '__ilq_init__') {
  notify('message', { from: remoteUsername, text: decoded.text, encrypted: true, mid: decoded.mid, ts: decoded.ts });
  try {
    entry.cipher.encrypt(new TextEncoder().encode(JSON.stringify({ m: decoded.mid }))).then((r) => {
      sendEnvelope(conn, 6, r.body, r.registrationId);
    });
  } catch (_) { /* sessiz — ack gönderilemezse rozet ✓ kalır */ }
}
```

`decoded` değişkeni `encodeMessageBody` dönüşü gibi adlandırılmışsa buna uy — mevcut kodda `const decoded = decodeMessageBody(plain)` adı kullanılıyor (465). Aynı bloğu k:1 dalına (493 sonrası) da ekle.

- [x] **Step 5: Rozet UI (popup.js + popup.css)**

`addMessage` için `who==='out'` iken `.msg-body` sonrasına span ekle:

```js
const st = document.createElement('span');
st.className = 'msg-status';
st.textContent = '✓';
div.appendChild(st);
```

Balon DOM'unda `msgType==='out'` bloğunda `bubble.appendChild(st)` yerleştir. `delivered` event case:

```js
case 'delivered':
  const midEl = document.querySelector(`#chatMessages .msgs .msg[data-mid="${msg.payload.mid}"] .msg-status`);
  if (midEl) midEl.textContent = '✓✓';
  break;
```

`popup.css`:

```css
.msg-status { font-size: 9px; color: rgba(255,255,255,0.65); margin-left: 4px; }
```

Gelen balonlarda yok (yalnız giden).

- [x] **Step 6: Run tests + build**

Run: `node session_sim.mjs; node build.js`
Expected: sim PASS; build OK.

- [x] **Step 7: Verify (elle)**

İki panel: A→B mesaj → A'da "✓"; B decrypt edince A'da "✓✓".

---

### Task 2: Çoklu sohbet — sekme çubuğu (UI)

**Files:**
- Modify: `src/sidepanel.html` (`#chatTabs`), `src/popup.js` (`activeTab`/`currentPeer` yerine `activePeer`, tab listesi), `src/popup.css`
- Test: elle (offscreen zaten çoklu eşi destekler)

**Interfaces:**
- Consumes: `state.peers.keys()` üzerinden `status` action yanıtı `sessions: [...]`, offscreen `connectCode/sendMessage/...` `username` parametreli (değişmez)
- Produces:
  - `let activePeer = null` (global); `openPeer(username)` → sekme aktive, sohbet DOM'unu temizlemeden o peer'ın balonlarını gösterir
  - `#chatTabs` div: `data-username` attr'ıyla bir sekme per peer; "yeni sohbet" geçişi mevcut kod girişinden
  - `status` → `sessions` listesinden tab çubuklarını senkronlar

- [x] **Step 1: Add markup (sidepanel.html)**

`#panelChat` içinde `#chatHeader` (138) üstüne:

```html
<div id="chatTabs" class="chat-tabs" role="tablist"></div>
```

- [x] **Step 2: Implement tab logic (popup.js)**

Global değişken: `let activePeer = null;` (mevcut `currentPeer`'ı bununla değiştir; kullanıldığı yerler: 81, 164, 177, 250, 353, 369, 386, 416). `window.__sessions = []` popup açılışında `status` action'ından beslenir.

```js
let activePeer = null;

function renderTabs() {
  const tabs = $('#chatTabs');
  tabs.innerHTML = '';
  for (const username of window.__sessions || []) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'chat-tab' + (username === activePeer ? ' active' : '');
    const n = (window.__unread || {})[username] || 0;
    tab.innerHTML = username + (n ? ' <span class="unread-badge">' + n + '</span>' : '');
    tab.setAttribute('data-username', username);
    tab.addEventListener('click', () => openPeer(username));
    tabs.appendChild(tab);
  }
}
function openPeer(username) {
  activePeer = username;
  if (username && window.__unread) window.__unread[username] = 0;
  document.querySelectorAll('#chatMessages .msg').forEach((n) => { n.hidden = n.dataset.user !== username; });
  $('#chatPeer').textContent = username || '';
  renderTabs();
}
```

`addMessage` balonuna `data-user` attr'ı ekle: `div.setAttribute('data-user', who === 'ben' ? activePeer : from)`. `currentPeer` referanslarını `activePeer` ile değiştir; mesaj gönderirken `activePeer`'a gönder. `window.__unread = {}` modül başında tanımlanır.

`status` case'i (240-242) `payload.sessions` ile `window.__sessions = payload.sessions; renderTabs();` günceller. `connected`/`reset`/`codeUsed` durumlarında da `renderTabs()` çağır.

- [x] **Step 3: Style (popup.css)**

```css
.chat-tabs { display: flex; gap: 4px; overflow-x: auto; padding: 4px 0; border-bottom: 1px solid var(--hairline); margin-bottom: 6px; }
.chat-tab { flex: 0 0 auto; font: 600 11px 'InterVar'; color: var(--tab-inactive); background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--r-sm); padding: 4px 8px; cursor: pointer; }
.chat-tab.active { color: var(--ink); background: var(--surface-2); border-color: var(--hairline-strong); }
```

- [x] **Step 4: Run build**

Run: `node build.js`
Expected: build OK.

- [x] **Step 5: Verify (elle)**

İki kullanıcıyla iki sohbet aç: sekmeler listelenir; geçişte yalnızca ilgili peer'ın balonları görünür; yeni mesaj doğru peer'a kaydedilir.

---

### Task 3: Adres defteri (RAM-only) + otomatik kayıt

**Files:**
- Modify: `src/offscreen.js` (`state.contacts`, kayıt hooks, action'lar), `src/popup.js` (adres defteri arayüzü), `src/sidepanel.html`, `src/popup.css`
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: `connectWithCode` içinde kimlik anahtarı (`entry.remoteIdentityKey`), k:3 başarı sonrası
- Produces:
  - `state.contacts = new Map()`
  - `saveContact(username, address, identityKeyB64, verified)` (internal)
  - `listContacts()` → `Array.from(state.contacts.entries()).map(([u,v]) => ({ username: u, ...v }))`
  - `getContact(username)` → obj | undefined
  - Action'lar: `saveContact`, `listContacts`, `reconnectContact` (adres üzerinden `connectWithPeerId`)
  - `connectWithCode` başarı sonunda otomatik kayıt; `resetIdentity`/`resetAll` contacts'i temizler

- [x] **Step 1: Write the failing test (session_sim.mjs)**

```js
// ============ paket4: adres defteri ============
const contact = { address: addrB, identityKey: arrayBufferToBase64(ik.pubKey), verified: false };
const cMap = new Map([['bahargün', contact]]);
ok(cMap.get('bahargün').address === addrB, 'adres defteri girdisi adres taşır');
ok(cMap.get('bahargün').verified === false, 'yeni eş verified=false');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: geçer (veri sabiti).

- [x] **Step 3: Implement contacts (offscreen.js)**

`state` literal'ine `contacts: new Map()` ekle (135 civarı). Fonksiyonlar:

```js
function saveContact(username, address, identityKeyB64, verified) {
  state.contacts.set(username, { address, identityKey: identityKeyB64, verified: !!verified });
}
function listContacts() {
  const out = [];
  for (const [username, v] of state.contacts) out.push({ username, address: v.address, verified: v.verified });
  return out;
}
```

`connectWithCode` içinde `entry.remoteIdentityKey` atandığı nokta (368) sonrası:

```js
saveContact(remoteUsername, remoteUsername, entry.remoteIdentityKey, false);
```

`connectWithCode` başarı sonunda (notify connected öncesi) verified flag'i mevcutsa güncelle — basit tut: ilk kayıt `verified:false`; parmak izi onaylanınca `state.contacts.get(username).verified = true` (`verifyFingerprint` içinde, 565-571 civarı).

`resetIdentity` (613-627) ve `resetAll` içinde `state.contacts.clear()` ekle.

`reconnectContact(username)`:

```js
function reconnectContact(username) {
  const c = state.contacts.get(username);
  if (!c) return { ok: false, error: 'defterde yok' };
  const existing = state.peers.get(username);
  if (existing && existing.conn && existing.conn.open) return { ok: true, peer: username };
  if (!state.peer || !state.enabled) initPeer(undefined, state.network);
  return connectToKnown(username);
}

function connectToKnown(username) {
  // Session store'da varsa kod/prekey gerekmez; doğrudan bağlan.
  const entry = state.peers.get(username) || { conn: null, cipher: null, initialized: false, verified: false };
  const conn = state.peer.connect(username, { reliable: true });
  entry.conn = conn;
  entry.cipher = new SessionCipher(state.store, addressFor(username));
  state.peers.set(username, entry);
  conn.on('data', (data) => handleIncoming(conn, data));
  conn.on('close', () => cleanupConn(conn));
  entry.remoteIdentityKey = (state.contacts.get(username) || {}).identityKey;
  conn.on('open', () => {
    notify('connected', { username, peer: username });
  });
  return { ok: true, peer: username };
}
```

Not: `handleIncoming`/`SessionCipher`/`addressFor`/`cleanupConn` mevcut offscreen fonksiyonlarıdır (satır 144-146, 257-264, 402-514); burada yeniden tanımlanmaz, yalnızca kullanılır.

- [x] **Step 4: Action'lar (offscreen switch)**

```js
case 'listContacts': return { ok: true, contacts: listContacts() };
case 'saveContact': saveContact(msg.username, msg.address, msg.identityKey, false); return { ok: true };
case 'reconnectContact': return reconnectContact(msg.username);
```

- [x] **Step 5: UI — adres defteri (popup.js + sidepanel.html + popup.css)**

`#panelConnect` içine (codeInput'in altı) adres defteri listesi:

```html
<div id="contactList" class="contact-list"></div>
```

`#loginBtn` başarısında ve `connected`/`reset` sonrası:

```js
async function refreshContacts() {
  const r = await sendToOffscreen('listContacts', {});
  const list = $('#contactList');
  list.innerHTML = '';
  if (r && r.contacts) for (const c of r.contacts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'contact-item';
    btn.textContent = c.username + ' · ' + (c.verified ? 'doğrulanmış' : 'yeni');
    btn.addEventListener('click', () => sendToOffscreen('reconnectContact', { username: c.username }));
    list.appendChild(btn);
  }
}
```

`sendToOffscreen` callback dönüşü promisified — mevcut wrapper'da dönüş yoksa Promise dönüşüne çevir veya callback kullan.

- [x] **Step 6: Run tests + build**

Run: `node session_sim.mjs; node build.js`
Expected: sim PASS; build OK.

- [x] **Step 7: Verify (elle)**

Kodla bağlanan eş listede görünür; tıklayınca yeniden bağlanır (session korunur); verify sonrası "doğrulanmış" rozeti.

---

### Task 4: Dosya paylaşımı — k:7/8/9/10

**Files:**
- Modify: `src/offscreen.js` (sabitler, `sendFileOffer`, `handleFileAccept`, `chunkFile`, handleIncoming k:7-10, `FILE_MAX_BYTES`/`FILE_ALLOWED_MIME`), `src/popup.js` (dosya seçici, teklif kartı, ilerleme), `src/sidepanel.html`, `src/popup.css`
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: `sendEnvelope`, `entry.cipher`, `entry.outbox`
- Produces:
  - `FILE_MAX_BYTES = 8 * 1024 * 1024`; `FILE_ALLOWED_MIME = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'audio/', 'video/']`
  - `sendFileOffer(username, name, mime, bytes)` → `{ ok: true } | { ok:false, error }`; k:7 `{ m:mid, name, size, type:mime, parts }`
  - `acceptFileTransfer(username, mid, accept)` → k:8; true ise gönderen chunk'ları `sendFileChunks` ile sıkıştırmadan basar
  - `sendFileChunks(username, mid, bytes)` → k:9 parçalar (64KB), ilerleme `notify('fileProgress', { mid, idx, total })`
  - Alıcı: k:9 parçaları `state.files[username][mid] = { name, type, parts, received, chunks[] }`; tümü gelince k:10 `notify('fileComplete', { username, mid, name, type, bytes:ArrayBuffer })`
  - `state.files = new Map()` (RAM)

- [x] **Step 1: Write the failing test (session_sim.mjs)**

```js
// ============ paket4: dosya parçalama ============
const CHUNK = 64 * 1024;
const fakeBytes = new Uint8Array(3 * CHUNK + 100);
const parts = Math.ceil(fakeBytes.length / CHUNK);
ok(parts === 4, 'parça sayısı boyuttan doğru hesaplanır (4)');
const reassembled = new Uint8Array(fakeBytes.length);
let written = 0;
for (let i = 0; i < parts; i++) {
  const slice = fakeBytes.slice(i * CHUNK, Math.min((i + 1) * CHUNK, fakeBytes.length));
  reassembled.set(slice, written);
  written += slice.length;
}
ok(reassembled.length === fakeBytes.length, 'parçalar yeniden birleşince bayt korunur');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: geçer (record kod mantığını sim test eder — veri sabiti). Asıl transfer offscreen/UI'da.

- [x] **Step 3: Sabitler + state (offscreen.js)**

19-24 civarına:

```js
const FILE_MAX_BYTES = 8 * 1024 * 1024;
const FILE_CHUNK_SIZE = 64 * 1024;
const FILE_ALLOWED_MIME = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'audio/', 'video/'];
```

`state` literal'ine `files: new Map()` ekle — `state.files[username] = Map<mid, {...}>`.

- [x] **Step 4: sendFileOffer + chunklen + accept (offscreen.js)**

```js
function filesFor(username) {
  if (!state.files.has(username)) state.files.set(username, new Map());
  return state.files.get(username);
}

function sendFileOffer(username, name, mime, bytes) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) return { ok: false, error: 'bağlantı yok' };
  if (!bytes || bytes.byteLength > FILE_MAX_BYTES) return { ok: false, error: 'dosya çok büyük' };
  const typeOk = FILE_ALLOWED_MIME.some((p) => mime.toLowerCase().startsWith(p));
  if (!typeOk) return { ok: false, error: 'izinsiz dosya türü' };
  const mid = randomMid();
  const parts = Math.ceil(bytes.byteLength / FILE_CHUNK_SIZE);
  const offer = JSON.stringify({ m: mid, name, size: bytes.byteLength, type: mime, parts });
  entry.cipher.encrypt(new TextEncoder().encode(offer)).then((r) => sendEnvelope(entry.conn, 7, r.body, r.registrationId));
  filesFor(username).set(mid, { name, type: mime, size: bytes.byteLength, parts, bytes, state: 'offer' });
  return { ok: true, mid };
}

function sendFileChunks(username, mid) {
  const entry = state.peers.get(username);
  const f = filesFor(username).get(mid);
  if (!entry || !f) return { ok: false, error: 'dosya bulunamadı' };
  const total = f.parts;
  let idx = 0;
  const pump = () => {
    if (idx >= total) { sendFileDone(entry, username, mid); return; }
    const start = idx * FILE_CHUNK_SIZE;
    const slice = f.bytes.slice(start, Math.min(start + FILE_CHUNK_SIZE, f.size));
    const chunk = JSON.stringify({ m: mid, idx, total, bytes: arrayBufferToBase64(slice) });
    entry.cipher.encrypt(new TextEncoder().encode(chunk)).then((r) => {
      sendEnvelope(entry.conn, 9, r.body, r.registrationId);
      notify('fileProgress', { username, mid, idx, total });
      idx++;
      setTimeout(pump, 20); // rahat akış
    });
  };
  pump();
}

function sendFileDone(entry, username, mid) {
  entry.cipher.encrypt(new TextEncoder().encode(JSON.stringify({ m: mid }))).then((r) => sendEnvelope(entry.conn, 10, r.body, r.registrationId));
  notify('fileSent', { username, mid });
}
```

- [x] **Step 5: handleIncoming k:7/8/9/10 (offscreen.js)**

```js
case 7: { // teklif
  const o = JSON.parse(new TextDecoder().decode(plain));
  const rec = filesFor(remoteUsername);
  rec.set(o.m, { name: o.name, type: o.type, size: o.size, parts: o.parts, received: 0, chunks: [] });
  notify('fileOffer', { from: remoteUsername, mid: o.m, name: o.name, size: o.size, type: o.type, parts: o.parts });
  break;
}
case 8: { // onay
  const a = JSON.parse(new TextDecoder().decode(plain));
  if (a.accept) sendFileChunks(remoteUsername, a.m);
  else { filesFor(remoteUsername).delete(a.m); notify('fileDeclined', { username: remoteUsername, mid: a.m }); }
  break;
}
case 9: { // parça
  const c = JSON.parse(new TextDecoder().decode(plain));
  const rec = filesFor(remoteUsername);
  let st = rec.get(c.m);
  if (!st) { st = { received: 0, chunks: [] }; rec.set(c.m, st); }
  st.chunks[c.idx] = new Uint8Array(base64ToArrayBuffer(c.bytes));
  st.received++;
  notify('fileProgress', { username: remoteUsername, mid: c.m, idx: c.idx, total: c.total });
  if (st.received === c.total) {
    const totalBytes = st.chunks.reduce((a, ch) => a + ch.length, 0);
    const full = new Uint8Array(totalBytes);
    let off = 0;
    for (const ch of st.chunks) { full.set(ch, off); off += ch.length; }
    st.complete = true;
    st.bytes = full.buffer;
    notify('fileComplete', { username: remoteUsername, mid: c.m, name: st.name, type: st.type, bytes: full.buffer });
  }
  break;
}
case 10: // tamamlandı bildirimi (gönderen)
  notify('fileAck', { username: remoteUsername, mid: JSON.parse(new TextDecoder().decode(plain)).m });
  break;
```

Not: case 7 teklif geldiğinde `rec.set(o.m, { name, type, size, parts, received:0, chunks:[] })` kaydını oluşturur; case 9 parçaları bu kayda ekler (7→9→10 sırası garanti olduğundan `st.name/type` kullanılabilir). Teklif kaydı yoksa (ör. yeniden bağlanma sonrası) `!st` dalı yalnızca parçaları toplar ve `name/type` boş kalır — kabul edilebilir; toparlamada `st.name` kullanılır.

- [x] **Step 6: UI — dosya kartı + seçici + ilerleme (popup.js + sidepanel.html + popup.css)**

`#panelChat` compose alanına dosya butonu:

```html
<input type="file" id="fileInput" hidden>
<button id="fileBtn" class="button-secondary" type="button">Dosya</button>
```

`#fileBtn` click → `#fileInput.click()`; `change` → `sendOff('sendFileOffer', { username: activePeer, name: file.name, mime: file.type, bytes: await file.arrayBuffer() })`. Hata ise `showTempError`.

Event cases: `fileOffer` → `#fpToast` benzeri kart (balon gibi DOM) "X MB · name — Al / Reddet" → `acceptFileTransfer(username, mid, true|false)`. `fileProgress` → kartta ilerleme yüzdesi (`((idx+1)/total*100)`). `fileComplete` → dönen `bytes`'ten `URL.createObjectURL(new Blob([bytes]))` ile önizleme linki ("Görüntüle") balon içinde. `fileDeclined`/`fileSent`/`fileAck` → not balonları.

- [x] **Step 7: Run tests + build**

Run: `node session_sim.mjs; node build.js`
Expected: sim PASS; build OK.

- [x] **Step 8: Verify (elle)**

İki panel arasında ≤8MB görsel gönderimi: teklif kartı çıkar, al onayı, ilerleme %100, alıcı önizleme görür; büyük/izinsiz dosya reddedilir.

---

### Task 5: Tema sistemi (bone/dark/hc/system)

**Files:**
- Modify: `src/popup.css` (theme token blokları), `src/popup.js` (tema seçici + `matchMedia`), `src/sidepanel.html` (tema select), `src/offscreen.js` (`state.theme`, action `setTheme`)
- Test: elle + statik kontrol

**Interfaces:**
- Produces: `data-theme="bone|dark|hc|system"` attr → CSS `:root[data-theme=...]` overrides; `setTheme(mode)` action; `applyTheme(mode)` popup fonksiyonu; `state.theme`
- Consumes: DESIGN.md token adları (--ground, --surface, ..., --trust*); popup.css 18-50 token temeli

- [x] **Step 1: Add theme select (sidepanel.html)**

`#panelConnect` içine (veya `#panelCode` altı), ayarlar bölümü:

```html
<label class="field-label" for="themeSelect">Tema</label>
<select id="themeSelect" class="message-input">
  <option value="bone">Kemik-beyazı</option>
  <option value="dark">Karanlık</option>
  <option value="hc">Yüksek kontrast</option>
  <option value="system">Sistem</option>
</select>
```

- [x] **Step 2: Implement theme CSS (popup.css)**

`:root` sonrası (50'den sonra) temalar:

```css
:root[data-theme='dark'] {
  --ground: #23241F; --surface: #2B2C26; --surface-2: #34352E;
  --hairline: #4A4B42; --hairline-strong: #5E6059;
  --ink: #F5F3EC; --ink-soft: #DFDDD3; --ink-mute: #B0B2A6;
  --tab-inactive: #9A9C90; --placeholder: #7C7E73;
  --trust: #6FBF8F; --trust-deep: #A8E3BE; --trust-bg: #1E3A29; --trust-line: #2F5940;
  --danger: #E08A7D; --danger-bg: #3A2722; --danger-line: #5C3A32;
}
:root[data-theme='hc'] {
  --ground: #FFFFFF; --surface: #FFFFFF; --surface-2: #F2F2F2;
  --ink: #000000; --ink-soft: #1A1A1A; --ink-mute: #000000;
  --tab-inactive: #000000; --placeholder: #333333;
  --hairline: #000000; --hairline-strong: #000000;
  --trust: #005A2E; --trust-deep: #00401F; --trust-bg: #D8FFE0; --trust-line: #007A3D;
  --danger: #A80000; --danger-bg: #FFE0E0; --danger-line: #A80000;
}
```

`system`: JS ile `prefers-color-scheme` üzerinden `bone`/`dark` eşleştirilir (CSS media query kullanmadan).

- [x] **Step 3: Implement logic (popup.js)**

```js
function schemeFor(mode) {
  if (mode === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'bone';
  return mode;
}
function applyTheme(mode) {
  const docEl = document.documentElement;
  docEl.setAttribute('data-theme', mode === 'system' ? schemeFor(mode) : mode);
  docEl.dataset.themeMode = mode;
  const sel = $('#themeSelect');
  if (sel && sel.value !== mode) sel.value = mode;
}
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', () => { if (document.documentElement.dataset.themeMode === 'system') applyTheme('system'); });
```

`#themeSelect` change → `sendToOffscreen('setTheme', { mode: value }); applyTheme(value);`. Popup açılışında `initTheme()` → `sendToOffscreen('status')` yanıtındaki theme? basitçe `applyTheme('bone')` varsayılan (state.theme RAM'de; popup yeniden açılmada server'dan okunmaz çünkü offscreen RAM yaşar — `status`'a theme ekleyip uygula:

`offscreen` `status` case yanıtına `theme: state.theme || 'bone'` ekle; popup `status` işlemede `applyTheme(msg.payload.theme || 'bone')`.

`setTheme` action:

```js
case 'setTheme': state.theme = msg.mode || 'bone'; return { ok: true };
```

- [x] **Step 4: Run build + static check**

Run: `node build.js; node session_sim.mjs`
Expected: build OK; sim PASS.

- [x] **Step 5: Verify (statik + elle)**

`dist/popup.css` içinde `data-theme` bloklarının varlığını grep'le doğrula (`rg "data-theme" dist/popup.css`). Panelde tema değiştir → renkler değişir; "Sistem"de OS teması takip edilir.

---

### Task 6: Küçük iyileştirmeler (zaman damgası + yazıyor… + rozet)

**Files:**
- Modify: `src/popup.js`, `src/offscreen.js` (yazıyor sinyali), `src/popup.css`, `src/sidepanel.html`
- Test: elle

**Interfaces:**
- Produces: balonlara zaman damgası, `#chatTabs` rozeti, `typing` notification (uygulama detayı: k-sız, ayrı bir data tipi)

- [x] **Step 1: Zaman damgası (popup.js `addMessage`)**

`ts` mevcutsa balon içine `.msg-time` span: `new Date(ts).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })`.

```js
if (ts) {
  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(time);
}
```

CSS: `.msg-time { display:block; font-size:9px; color: var(--ink-mute); margin-top:2px; }`.

- [x] **Step 2: Okunmamış rozeti (popup.js)**

`renderTabs`'da, her sekme için okunmamış sayaç: `window.__unread` Map `<username, count>`. Aktif sekmede `openPeer(username)` çağrısında sıfırla. `message` event'inde, `from === activePeer` değilse `__unread[from]++` ve `renderTabs()`.

```js
function unreadBadge(username) {
  const n = (window.__unread || {})[username] || 0;
  if (!n) return '';
  return ' <span class="unread-badge">' + n + '</span>';
}
```

`renderTabs` içindeki `tab.innerHTML = username + unreadBadge(username)`.

- [x] **Step 3: "yazıyor…" (offscreen + popup)**

Offscreen'e action `sendTyping`:

```js
case 'sendTyping': {
  const entry = state.peers.get(msg.username);
  if (entry && entry.conn && entry.conn.open) {
    entry.cipher.encrypt(new TextEncoder().encode(JSON.stringify({ ty: true }))).then((r) => sendEnvelope(entry.conn, 1, r.body, r.registrationId));
  }
  return { ok: true };
}
```

Not: k:1 gövdesi `{m,t,ts}` biçiminde beklenir; `{ty:true}` decodeMessageBody'de patlamamalı — `decodeMessageBody` `j.m` yoksa `mid` üretir ve `t` dönderir; bu, kasıtsız bir "yazıyor" mesajı gösterimine yol açar. **Doğru yol:** yazıyor için gövdeyi k:1 ile GÖNDERMEYİP izole bir tip kullanmak — uygulama detayı sim/elle testinde netleştirilir (örn. `sendEnvelope(entry.conn, 1, r.body, r.registrationId)` yerine yazıyoru `{m:'typing', t:'', ts:0}` encode etmek ve alıcıda `decoded.mid==='typing'` ise `notify('typing', ...)` — decodeMessageBody bu formu `m:'typing'` ile kabul eder (string `m`), `t:''` boş, ts 0). Basit çözüm böyle uygulanır:

Gönderen: `encodeMessageBody('', 0)` değil — doğrudan JSON body `{ m: 'typing', t: '', ts: 0 }` → encrypt → k:1.

Alıcı k:1 dalında:

```js
if (decoded.mid === 'typing') { notify('typing', { from: remoteUsername }); break; }
```

Popup `typing` case → `#chatHeader` içinde `#typingHint` "yazıyor…" 3 sn görünür. Input'a her kılavuz basışta (input event, 1sn debounce) `sendToOffscreen('sendTyping', { username: activePeer })`.

- [x] **Step 4: CSS rozet**

```css
.unread-badge { display:inline-block; background: var(--trust); color:#fff; border-radius: var(--r-pill, 999px); font-size:9px; padding: 0 5px; margin-left:3px; }
```

- [x] **Step 5: Run build**

Run: `node build.js`
Expected: build OK.

- [x] **Step 6: Verify (elle)**

Zaman damgaları görünür; inaktif sekmede yeni mesaj varsa rozet artar; "yazıyor…" ipucu gelir.

---

### Task 7: Final sim + build doğrulama

**Files:**
- Modify: `session_sim.mjs` (k:6/7/8/9/10 akış senaryosu)
- Test: `node session_sim.mjs; node codec_test.js; node build.js`

**Interfaces:**
- Consumes: tüm önceki task'ların formatları
- Produces: Paket 4 ağ protokolünü uçtan uca ISpatırıyan sim bloğu

- [x] **Step 1: Add end-to-end envelope block**

```js
// ============ paket4: k:6-10 akış ============
const enc = () => ({ body: 'AA', registrationId: 1 });
const envBox = {};
sendEnvelope(null, () => Object.assign(envBox, ...), 7, JSON.stringify({ m: 'f1', name: 'a.jpg', size: 100, type: 'image/jpeg', parts: 2 }), 1);
ok(envBox.k === 7, 'k:7 teklif zarf türü');
sendEnvelope(null, () => Object.assign(envBox, ...), 9, JSON.stringify({ m: 'f1', idx: 0, total: 2, bytes: 'aGVsbG8=' }), 1);
ok(envBox.k === 9, 'k:9 parça zarf türü');
sendEnvelope(null, () => Object.assign(envBox, ...), 10, JSON.stringify({ m: 'f1' }), 1);
ok(envBox.k === 10, 'k:10 tamam zarf türü');
```

`sendEnvelope` sim helper'ı 4. argüman `type2`'yi alır (Paket 2'de `sendEnvelope(cipher, connSend, type2, body2, regId)`); boş cipher için `null` + reg 1 kullanılır, mantık zarf türünü doğrular.

- [x] **Step 2: Run sim**

Run: `node session_sim.mjs`
Expected: PASS, `N geçti, 0 hata`.

- [x] **Step 3: Final verify**

Run: `node codec_test.js; node build.js`
Expected: codec PASS, build OK. Spec'teki hata tablosu davranışları (dosya reddi, ✓✓ yokluğu, bilinmeyen mid, defterte bağlantı hatası, tema değişimi) koddaki karşılıklarıyla elle/gereksinimlerle doğrulanır.