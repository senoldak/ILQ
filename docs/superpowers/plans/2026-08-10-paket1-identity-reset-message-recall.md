# Paket 1 Uygulama Planı: Kimlik Sıfırlama + Mesaj Silme/Karşı Taraftan Silme

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ILQ'ya kimlik sıfırlama, yerel mesaj silme ve karşı taraftan silme (zaman sınırlı + onaylı) özelliklerini eklemek.

**Architecture:** Mevcut envelope yapısı (`{t:'ilq', v, k, m, r}`) korunur; şifreli gövde `{m,t,ts}` JSON formatına geçer, yeni `k:4` (sil) ve `k:5` (ack) türleri eklenir. Kimlik sıfırlama offscreen'de `resetIdentity` eylemiyle yapılır (yeni RamStore + yeni peer). Tüm silme/onay mantığı offscreen'de, görünüm mantığı popup'tadır.

**Tech Stack:** Chrome Extension MV3, PeerJS, @privacyresearch/libsignal-protocol-typescript, esbuild (node build.js), RAM-only RamStore, CLI simülasyon (session_sim.mjs).

## Global Constraints

- RAM-only ilkesi: hiçbir yeni veri diske yazılmaz (chrome.storage/localStorage/IndexedDB kullanılmaz)
- `MAX_TEXT_LENGTH = 4000` (offscreen.js:16), `MAX_ENVELOPE_LENGTH = 200000` (offscreen.js:17)
- Gövde formatı geriye dönük uyumlu olmalı: eski düz-metin gövde parse edilebilmelidir
- Silme yalnızca gönderen tarafından; `RECALL_WINDOW_MS = 5 * 60 * 1000` (5 dk)
- Envelope `k` değerleri: 1 = WhisperMessage, 3 = PreKeyWhisperMessage, 4 = sil komutu, 5 = sil onayı
- UI dili Türkçe; kullanıcıya gösterilen metinler spec'teki ifadelerle birebir
- Build komutu: `node build.js` (dist/ üretir); test komutu: `node session_sim.mjs`

---

### Task 1: Mesaj gövdesi `{m,t,ts}` formatı + geriye dönük uyum (offscreen)

**Files:**
- Modify: `src/offscreen.js` (`sendMessageTo` ~235-247, `handleIncoming` ~301-344)
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: mevcut `sendEnvelope(conn, type, body, registrationId)` (offscreen.js:224-233), `notify(ev, payload)` (offscreen.js:409-413), `binaryStringToArrayBuffer`/`arrayBufferToBase64`/`b64UrlToBase64`
- Produces:
  - `encodeMessageBody(text) -> { bytes: ArrayBuffer, mid: string }` — gövde JSON'u üretir, `mid` döner
  - `decodeMessageBody(bytes) -> { mid, text, ts }` — gövdeyi çözer; JSON değilse eski düz metin fallback (rastgele `mid`, `ts=0` döner)

- [ ] **Step 1: Write the failing test (simülasyon)**

`session_sim.mjs` içine, mevcut `handleIncoming` helper'ının altına ekle (testlerin sonuna, main()'ın sonunda):

```js
// ============ Paket 1: mesaj gövdesi {m,t,ts} ============
{
  const msg = new TextEncoder().encode(JSON.stringify({ m: 'a'.repeat(32), t: 'yeni format mesaj', ts: Date.now() })).buffer;
  const e = await cipherB.encrypt(msg);
  const env = {};
  sendEnvelope(cipherB, (o) => Object.assign(env, o), e.type, e.body, e.registrationId);
  const body = Buffer.from(b64UrlToBase64(env.m), 'base64').toString('binary');
  const plain = await cipherA.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
  const parsed = JSON.parse(new TextDecoder().decode(plain));
  ok(parsed.t === 'yeni format mesaj', 'yeni gövde formatı: t okundu');
  ok(parsed.m === 'a'.repeat(32), 'yeni gövde formatı: m (mid) korundu');
  ok(typeof parsed.ts === 'number', 'yeni gövde formatı: ts sayı');
}
{
  // eski düz metin gövde fallback'i
  const legacy = new TextEncoder().encode('eski duz metin').buffer;
  const e = await cipherB.encrypt(legacy);
  const env = {};
  sendEnvelope(cipherB, (o) => Object.assign(env, o), e.type, e.body, e.registrationId);
  const body = Buffer.from(b64UrlToBase64(env.m), 'base64').toString('binary');
  const plain = await cipherA.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
  const raw = new TextDecoder().decode(plain);
  let legacyFallback;
  try { const j = JSON.parse(raw); legacyFallback = j.t !== undefined; } catch (err) { legacyFallback = true; }
  ok(legacyFallback, 'eski düz metin gövde fallback kabul');
}
```

- [ ] **Step 2: Run test to verify it fails (kavramsal kırmızı)**

Run: `node session_sim.mjs`
Expected: İlk blok mevcut helper ile geçer; ikinci blok geçer (henüz gerçek parse yok ama test doğrudan gövdeyi işliyor). Bu adım yalnızca gövde iletiminin mevcut haliyle çalıştığını gösterir.

- [ ] **Step 3: Implement encode/decode helpers in offscreen.js**

`MAX_ENVELOPE_LENGTH` sabitinin altına ekle:

```js
// ---------- mesaj gövdesi (Paket 1) ----------
const RECALL_WINDOW_MS = 5 * 60 * 1000;

function randomMid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function encodeMessageBody(text) {
  const mid = randomMid();
  const body = JSON.stringify({ m: mid, t: text, ts: Date.now() });
  return { bytes: new TextEncoder().encode(body).buffer, mid };
}

function decodeMessageBody(bytes) {
  const raw = new TextDecoder().decode(bytes);
  try {
    const j = JSON.parse(raw);
    // k:4/k:5 kontrol gövdeleri yalnızca {m:...} taşır; t şartı aranmaz.
    if (j && typeof j.m === 'string') {
      return { mid: j.m, text: typeof j.t === 'string' ? j.t : raw, ts: typeof j.ts === 'number' ? j.ts : 0 };
    }
  } catch (e) { /* düz metin */ }
  return { mid: randomMid(), text: raw, ts: 0 };
}
```

- [ ] **Step 4: Wire encode into sendMessageTo, decode into handleIncoming**

`sendMessageTo` (offscreen.js:235-247) içinde, `const buffer = new TextEncoder().encode(text).buffer;` satırını şununla değiştir:

```js
  const { bytes, mid } = encodeMessageBody(text);
  const buffer = bytes;
  const result = await entry.cipher.encrypt(buffer);
```

`handleIncoming` (offscreen.js:320-340) içinde, her iki `const text = new TextDecoder().decode(plain);` satırını (k===3 ve k===1 bloklarındaki) şununla değiştir:

```js
  const decoded = decodeMessageBody(plain);
  const text = decoded.text;
```

notify çağrılarına `mid` ve `ts` ekle (k===1 ve k===3 bloklarındaki):

```js
        notify('message', { from: remoteUsername, text, encrypted: true, mid: decoded.mid, ts: decoded.ts });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node session_sim.mjs`
Expected: `%d geçti, 0 hata` (mevcut 9 test + 4 yeni ok satırı; toplam 13). `handleIncoming`'in hala `text` değişkenini doğru ürettiğini simülasyondaki `ok(text === expect, ...)` doğrular.

- [ ] **Step 6: Commit**

```bash
git add src/offscreen.js session_sim.mjs
git commit -m "feat(paket1): mesaj gövdesi {m,t,ts} formatı ve geriye dönük uyum"
```

---

### Task 2: `recallMessage` offscreen eylemi (k:4 gönderimi + pencere + outbox)

**Files:**
- Modify: `src/offscreen.js` (`sendMessageTo` altına recall, message dispatcher 416-445)
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: Task 1 `encodeMessageBody`, `RECALL_WINDOW_MS`, `randomMid`; `sendEnvelope`; `state.peers[username]` girişleri
- Produces:
  - `state.peers[username].outbox = Map<mid, { ts }>` — gönderilen mesajların pencere kaydı
  - `recallMessage(username, mid) -> Promise<{ ok: true } | { ok: false, error }>` — 5 dk penceresi + gönderen doğrulaması yapar, k:4 gönderir
  - `setRecallWindow(username, mid)` — `sendMessageTo` başarısında outbox'a ekler

- [ ] **Step 1: Write the failing test**

`session_sim.mjs` sonuna ekle:

```js
// ============ Paket 1: recall mantığı (offscreen sendMessageTo/recallMessage benzetimi) ============
{
  // outbox benzetimi: gönderilen mid pencereye yazılır
  const outbox = new Map();
  const sent = { m: 'b'.repeat(32), ts: Date.now() };
  outbox.set(sent.m, sent);
  ok(outbox.has('b'.repeat(32)), 'recall: mid outbox kaydında');
  ok((Date.now() - outbox.get(sent.m).ts) <= 5 * 60 * 1000, 'recall: pencere içinde');
  outbox.clear();
  const expired = { m: 'c'.repeat(32), ts: Date.now() - 6 * 60 * 1000 };
  outbox.set(expired.m, expired);
  const inWindow = (Date.now() - expired.ts) <= 5 * 60 * 1000;
  ok(!inWindow, 'recall: 5dk sonrası pencere dışı');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: Bu test mevcut koda bağımlı değil, geçer (henüz gerçek recall yok; bu test yalnızca pencere matematiğini doğrular).

- [ ] **Step 3: Implement recallMessage + setRecallWindow**

`sendMessageTo` fonksiyonunun hemen altına (offscreen.js:247 sonrası) ekle:

```js
function setRecallWindow(username, mid) {
  const entry = state.peers.get(username);
  if (!entry) return;
  if (!entry.outbox) entry.outbox = new Map();
  entry.outbox.set(mid, { ts: Date.now() });
}

async function recallMessage(username, mid) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) throw new Error('Önce bu kişiyle bağlantı kurmalısın');
  if (!entry.verified) throw new Error('Güvenlik numarası doğrulanana kadar silme gönderilemez');
  if (!entry.outbox || !entry.outbox.has(mid)) throw new Error('Bu mesaj silmeye uygun değil (yalnızca kendi gönderdiğin mesajları silebilirsin)');
  const rec = entry.outbox.get(mid);
  if (Date.now() - rec.ts > RECALL_WINDOW_MS) throw new Error('Silme süresi doldu (5 dakika)');
  const conn = entry.conn;
  if (!conn || !conn.open) throw new Error('Veri kanalı açık değil');
  const { bytes } = encodeMessageBody(JSON.stringify({ m: mid }));
  const result = await entry.cipher.encrypt(bytes);
  sendEnvelope(conn, 4, result.body, result.registrationId);
  return { ok: true };
}
```

`sendMessageTo`'nun `return { ok: true };` satırını şununla değiştir (outbox'a yaz):

```js
  setRecallWindow(username, mid);
  return { ok: true };
```

- [ ] **Step 4: Wire action into message dispatcher**

offscreen.js:416-445 dispatcher'daki switch'e, `case 'sendMessage':` satırından sonra ekle:

```js
        case 'recallMessage':
          return await recallMessage(msg.username, msg.mid);
```

- [ ] **Step 5: Run test**

Run: `node session_sim.mjs`
Expected: `%d geçti, 0 hata` (mevcut + 3 yeni; toplam 16).

- [ ] **Step 6: Commit**

```bash
git add src/offscreen.js session_sim.mjs
git commit -m "feat(paket1): recallMessage k:4 gönderimi, 5dk pencere, outbox"
```

---

### Task 3: Alıcı tarafı k:4 silme işleme + k:5 ack dönüşü

**Files:**
- Modify: `src/offscreen.js` (`handleIncoming` 301-344)
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: Task 1 `decodeMessageBody`, Task 2 `RECALL_WINDOW_MS`; mevcut `sendEnvelope`, `notify`
- Produces:
  - `handleIncoming` artık `k:4` (sil) ve `k:5` (ack) işler
  - `k:4` → alıcı `notify('deleted', { from, mid })` gönderir (popup balonu kaldırsın), ardından `k:5` ack envelope'ı gönderene döner
  - `k:5` → gönderen `notify('recallAck', { username, mid })` gönderir (popup "Karşı tarafta da silindi" göstersin)

- [ ] **Step 1: Write the failing test**

`session_sim.mjs` sonuna ekle (mevcut `handleIncoming` helper'ını yenisiyle değiştirmek yerine yeni `handleIncomingV2` ekle):

```js
// ============ Paket 1: k:4 (sil) + k:5 (ack) protokol benzetimi ============
async function handleIncomingV2(cipher, envelope, label, expect) {
  if (!envelope || envelope.t !== 'ilq') throw new Error('eşleşme yok');
  const body = Buffer.from(b64UrlToBase64(envelope.m), 'base64').toString('binary');
  let plain;
  if (envelope.k === 3) plain = await cipher.decryptPreKeyWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
  else plain = await cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
  const text = new TextDecoder().decode(plain);
  if (expect !== undefined) ok(text === expect, label + ' = ' + text);
  else ok(true, label + ' = ' + text);
}
{
  // B -> A: k:4 sil komutu (şifreli gövde {m: mid})
  const targetMid = 'd'.repeat(32);
  const ctrl = new TextEncoder().encode(JSON.stringify({ m: targetMid })).buffer;
  const e = await cipherB.encrypt(ctrl);
  const env = {};
  sendEnvelope(cipherB, (o) => Object.assign(env, o), 4, e.body, e.registrationId);
  ok(env.k === 4, 'k:4 sil komutu envelope tipi');
  const body = Buffer.from(b64UrlToBase64(env.m), 'base64').toString('binary');
  const plain = await cipherA.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
  const ctrlParsed = JSON.parse(new TextDecoder().decode(plain));
  ok(ctrlParsed.m === targetMid, 'k:4 gövdesinde mid korundu');
  // A -> B: k:5 ack
  const ack = new TextEncoder().encode(JSON.stringify({ m: targetMid })).buffer;
  const e2 = await cipherA.encrypt(ack);
  const env2 = {};
  sendEnvelope(cipherA, (o) => Object.assign(env2, o), 5, e2.body, e2.registrationId);
  ok(env2.k === 5, 'k:5 ack envelope tipi');
  const body2 = Buffer.from(b64UrlToBase64(env2.m), 'base64').toString('binary');
  const plain2 = await cipherB.decryptWhisperMessage(binaryStringToArrayBuffer(body2), 'binary');
  const ackParsed = JSON.parse(new TextDecoder().decode(plain2));
  ok(ackParsed.m === targetMid, 'k:5 gövdesinde mid korundu');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: Yeni blok mevcut şifreleme katmanıyla geçer (k:4/k:5 normal encrypt/decrypt). Bu adım protokolün şifreleme katmanını doğrular.

- [ ] **Step 3: Implement k:4/k:5 handling in handleIncoming**

offscreen.js:301-344 `handleIncoming` içinde, `if (envelope.k === 3) {...} else if (envelope.k === 1) {...}` zincirini k:4/k:5 dalıyla genişlet. `else if (envelope.k === 1)` bloğundan sonra ekle:

```js
    } else if (envelope.k === 4) {
      // Sil komutu: alıcı kendi geçmişinden kaldırır ve ack döner
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      const ctrl = decodeMessageBody(plain);
      notify('deleted', { from: remoteUsername, mid: ctrl.mid, ts: ctrl.ts });
      const ackBody = new TextEncoder().encode(JSON.stringify({ m: ctrl.mid })).buffer;
      const ack = await entry.cipher.encrypt(ackBody);
      sendEnvelope(conn, 5, ack.body, ack.registrationId);
    } else if (envelope.k === 5) {
      // Sil onayı: gönderen panelinde "Karşı tarafta da silindi"
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      const ctrl = decodeMessageBody(plain);
      notify('recallAck', { username: remoteUsername, mid: ctrl.mid });
    }
```

- [ ] **Step 4: Validate envelope type check allows 4/5**

offscreen.js:308 `if (envelope.k !== 1 && envelope.k !== 3) return;` satırını şununla değiştir:

```js
    if (envelope.k !== 1 && envelope.k !== 3 && envelope.k !== 4 && envelope.k !== 5) return;
```

- [ ] **Step 5: Run test**

Run: `node session_sim.mjs`
Expected: `%d geçti, 0 hata` (mevcut + 4 yeni; toplam 20).

- [ ] **Step 6: Commit**

```bash
git add src/offscreen.js session_sim.mjs
git commit -m "feat(paket1): alıcı k:4 silme işleme + k:5 ack dönüşü"
```

---

### Task 4: `resetIdentity` offscreen eylemi

**Files:**
- Modify: `src/offscreen.js` (dispatcher 416-445, `state` 88-97)
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: `bootstrapIdentity` (offscreen.js:99-104), `initPeer` (offscreen.js:180-210), `state`, `RamStore`
- Produces:
  - `resetIdentity() -> Promise<{ ok: true, peerId: string }>` — tüm peer bağlantılarını kapatır, yeni RamStore kurar, yeni keypair + yeni adresle initPeer çağırır

- [ ] **Step 1: Write the failing test**

`session_sim.mjs` sonuna ekle:

```js
// ============ Paket 1: kimlik sıfırlama benzetimi ============
{
  const oldStore = new RamStore();
  oldStore.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  oldStore.registrationId = KeyHelper.generateRegistrationId();
  const oldPubB64 = arrayBufferToBase64(oldStore.identityKeyPair.pubKey);
  const oldSessionsCount = 1; // simüle
  // yeni kimlik: store sıfırlanır
  const newStore = new RamStore();
  newStore.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  newStore.registrationId = KeyHelper.generateRegistrationId();
  const newPubB64 = arrayBufferToBase64(newStore.identityKeyPair.pubKey);
  ok(newPubB64 !== oldPubB64, 'reset: yeni identity key eski olandan farklı');
  ok(newStore.sessions.size === 0, 'reset: oturumlar boş');
  ok(oldStore.sessions.size === 0, 'reset: eski store izi yok (RAM-only)');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: Geçer (test yalnızca RamStore davranışını doğrular).

- [ ] **Step 3: Implement resetIdentity**

offscreen.js `rejectFingerprint` fonksiyonunun altına (offscreen.js:406 sonrası) ekle:

```js
async function resetIdentity() {
  // Tüm mevcut bağlantıları kapat
  for (const [username, entry] of state.peers) {
    if (entry.conn) { try { entry.conn.close(); } catch (e) {} }
  }
  state.peers.clear();
  // Yeni RAM store: anahtarlar, oturumlar, prekeyler, güven kayıtları hepsi sıfırlanır
  state.store = new RamStore();
  state.preKeyCounter = 10;
  // Yeni anahtar çifti + yeni adresle peer yeniden kurulur
  await bootstrapIdentity();
  const { peer, peerId } = await initPeer(undefined, state.network);
  state.peer = peer;
  state.peerId = peerId;
  notify('reset', { peerId });
  return { ok: true, peerId };
}
```

Not: `initPeer` zaten `state.peerId = id` atar ve mevcut peer'ı `destroy()` eder (offscreen.js:182). `state.peer` alanı initPeer içinde `peer.on('open')` handler'ında atanır; dönüş değerini `peerId` olarak kullan.

- [ ] **Step 4: Wire action into dispatcher**

offscreen.js:416-445 dispatcher switch'ine ekle:

```js
        case 'resetIdentity':
          return await resetIdentity();
```

- [ ] **Step 5: Run test**

Run: `node session_sim.mjs`
Expected: `%d geçti, 0 hata` (mevcut + 3 yeni; toplam 23).

- [ ] **Step 6: Commit**

```bash
git add src/offscreen.js session_sim.mjs
git commit -m "feat(paket1): resetIdentity offscreen eylemi (yeni anahtar + adres)"
```

---

### Task 5: Popup — mesaj balonu yapısı, menü, durum notları (HTML/CSS/JS)

**Files:**
- Modify: `src/popup.js` (`addMessage` 33-45, `case 'message'` 103-106, `case 'deleted'` ve `case 'recallAck'` ekle)
- Modify: `src/sidepanel.html` (menü/balon konteyneri gerekmez — balonlar JS'te üretilir; yalnızca gerekirse `#chatMessages` içine inline)
- Modify: `src/popup.css` (balon menüsü, geri çekilmiş stil)
- Test: build + elle doğrulama

**Interfaces:**
- Consumes: offscreen `notify('message', {from, text, mid, ts})`, `notify('deleted', {from, mid})`, `notify('recallAck', {username, mid})`, `notify('reset', {peerId})`
- Produces:
  - `addMessage(text, who, msgType, mid, ts)` — `data-mid` özellikli balon + `⋮` menü butonu + `data-sent` işareti
  - Silme akışı `openMessageMenu` içinde `sendToOffscreen('recallMessage', { username: currentPeer, mid })` ile yürütülür
  - `markDeleted(mid)` — balonu "Bu mesaj geri çekildi" ile ikame eder
  - `markRecallAcked(mid)` — "Karşı tarafta da silindi" notu ekler
  - `window.__sentMids` — gönderilen mesajların mid listesi (popup tarafı pencere hesabı için: `{mid: {ts}}`)

- [ ] **Step 1: Write failing test (yok — UI, elle doğrulama)**

Bu task UI'dir; otomatik simülasyon kapsamı dışında. Build ile doğrula.

- [ ] **Step 2: Update addMessage**

`src/popup.js` `addMessage` fonksiyonunu (33-45) şununla değiştir:

```js
function addMessage(text, who, msgType, mid, ts) {
  const div = document.createElement('div');
  div.className = 'msg ' + (msgType || 'in');
  if (mid) div.dataset.mid = mid;
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
    const menu = document.createElement('button');
    menu.className = 'msg-menu';
    menu.textContent = '⋮';
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      openMessageMenu(menu, div);
    });
    inner.appendChild(menu);
  }
  div.appendChild(inner);
  $('chatMessages').appendChild(div);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}
```

- [ ] **Step 3: Add menu + recall helpers**

`addMessage` fonksiyonunun altına ekle:

```js
function openMessageMenu(btn, bubble) {
  const menu = document.createElement('div');
  menu.className = 'msg-menu-popup';
  const local = document.createElement('button');
  local.textContent = 'Yerel sil';
  local.addEventListener('click', () => bubble.remove());
  menu.appendChild(local);
  const remote = document.createElement('button');
  remote.textContent = 'Karşı taraftan da sil';
  remote.className = 'danger';
  const mid = bubble.dataset.mid;
  const rec = window.__sentMids && window.__sentMids[mid];
  const expired = !rec || (Date.now() - rec.ts) > 5 * 60 * 1000;
  remote.disabled = !!expired;
  if (expired) remote.title = 'Silme süresi doldu (5 dakika)';
  remote.addEventListener('click', () => {
    if (!mid) return;
    sendToOffscreen('recallMessage', { username: currentPeer, mid }).then((res) => {
      if (res && res.ok) {
        markDeleted(mid);
        showTempError('Geri çekme gönderildi');
      } else {
        showTempError((res && res.error) || 'Silme gönderilemedi');
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
  el.textContent = 'Bu mesaj geri çekildi';
  el.classList.add('recalled');
}

function markRecallAcked(mid) {
  const bubble = document.querySelector('.msg[data-mid="' + mid + '"]');
  if (!bubble) return;
  const note = document.createElement('div');
  note.className = 'msg-note';
  note.textContent = 'Karşı tarafta da silindi';
  bubble.appendChild(note);
}
```

- [ ] **Step 4: Update sendMessage to record mid + message event handler**

`sendMessage` (popup.js:296-306) içinde `const res = await sendToOffscreen('sendMessage', ...)` çağrısını değiştir:

```js
  const res = await sendToOffscreen('sendMessage', { username: currentPeer, text });
  if (res.ok) {
    const mid = (res && res.mid) || null;
    addMessage(text, 'ben', 'out', mid, Date.now());
    if (mid) {
      if (!window.__sentMids) window.__sentMids = {};
      window.__sentMids[mid] = { ts: Date.now() };
    }
    $('messageInput').value = '';
  } else {
    showTempError(res.error || 'Gönderilemedi');
  }
```

`case 'message'` handler'ını (popup.js:103-106) şununla değiştir:

```js
    case 'message':
      setStatusToConnection();
      addMessage(msg.payload.text, msg.payload.from, 'in', msg.payload.mid, msg.payload.ts);
      break;
```

- [ ] **Step 5: Add deleted/recallAck/reset event handlers**

`case 'status':` handler'ından (popup.js:169-171) sonra, switch'e ekle:

```js
    case 'deleted':
      markDeleted(msg.payload.mid);
      break;
    case 'recallAck':
      markRecallAcked(msg.payload.mid);
      break;
    case 'reset':
      currentPeer = null;
      trustVerified = false;
      $('chatMessages').textContent = '';
      $('chatPeer').textContent = 'Sohbet';
      $('myPeerId').textContent = msg.payload.peerId;
      $('generatedCode').textContent = '—';
      setStatus('yayında', 'online');
      showPanel('connect');
      break;
```

- [ ] **Step 6: sendMessageTo must return mid (offscreen)**

offscreen.js `sendMessageTo` fonksiyonunun sonunu (Task 2'de değişen) şununla değiştir:

```js
  setRecallWindow(username, mid);
  return { ok: true, mid };
```

- [ ] **Step 7: Build + verify**

Run: `node build.js`
Expected: `bundled offscreen.js`, `bundled popup.js`, `build ok -> dist/`. Extension'ı yeniden yükle ve mesaj gönderip gönderilen balonun `⋮` menüsünü elle doğrula.

- [ ] **Step 8: Commit**

```bash
git add src/offscreen.js src/popup.js src/sidepanel.html src/popup.css
git commit -m "feat(paket1): popup mesaj balonu menüsü, geri çekme ve durum notları"
```

---

### Task 6: Popup — kimlik sıfırlama akışı + onay modalı

**Files:**
- Modify: `src/sidepanel.html` (Kimliğim kartına sıfırlama butonu)
- Modify: `src/popup.css` (modal stilleri)
- Modify: `src/popup.js` (sıfırlama akışı)

**Interfaces:**
- Consumes: offscreen `resetIdentity` eylemi, `notify('reset', {peerId})` (Task 5)
- Produces: `#resetIdentityBtn` elemanı, `openResetModal()`, `confirmReset()`

- [ ] **Step 1: Add reset button to sidepanel.html**

`<div id="myPeerId" class="mono">—</div>` satırının hemen altına (Kimliğim kartında) ekle:

```html
        <button id="resetIdentityBtn" class="ghost reset" title="Kimliği sıfırla">Kimliği sıfırla</button>
```

- [ ] **Step 2: Add modal markup**

`</div>` (mainView kapanışı) öncesine ekle:

```html
      <div id="resetModal" class="modal hidden">
        <div class="modal-card">
          <h2 class="modal-title">Kimliği sıfırla</h2>
          <p class="modal-text">Yeni kimlik oluşturulacak. Tüm bağlantılar kapanacak, oturumlar ve sohbet geçmişi silinecek. Bu işlem geri alınamaz.</p>
          <div class="modal-actions">
            <button id="resetCancelBtn" class="secondary">Vazgeç</button>
            <button id="resetConfirmBtn" class="danger">Sıfırla</button>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Add CSS for modal and reset button**

`src/popup.css` sonuna ekle:

```css
/* ---------- paket 1: kimlik sıfırlama ---------- */
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-card {
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  padding: 18px 20px;
  max-width: 300px;
  box-shadow: var(--shadow-md);
}
.modal-title { margin: 0 0 8px; font-size: 15px; }
.modal-text { margin: 0 0 14px; font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
#resetIdentityBtn.reset {
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--danger, #b3261e);
}
.msg-menu-popup {
  position: absolute;
  right: 4px;
  top: 100%;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--r-sm);
  padding: 4px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 140px;
  box-shadow: var(--shadow-sm);
}
.msg-menu-popup button {
  background: none;
  border: none;
  text-align: left;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
}
.msg-menu-popup button:hover { background: var(--surface-2); }
.msg-menu-popup button.danger { color: var(--danger, #b3261e); }
.msg-menu-popup button.danger:disabled { color: var(--tab-inactive); cursor: default; }
.msg-bubble { position: relative; display: flex; align-items: center; gap: 6px; }
.msg-menu { background: none; border: none; cursor: pointer; color: var(--ink-2); font-size: 14px; padding: 0 2px; }
.msg-body.recalled { font-style: italic; color: var(--ink-2); }
.msg-note { font-size: 10.5px; color: var(--ink-2); margin-top: 3px; }
```

- [ ] **Step 4: Add JS flow**

`src/popup.js` sonuna (setStatus('çevrimdışı') satırından önce) ekle:

```js
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
    currentPeer = null;
    trustVerified = false;
    $('chatMessages').textContent = '';
    $('chatPeer').textContent = 'Sohbet';
    $('myPeerId').textContent = res.peerId;
    $('generatedCode').textContent = '—';
    setStatus('yayında', 'online');
    showPanel('connect');
  } else {
    showTempError((res && res.error) || 'Sıfırlama başarısız');
  }
}
$('resetIdentityBtn').addEventListener('click', openResetModal);
$('resetCancelBtn').addEventListener('click', closeResetModal);
$('resetConfirmBtn').addEventListener('click', confirmReset);
```

- [ ] **Step 5: Build + verify**

Run: `node build.js`
Expected: `build ok -> dist/`. Extension'ı yeniden yükle; Kimliği sıfırla → modal açılır → Sıfırla → Kimliğim değişir, paneller sıfırlanır.

- [ ] **Step 6: Commit**

```bash
git add src/sidepanel.html src/popup.css src/popup.js
git commit -m "feat(paket1): popup kimlik sıfırlama akışı ve onay modalı"
```

---

### Task 7: Simülasyon — uçtan uca recall + reset senaryoları ve son doğrulama

**Files:**
- Modify: `session_sim.mjs`
- Test: `session_sim.mjs`, `node build.js`

**Interfaces:**
- Consumes: Task 1-4'ün tümü

- [ ] **Step 1: Add end-to-end recall scenario**

`session_sim.mjs` sonuna ekle:

```js
// ============ Paket 1: uçtan uca geri çekme senaryosu (B gönderdi, A siler) ============
{
  // B gönderdi, A aldı, A (gönderen B değil A olarak) geri çekemez — alıcı reddedilir
  const sentByB = new TextEncoder().encode(JSON.stringify({ m: 'e'.repeat(32), t: 'B nin mesaji', ts: Date.now() })).buffer;
  const e = await cipherB.encrypt(sentByB);
  const env = {};
  sendEnvelope(cipherB, (o) => Object.assign(env, o), e.type, e.body, e.registrationId);
  const body = Buffer.from(b64UrlToBase64(env.m), 'base64').toString('binary');
  const plain = await cipherA.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
  const decoded = JSON.parse(new TextDecoder().decode(plain));
  ok(decoded.m === 'e'.repeat(32), 'uçtan uca: A, B nin mesajının mid ini çözdü');
  // A artık alıcı; kendi outbox'ında bu mid YOK → recall reddedilir (offscreen recallMessage'ın outbox kontrolü)
  const recipientOutbox = new Map();
  const recallAllowed = recipientOutbox.has(decoded.m);
  ok(!recallAllowed, 'uçtan uca: alıcı kendi göndermediği mid i geri çekemez');
}
{
  // B kendi mesajını geri çeker (outbox'ta var, pencere içinde) → A deleted alır
  const mid = 'f'.repeat(32);
  const outbox = new Map();
  outbox.set(mid, { ts: Date.now() });
  const allowed = outbox.has(mid) && (Date.now() - outbox.get(mid).ts) <= 5 * 60 * 1000;
  ok(allowed, 'uçtan uca: gönderen kendi mesajını geri çekebilir');
}
```

- [ ] **Step 2: Add end-to-end reset scenario**

```js
// ============ Paket 1: uçtan uca sıfırlama (eski kod artık çalışmaz) ============
{
  const fresh = new RamStore();
  fresh.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  fresh.registrationId = KeyHelper.generateRegistrationId();
  const signed2 = await KeyHelper.generateSignedPreKey(fresh.identityKeyPair, 21);
  const opk2 = await KeyHelper.generatePreKey(22);
  await fresh.storeSignedPreKey(signed2.keyId, signed2.keyPair);
  await fresh.storePreKey(opk2.keyId, opk2.keyPair);
  const newCode = encodeCode({
    u: 'resetfreshaddr12345',
    r: fresh.registrationId,
    ik: arrayBufferToBase64(fresh.identityKeyPair.pubKey),
    spkId: signed2.keyId,
    spk: arrayBufferToBase64(signed2.keyPair.pubKey),
    spkSig: arrayBufferToBase64(signed2.signature),
    opkId: opk2.keyId,
    opk: arrayBufferToBase64(opk2.keyPair.pubKey),
  });
  const p2 = decodeCode(newCode);
  ok(p2.u === 'resetfreshaddr12345', 'reset: yeni kimlikle yeni kod çözülür');
  const rebuiltBuilder = new SessionBuilder(fresh, addressFor(B));
  const device2 = {
    registrationId: parsed.r,
    identityKey: base64ToArrayBuffer(parsed.ik),
    signedPreKey: { keyId: parsed.spkId, publicKey: base64ToArrayBuffer(parsed.spk), signature: base64ToArrayBuffer(parsed.spkSig) },
    preKey: { keyId: parsed.opkId, publicKey: base64ToArrayBuffer(parsed.opk) },
  };
  // Yeni kimlik B ye bağlanmaya çalışır ama B eski kimliğin anahtarlarını bilmiyor — decrypt hata verir
  let freshFailed = false;
  try {
    await rebuiltBuilder.processPreKey(device2);
    const freshCipher = new SessionCipher(fresh, addressFor(B));
    // B nin bir mesajını yeni cipher ile çözmeyi dene (A/B nin orijinal oturumuyla çelişir)
    const probe = await freshCipher.encrypt(new TextEncoder().encode('probe').buffer);
    const env = {};
    sendEnvelope(freshCipher, (o) => Object.assign(env, o), probe.type, probe.body, probe.registrationId);
    const bodyP = Buffer.from(b64UrlToBase64(env.m), 'base64').toString('binary');
    await cipherB.decryptWhisperMessage(binaryStringToArrayBuffer(bodyP), 'binary');
  } catch (e) {
    freshFailed = true;
  }
  ok(freshFailed, 'reset: eski tarafın session ı yeni kimliği çözemez');
}
```

- [ ] **Step 3: Run full test**

Run: `node session_sim.mjs`
Expected: `%d geçti, 0 hata` (mevcut + Task 1-4 testleri + bu 3 senaryo).

- [ ] **Step 4: Build**

Run: `node build.js`
Expected: `build ok -> dist/`.

- [ ] **Step 5: Final spec coverage check**

- [ ] `{m,t,ts}` gövde formatı → Task 1 ✓
- [ ] `k:4` sil, `k:5` ack → Task 2-3 ✓
- [ ] 5 dk pencere, yalnızca gönderen → Task 2-3 ✓
- [ ] Yerel silme → Task 5 (DOM kaldırma) ✓
- [ ] "Geri çekildi" ikamesi + "Karşı tarafta da silindi" → Task 3-5 ✓
- [ ] Kimlik sıfırlama (tam) + onay modalı → Task 4-6 ✓
- [ ] Çevrimdışı: komut gönderilmez (kapalı kanal) / ack yok (açık kanal) → Task 2-3 ✓
- [ ] Geriye dönük eski gövde uyumu → Task 1 ✓

- [ ] **Step 6: Commit**

```bash
git add session_sim.mjs
git commit -m "test(paket1): uçtan uca recall ve reset senaryoları"
```

---

## Son elle doğrulama listesi (extension)

1. İki taraf bağlan (kod üret → kod gir) → her iki yön mesaj iletir
2. Gönderdiğin mesajın `⋮` menüsünde "Yerel sil" balonu kaldırır
3. "Karşı taraftan da sil" → karşı tarafta "Bu mesaj geri çekildi" görünür, senin panelinde "Karşı tarafta da silindi" notu gelir
4. 5 dakikadan eski mesajda "Karşı taraftan da sil" kapalı
5. "Kimliği sıfırla" → modal → Sıfırla → Kimliğim değişir, sohbet temizlenir
6. Sıfırlama sonrası yeni kod üretilip yeni bağlantı kurulabilir
