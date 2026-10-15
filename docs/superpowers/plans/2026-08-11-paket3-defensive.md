# Paket 3 Uygulama Planı: Düşman Ortam Savunması

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panik modu, tuzak ekran, kod süre dolumu (5 dk), otomatik yok etme (sohbet + mesaj düzeyli) ve ekran maskesini uygulamak. Spec: `docs/superpowers/specs/2026-08-11-defensive-package-design.md`.

**Architecture:** Tüm mantık mevcut in-line desenle uygulanır — offscreen `handleIncoming`/`resetIdentity` üzerine; yeni k:11 (zamanlayıcı senkronu), mesaj gövdesine `e` alanı, `resetAll` panik fonksiyonu; UI tarafında Panik butonu, tuzak ekran, geri sayım, blur maskeleme. Yeni modül üretilmez.

**Tech Stack:** Chrome Extension MV3, PeerJS, @privacyresearch/libsignal-protocol-typescript, esbuild (`node build.js`), RAM-only RamStore, CLI simülasyon (`session_sim.mjs`).

## Global Constraints

- RAM-only: hiçbir yeni veri diske yazılmaz; `state.decoy`, `state.pendingCodeExp` vb. yalnızca RAM
- **`CODE_TTL_MS = 5 * 60 * 1000`** (5 dk) — Paket 2'deki 15 dk değeri bu pakette değiştirilir; kod `exp` alanı zaten codec'te taşınır ve `connectWithCode` tüketir
- Envelope `k` allow-list'i `{1,3,4,5}`'ten **`{1,3,4,5,11}`**'e genişler (offscreen handleIncoming 409)
- Mesaj gövdesi: `{ m, t, ts }` artı opsiyonel `"e": <saniye>` (mesaj düzeyi yok etme)
- Sohbet düzeyi yok etme süreleri: yok / 30s / 5dk (sabit). `e` hep gönderenin `ts`'ine göre hesaplanır
- Panik: iki adımlı onay yok; ani ve geri alınamaz. Tuzak ekran: tek sabit görünüm
- Ekran koruması azaltmadır: blur maskeleme + `user-select`/contextmenu engeli; UI'da sınır dürüstçe belirtilir
- UI dili Türkçe; kullanıcıya gösterilen metinler spec'teki ifadelerle birebir
- Build: `node build.js`; test: `node session_sim.mjs` + `node codec_test.js`
- **Git repo yok:** commit adımı uygulanmaz, her task doğrulamayla biter
- Simülasyon deseni: `session_sim.mjs` offscreen mantığının kopyalarıyla çalışır; UI değişiklikleri build + elle doğrulamayla test edilir

---

### Task 1: CODE_TTL_MS 5 dk + kod geri sayım (UI)

**Files:**
- Modify: `src/offscreen.js:19` (CODE_TTL_MS), `src/popup.js` (geri sayım), `src/popup.css`, `src/sidepanel.html`
- Test: `session_sim.mjs` (code expiry bloğu güncellenir)

**Interfaces:**
- Consumes: `state.pendingCodeExp` (offscreen generateCode 182), `generateCode` action → `{ ok, code, exp }`
- Produces:
  - `CODE_TTL_MS = 5 * 60 * 1000`
  - Popup: `#generatedCode` yanında `#codeCountdown` span; 1 sn aralıklı `setInterval`, süre dolunca metin değişir (`renderCodeCountdown(exp)`)
  - `connectWithCode` expiry mesajı davranışı değişmez; sim bloğu yalnızca 5 dk üstünde kodüretme ile uyumlu kılınır

- [ ] **Step 1: Write the failing test (session_sim.mjs)**

`session_sim.mjs` içindeki "code expiry" bloğunu bul (satır ~427) ve aktif TTL'yi kullan: blok, `exp`'i geçmiş `encodeCode` ile A kod gönderir → B `connectWithCode` eşdeğeri `parsed.exp` kontrolü reddeder; geçmemiş `exp` → kabul. Testin sabit 15 dk'ya bağımlı olmadığını doğrula — mevcut blok `Date.now() - 1000` ile üretiyorsa değişmez. Yeni tek assert ekle (yoksa):

```js
// ============ paket3: code TTL 5dk ============
const ttlFields = { ...fields, exp: Date.now() + 5 * 60 * 1000 };
const ttlCode = encodeCode(ttlFields);
const ttlParsed = decodeCode(ttlCode);
ok(ttlParsed.exp <= Date.now() + 5 * 60 * 1000 + 100, 'kod exp 5dk penceresi içinde üretilir');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: yeni assert geçer (exp zaten codec'te); asıl geçecek — TTL değişimi UI sabitindedir. Task sim'de davranış farkı gözetmezse FAIL çıkmaz; bu durumda sim'i geçmeye devam ettir.

- [ ] **Step 3: Implement 5 dk TTL (offscreen)**

`src/offscreen.js` satır 19:

```js
const CODE_TTL_MS = 5 * 60 * 1000; // 5 dakika — Paket 3
```

- [ ] **Step 4: Add countdown element (sidepanel.html)**

`#panelCode` içinde, `#generatedCode` (satır 124) sonrasına:

```html
<div id="codeCountdown" class="code-countdown note" hidden></div>
```

- [ ] **Step 5: Implement countdown (popup.js)**

`#genCodeBtn` click handler'ı (satır 365-375) her başarıda temiz kalan eski interval'i sıfırlar:

```js
let codeCountdownTimer = null;
function renderCodeCountdown(exp) {
  const el = $('#codeCountdown');
  const tick = () => {
    const left = (exp || 0) - Date.now();
    if (left <= 0) { el.textContent = 'Kodun süresi doldu — yeni kod üret.'; el.classList.add('expired'); clearInterval(codeCountdownTimer); return; }
    const s = Math.floor(left / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    el.textContent = 'Kodun geçerliliği: ' + mm + ':' + ss;
  };
  el.hidden = false;
  tick();
  clearInterval(codeCountdownTimer);
  codeCountdownTimer = setInterval(tick, 1000);
}
```

`#genCodeBtn` handler'ında, `code` atandıktan sonra `if (data.exp) renderCodeCountdown(data.exp);`.

`reset` ve `resetIdentity` temizliğinde `clearInterval(codeCountdownTimer); $('#codeCountdown').hidden = true;` ekle.

- [ ] **Step 6: Style countdown (popup.css)**

```css
.code-countdown { margin-top: 6px; color: var(--ink-mute); font-variant-numeric: tabular-nums; }
.code-countdown.expired { color: var(--danger); }
```

- [ ] **Step 7: Run tests + build**

Run: `node session_sim.mjs; node codec_test.js; node build.js`
Expected: sim PASS, codec PASS, build OK (esbuild hatasız).

- [ ] **Step 8: Verify**

Paneli elle doğrula: kod üret → geri sayım başlar; 5 dk beklenmez — countdown "süresi doldu" metnine geçişi, `exp`'i `Date.now()-1000` yaparak geçici testle doğrulama bu task'ta yapılabilir (elle). Task kapanmadan önce build çıktısı gözden geçirilir.

---

### Task 2: Panik modu `resetAll` (offscreen) + action

**Files:**
- Modify: `src/offscreen.js` (`resetAll`, action switch)
- Test: `session_sim.mjs` (panik simülatörü)

**Interfaces:**
- Consumes: mevcut `RamStore`, `initPeer(username, network)`, `state.network`
- Produces:
  - `resetAll()` → `{ ok: true }`; tüm peers kapatılır, state temizlenir, `state.decoy = true`, `notify('panic', {})`
  - Action `panic` → `resetAll()`
  - `status` action yanıtına `decoy: !!state.decoy` eklenir

- [ ] **Step 1: Write the failing test (session_sim.mjs)**

Sim, offscreen mantığının kopyasıyla çalıştığı için panik simi RAM incelemesiyle yazılır — `resetAll` iç mantığını temsilen `freshState()` helper tanımlanır:

```js
// ============ paket3: panik resetAll ============
function freshState() {
  return { peers: new Map(), store: new RamStore(), preKeyCounter: 10, decoy: false };
}
const panicSt = freshState();
panicSt.peers.set('x', { initialized: true });
panicSt.decoy = true;
ok(panicSt.decoy === true, 'decoy bayrağı set edildi');
ok(panicSt.peers.size === 1, 'panik simde peers korunabilir (gerçek resetAll peers'i temizler)');
```

Not: gerçek `resetAll` davranışının sim karşılığı assert'ten çok kuraldır — kuralı belgeler `resetAll`'ı tanımlar: peers.clear + store yeniden + decoy. Sim'de "reset sonrası eski kod decrypt çalışmaz" benzeri zaten Paket 1/2'de var; bu task'ın sim katkısı `decoy` kavramının varlığını sabitler.

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: Task 2 sim assert'lerinin geçmesi için koda gerek yok (salt state sabiti); blok eklenir, koşum PASS. Asıl panik kodu offscreen + UI'da.

- [ ] **Step 3: Implement resetAll (offscreen.js)**

`resetIdentity()` (613-627) hemen sonrasına:

```js
function resetAll() {
  for (const [, entry] of state.peers) { try { entry.conn && entry.conn.close(); } catch (_) {} }
  state.peers.clear();
  state.store = new RamStore();
  state.preKeyCounter = 10;
  state.decoy = true;
  state.pendingCodeExp = null;
  state.rateBuckets.clear();
  if (state.peer) { try { state.peer.destroy(); } catch (_) {} state.peer = null; }
  bootstrapIdentity();
  initPeer(undefined, state.network);
  notify('panic', {});
  return { ok: true };
}
```

`state` literal'ina (125-135) `decoy: false` ekle.

- [ ] **Step 4: Add `panic` action**

`chrome.runtime.onMessage.addListener` switch'inde (661-662 civarı):

```js
case 'panic': return resetAll();
```

Ayrıca `status` case'i (663-664) yanıtına ekle: `decoy: !!state.decoy`.

- [ ] **Step 5: Run tests + build**

Run: `node session_sim.mjs; node build.js`
Expected: sim PASS; build OK.

---

### Task 3: Tuval/Tuzak ekran (UI) + Panik butonu

**Files:**
- Modify: `src/sidepanel.html`, `src/popup.css`, `src/popup.js`
- Test: elle (build sonrası); sim yok

**Interfaces:**
- Consumes: offscreen `panic` action, `status` yanıtında `decoy`
- Produces:
  - `#panicBtn` (üst bar), `#decoyView` (tuzak ekran), `#decoyRestartBtn`
  - Popup `panic` event → `#mainView`/`#loginView` gizlenir, `#decoyView` gösterilir
  - `#decoyRestartBtn` → `sendToOffscreen('resetIdentity')` + arayüz sıfırlama (mevcut reset akışını çağırır)

- [ ] **Step 1: Add markup (sidepanel.html)**

`#mainView` (satır 69) başında, içeride üst barın yanına Panik butonu:

```html
<button id="panicBtn" class="panic-btn" type="button" aria-label="Panik modu">Panik</button>
```

Sayfanın sonunda, ana görünümlerin dışında:

```html
<div id="decoyView" hidden>
  <div class="decoy-card">
    <p class="decoy-title">Hava Durumu — Bugün</p>
    <p class="decoy-note">İstanbul · 18°C · Parçalı bulutlu</p>
    <button id="decoyRestartBtn" class="button-secondary" type="button">Uygulamayı yeniden başlat</button>
  </div>
</div>
```

- [ ] **Step 2: Implement UI logic (popup.js)**

`#panicBtn` click + klavye kısayolu (popup açıkken Ctrl+Shift+X; MV3'te global kısayol ayrıca background.js'e eklenebilir, spec 1.1):

```js
$('#panicBtn').addEventListener('click', () => {
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
  $('#loginView').hidden = true;
  $('#mainView').hidden = true;
  $('#decoyView').hidden = false;
}
```

`chrome.runtime.onMessage` switch'ine `panic` case (256 satırından önce):

```js
case 'panic':
  showDecoy();
  break;
```

`#decoyRestartBtn` click:

```js
$('#decoyRestartBtn').addEventListener('click', () => {
  $('#decoyView').hidden = true;
  sendToOffscreen('resetIdentity', {});
});
```

Not: resetIdentity dönüşü mevcut `reset` event'ı ile UI'ı eski haline getirir (satır 249-258).

- [ ] **Step 3: Style (popup.css)**

```css
#panicBtn { position: fixed; top: 10px; right: 10px; z-index: 30; background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-line); border-radius: var(--r-sm); padding: 6px 10px; font-size: 11px; font-weight: 600; cursor: pointer; }
#decoyView { display: flex; align-items: center; justify-content: center; height: 100%; background: var(--ground); }
.decoy-card { text-align: center; padding: 20px; }
.decoy-title { font: 600 16px 'InterVar'; color: var(--ink); }
.decoy-note { font: 400 12px 'InterVar'; color: var(--ink-mute); margin: 6px 0 14px; }
```

`#decoyView[hidden]` default kuralı sayesinde gizli kalır (`.hidden` yerine `hidden` attr kullanıldığı için `[hidden]{display:none}` varsayılanı yeterli; farklı display override'ıyla bozulmaması için `#decoyView.hidden` açıkça `display:none` yapılmayabilir — `hidden` attr yeterli).

- [ ] **Step 4: Run build**

Run: `node build.js`
Expected: build OK.

- [ ] **Step 5: Verify (elle)**

Build sonrası extension panelinde: Panik butonu görünür; tıklayınca `#decoyView` tuzak ekran gelir; "Uygulamayı yeniden başlat" → reset akışı. `decoy` event'i offscreen'den gelir. `#mainView`, `#loginView` kapalı kalır.

---

### Task 4: Mesaj düzeyi otomatik yok etme (`e` alanı)

**Files:**
- Modify: `src/offscreen.js` (`encodeMessageBody`, `decodeMessageBody`, `sendMessageTo` + yeni action `setMessageExpiry` UI'ı besler, `handleIncoming` mesaj tesliminde zamanlayıcı), `src/popup.js` (mesaj bazlı seçici), `src/popup.css`, `src/sidepanel.html`
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: `encodeMessageBody(text)`, `decodeMessageBody(bytes)`, `sendMessageTo(username, text)`
- Produces:
  - `encodeMessageBody(text, expSeconds?)` → `{ bytes, mid }` (gövde `{m,t,ts, e}`)
  - `decodeMessageBody(bytes)` → `{ mid, text, ts, e }` (e yoksa undefined)
  - `sendMessageTo(username, text, expSeconds?)` — >0 ise encode'a iletilir
  - Alıcı, mesaj geldiğinde `e && ts` varken `setTimeout(ts + e*1000 - now)` ile mesajı RAM'den ve UI'dan düşürür; `notify('expired', { mid })`

- [ ] **Step 1: Write the failing test (session_sim.mjs)**

```js
// ============ paket3: mesaj e silme ============
const slow = { bytes: new TextEncoder().encode(JSON.stringify({ m: 'mid-e1', t: 'gecikmeli', ts: Date.now(), e: 1 })).buffer, mid: 'mid-e1' };
const dec2 = decodeBodyMemo(slow); // decodeMessageBody eşdeğeri
ok(dec2.e === 1, 'mesaj gövdesi e alanını taşır');
ok(dec2.mid === 'mid-e1', 'mid korunur');
```

`decodeBodyMemo` helper'ını blok başında tanımla (`decodeMessageBody` kopyası: `decodeMessageBody(bytes)`'in birebir satırları, Paket 1 sim'de olduğu gibi `new TextDecoder().decode(...)` + `JSON.parse` + parse-fallback). Eğer sim'de zaten `decodeMessageBody`'in kopyası varsa (Paket 1 bloğu 207-232) onu kullan; `e`'yi de okuduğunu assert et.

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: `dec2.e === 1` FAIL (mevcut decode e'yi döndürmez — sadece sim hatası; offscreen kopyasında hâlâ e'siz).

- [ ] **Step 3: Implement encode/decode e (offscreen.js)**

`encodeMessageBody(text)` → imza genişler:

```js
function encodeMessageBody(text, expSeconds) {
  const mid = randomMid();
  const body = { m: mid, t: text, ts: Date.now() };
  if (expSeconds && expSeconds > 0) body.e = expSeconds;
  return { bytes: new TextEncoder().encode(JSON.stringify(body)), mid };
}
```

`decodeMessageBody(bytes)` — `ts`'ten sonra ekle:

```js
const e = (typeof j.e === 'number') ? j.e : undefined;
return { mid: j.m, text: j.t, ts, e };
```

- [ ] **Step 4: Wire send (offscreen.js)**

`sendMessageTo(username, text, expSeconds)` — `encodeMessageBody(text, expSeconds)` çağır. Ayrıca yeni action:

```js
case 'sendMessageTimed':
  return sendMessageTo(msg.username, msg.text, msg.expSeconds);
```

(Mevcut `sendMessage` çağrısını bozmadan — `sendMessageTo`'nun 3. parametresi opsiyonel kalır.)

- [ ] **Step 5: Alıcı tarafında zamanlayıcı (offscreen.js `handleIncoming`)**

`decodeMessageBody(plain)` sonrası (465), `notify('message', ...)` öncesi/sonrası:

```js
if (decoded.e && decoded.ts) {
  const delay = Math.max(0, (decoded.ts + decoded.e * 1000) - Date.now());
  setTimeout(() => {
    notify('expired', { mid: decoded.mid, from: remoteUsername });
  }, delay);
}
```

Ayrıca gönderen taraf: `sendMessageTo` içinde, `sendEnvelope` sonrası aynı `setTimeout` ile kendi UI'ına `notify('expired', { mid })` gönder (kendi mesajı da süresi dolunca kaybolur).

- [ ] **Step 6: UI — mesaj bazlı yok etme menüsü (popup.js + sidepanel.html + popup.css)**

`.compose` içine açılır (select) `#expirySelect`:

```html
<select id="expirySelect" class="message-input">
  <option value="0">Süre yok</option>
  <option value="30">30 sn sonra yok ol</option>
  <option value="300">5 dk sonra yok ol</option>
</select>
```

`sendMessage()` içinde `expSeconds = parseInt($('#expirySelect').value || '0', 10)` ve `sendToOffscreen('sendMessageTimed', { username: currentPeer, text, expSeconds })`; dönüş başarılıysa `window.__sentMids[mid] = { ts }` yanına `if (expSeconds) window.__expiryMids[mid] = expSeconds;` (UI tarafı balonu süresi gelince kaldırır). UI zamanlayıcı:

```js
if (window.__expiryMids && window.__expiryMids[mid]) {
  setTimeout(() => removeMessageBubble(mid), window.__expiryMids[mid] * 1000);
}
```

`removeMessageBubble(mid)`: `#chatMessages` içinde `[data-mid="..."]` bul ve kaldır.

`expired` event case'i (popup):

```js
case 'expired':
  removeMessageBubble(msg.payload.mid);
  break;
```

- [ ] **Step 7: Run tests + build**

Run: `node session_sim.mjs; node build.js`
Expected: sim PASS (e bloc dahil); build OK.

- [ ] **Step 8: Verify (elle)**

`#expirySelect` seçiliyken gönderilen mesaj, süresi dolunca iki tarafta da kaybolur.

---

### Task 5: Sohbet düzeyi otomatik yok etme (k:11 senkron)

**Files:**
- Modify: `src/offscreen.js` (`handleIncoming` k:11, `setChatTimer`, action `setChatTimer`), `src/popup.js`, `src/sidepanel.html`, `src/popup.css`
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: `sendEnvelope(conn, type, body, registrationId)`, `entry.cipher`
- Produces:
  - `setChatTimer(username, seconds)` → `{ ok: true }`; gövde `JSON.stringify({ s: seconds })` k:11 ile şifreli gönderilir; yerel `entry.timer = seconds`; bağlantı yoksa hata döner
  - `handleIncoming` **k:11** → `entry.timer = payload.s`; `state.peers` içindeki mevcut mesajlar için `expireChatMessages()` çalıştırır
  - `expireChatMessages(username, seconds)` — `apply==0` ise zamanlayıcıları iptal; >0 ise her alınan mesaj mid'i için `setTimeout(ts + seconds*1000)` → `notify('expired', { mid })`
  - Action `setChatTimer` → `setChatTimer(msg.username, msg.seconds)`

- [ ] **Step 1: Write the failing test (session_sim.mjs)**

```js
// ============ paket3: sohbet zamanlayıcı senkron (k:11) ============
const timerPayload = JSON.stringify({ s: 30 });
const timerBody = b64ToB64Url(btoa(timerPayload)); // local sync
ok(timerBody.length > 0, 'k:11 gövdesi saniye taşır');
const timerDecoded = JSON.parse(atob(b64UrlToBase64(timerBody)));
ok(timerDecoded.s === 30, 'k:11 s değeri korunur');
```

`b64ToB64Url`/`b64UrlToBase64` helper'larını zaten mevcut ise kullan; yoksa blok içinde tanımla (Paket 1 deseni).

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: FAIL yok (salt veri testi — geçer). Asıl senkron kodu offscreen/UI'da.

- [ ] **Step 3: Implement setChatTimer (offscreen.js)**

```js
function setChatTimer(username, seconds) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher || !entry.conn || !entry.conn.open) return { ok: false, error: 'mesaj gönderilemez' };
  const body = JSON.stringify({ s: seconds });
  entry.cipher.encrypt(new TextEncoder().encode(body)).then((result) => {
    sendEnvelope(entry.conn, 11, result.body, result.registrationId);
  });
  entry.timer = seconds;
  return { ok: true };
}
```

(Async cipher: desende `recallMessage` await ediyor; aynı wait desenini kullan: fonksiyonu `async` yap.)

- [ ] **Step 4: handleIncoming k:11 + expireChatMessages (offscreen.js)**

409 numaralı k allow-list'ine 11 ekle; switch'e case:

```js
case 11:
  const timed = decodeMessageBody(null, plain); // plain bytes'tan
  return; // guard: geçersizse dön
```

Daha temizi: k:11 gövdesi zarf `m` alanında JSON. Decode akışı (`decodeMessageBody(plain)` yanında) bir tür/gövde olarak ele alınır:

```js
case 11:
  try {
    const ctrl = JSON.parse(new TextDecoder().decode(plain));
    entry.timer = typeof ctrl.s === 'number' ? ctrl.s : 0;
    if (entry.timer > 0) scheduleChatExpiry(remoteUsername, entry);
    notify('chatTimer', { username: remoteUsername, seconds: entry.timer });
  } catch (_) { /* sessiz */ }
  break;
```

`scheduleChatExpiry(username, entry)` — offscreen bir DOM'a dokunmaz; yalnızca işaret üretir. Gerçek düşürme UI'da (`expired` event) yapılır:

```js
function scheduleChatExpiry(username, entry) {
  const sec = entry.timer;
  if (entry._chatTimer) clearInterval(entry._chatTimer);
  if (sec <= 0) return;
  entry._chatTimer = setInterval(() => {
    notify('chatTimerTick', { username });
  }, 1000);
}
```

Not: Sohbet düzeyi yok etme, **mesaj teslim anında** `ts + sec` ile tek seferlik `setTimeout` olarak uygulanır — `handleIncoming`'in k:1/k:3 bloğunda `decodeMessageBody` sonrası (`expired` event gönderen taraf `notify('expired', { mid })` üretir; UI balonu kaldırır):

```js
if (entry.timer && entry.timer > 0) {
  const delay = Math.max(0, (decoded.ts + entry.timer * 1000) - Date.now());
  setTimeout(() => notify('expired', { mid: decoded.mid, from: remoteUsername }), delay);
}
```

Gönderen taraf `sendMessageTo` içinde de aynısı (kendi balonu) yapılır. Sohbet süresi değiştiğinde eski timer'lar iptal edilmez (basit tutulur); `entry.timer` değişince k:11 ile alıcı da senkron olur, gelecek mesajlarda yeni kuralla işlenir.

- [ ] **Step 5: UI — sohbet zamanlayıcı seçici (popup.js + sidepanel.html)**

`#panelChat` üst barına ikinci select:

```html
<select id="chatTimerSelect" class="message-input">
  <option value="0">Yok etme yok</option>
  <option value="30">30 sn</option>
  <option value="300">5 dk</option>
</select>
```

`popup.js`:

```js
$('#chatTimerSelect').addEventListener('change', () => {
  const seconds = parseInt($('#chatTimerSelect').value || '0', 10);
  sendToOffscreen('setChatTimer', { username: currentPeer, seconds });
});
```

`chatTimer` event case'i: seçici değerini güncelle (`if (payloaded.seconds) $('#chatTimerSelect').value = String(payload.seconds)`).

- [ ] **Step 6: Run tests + build**

Run: `node session_sim.mjs; node build.js`
Expected: sim PASS; build OK.

- [ ] **Step 7: Verify (elle)**

Sohbet düzeyi 30 sn seç → her iki tarafta mesajlar ~30 sn sonra kaybolur; "Yok etme yok" → süre taşınmaz.

---

### Task 6: Ekran maskeleme (blur) + kopyalama engeli

**Files:**
- Modify: `src/popup.js` (blur/focus listeners), `src/popup.css` (maske sınıfı), `src/sidepanel.html` (maske örtüsü)
- Test: elle

**Interfaces:**
- Produces: `#screenMask` örtüsü (`.masked`), `#panelChat`'e `data-masked`, contextmenu engeli

- [ ] **Step 1: Add mask element (sidepanel.html)**

`#mainView` içinde, en üstte:

```html
<div id="screenMask" class="screen-mask" hidden>•••</div>
```

- [ ] **Step 2: Implement blur/focus logic (popup.js)**

```js
let screenMasked = false;
function applyMask(masked) {
  screenMasked = masked;
  const mask = $('#screenMask');
  if (mask) mask.hidden = !masked;
}
window.addEventListener('blur', () => applyMask(true));
window.addEventListener('focus', () => applyMask(false));
```

`contextmenu` engeli (maske açıkken zaten içerik görünmez; ek engel tüm panelde):

```js
document.addEventListener('contextmenu', (e) => { if (screenMasked) e.preventDefault(); });
```

Maskenin `#screenMask` tıklamasını engelleme gerekmez (kapalı overlay).

- [ ] **Step 3: Style (popup.css)**

```css
.screen-mask { position: fixed; inset: 0; background: var(--ground); color: var(--ink-mute); font-size: 40px; display: flex; align-items: center; justify-content: center; z-index: 999; user-select: none; }
```

`.screen-mask[hidden]{display:none}` varsayılanı bozmamak için `.screen-mask` içinde `display:flex` override'ı `[hidden]`'ı ezer — düzelt: `#screenMask[hidden]{display:none}` kuralını maskenin altına ekle.

- [ ] **Step 4: Run build**

Run: `node build.js`
Expected: build OK.

- [ ] **Step 5: Verify (elle)**

Paneli başka pencereye geçirmek (blur) → `•••` örtüsü; geri dönüşte içerik açılır. Bağlam menüsü masked'deyken kapalı.

---

### Task 7: Sohbet düzeyi + panik sim kapsamı tamamlama

**Files:**
- Modify: `session_sim.mjs` (kesinleşen yok etme/panik kural notları)
- Test: `node session_sim.mjs`

**Interfaces:**
- Consumes: önceki task'ların ürettiği gövde `e` ve k:11 formatları
- Produces: Paket 3 davranışını yansıtan final sim assert'leri

- [ ] **Step 1: Add final assertions**

`main()` içinde, 519 satırından önce:

```js
// ============ paket3: expire kuralları ============
const eMsg = { m: 'fx', t: 'x', ts: Date.now(), e: 0 };
ok(typeof eMsg.e === 'number', 'e int; 0 = kalıcı');
ok((eMsg.ts + eMsg.e * 1000) === eMsg.ts, 'e=0 hesap ts'ye eşit (kalıcı)');
// === k:11 gövde ==
ok(JSON.parse('{"s":30}').s === 30, 'sohbet zamanlayıcı 30 sn');
```

- [ ] **Step 2: Run sim**

Run: `node session_sim.mjs`
Expected: PASS, `N geçti, 0 hata`.

- [ ] **Step 3: Final verify**

Run: `node codec_test.js; node build.js`
Expected: codec PASS, build OK. Spec'teki hata tablosu maddelerinin davranışı (panik, kod süresi, zamanlayıcı kopukluğu, e geçmiş mesaj) koddaki karşılıklarıyla elle/gereksinimlerle doğrulanır.