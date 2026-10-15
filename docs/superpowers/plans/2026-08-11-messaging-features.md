# ILQ — Okundu Kaşesi, QR Kod, i18n ve Görsel İşleme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mühürlü Kargo dünyasındaki ILQ (Mühürlü Kargo) P2P mesajlaşma eklentisine dört yetenek ekler: okundu kaşesi (k:12 read-receipt), QR bağlantı kodu (üretim + kamera okuma), i18n (TR+EN) ve tümünün mevcut dünyaya görsel işlenmesi.

**Architecture:** Katman ayrımı korunur — `offscreen.js` P2P + Signal (RAM-only), `popup.js` tek UI yüzeyi (sidepanel.html'e hizmet eder, background üzerinden offscreen'e mesaj atar). k:12, mevcut k:6 delivered deseninin birebir kopyasıdır (fire-and-forget, `{ m: mid }` gövde, `sendEnvelope` ile). QR üretimi `qrcode` lib'i esbuild'e girer; okuma `BarcodeDetector` + `getUserMedia` (manifest'e `videoCapture`). i18n saf JS sözlük modülüdür (`src/i18n.js`), `t(key, vars?)` + `data-i18n` DOM süpürme, RAM seçim. Görsel işleme tüm değişikliklerde mevcut token/kaşe/kesik-kenar dilinin türevidir.

**Tech Stack:** Vanilla JS (esbuild IIFE bundle, `chrome110` target), @privacyresearch/libsignal-protocol-typescript, peerjs, `qrcode` (yeni bağımlılık, üretim QR için), BarcodeDetector + getUserMedia (okuma), node:test built-in (Node v24.12.0) — test sayacı `npm test`.

## Global Constraints

(spec'ten birebir ve doğrulanmış kod gerçekleri; her görevin gereksinimleri bu bölümü içerir)

- **RAM-only:** hiçbir şey diske yazılmaz — `chrome.storage`/`localStorage`/`IndexedDB` kullanılmaz. Dil seçimi, outbox, okundu bayrakları, adres defteri, tema durumu hepsi RAM'de (uzun süreli oturum).
- **k:6 delivered dokunulmaz:** mevcut zarf türü, dispatcher case'i ve UI çizimi (çift tik SVG) aynen kalır; k:12 yeni, ayrı zarf türüdür. **k:11 chatTimer da dokunulmaz** (aynı deseni izler).
- **k:12 gövdesi** `{ m: mid }` — tek alan, tek seferlik, talep akışı yok. Mevcut `sendEnvelope(conn, type, body, regId)` altyapısı ve k:4/k:5/k:6/k:11 çözüm yolu.
- **Per-sohbet okundu kapatma:** kullanıcı bir sohbet için k:12 **göndermeyi** kapatabilir; okuma ve alıcı tarafı kabulü her zaman çalışır (sessiz red yok).
- **Okundu çizimi:** yalnızca çizim durumu, kaşe metni yok (tooltip i18n kapsamında opsiyonel — asgari tutulur). `read` = çift tik, ikinci tik `--trust-deep` kabartma tonunda.
- **QR üretimi:** içerik mevcut `encodeCode` çıktısının ta kendisi (format/payload/TTL değişmez), tek kullanımlık prekey + 5 dk TTL korunur.
- **QR okuma:** yalnızca tarama aktifken kamera açık; iptalde/dışında `stream.getTracks().stop()`; manuel giriş her koşulda çalışır. `BarcodeDetector` yoksa tarama butonu gizlenir.
- **i18n sınırı:** mesaj içerikleri çevrilmez; dosya kartlarında sistem metinleri çevrilir, kullanıcı dosya adı çevrilmez.
- **Offscreen hataları:** kullanıcıya doğrudan gösterilmez — `error.*` anahtarı döner, arayüz `t()` ile çevirir.
- **Dil taşıyıcıları:** `t(key, vars?)`, `t('error.timeout', { seconds: 5 })` deseni; `data-i18n`, `data-i18n-placeholder` (ayrıca `data-i18n-title`, `data-i18n-aria` UI nitelikleri için); dil değişince `applyI18n(document)` ile yeniden süpürme.
- **Build/verification:** her görev `node build.js` ile doğrulanır (dist/ üretir).
- **Detector (impeccable):** `node "C:/Users/NEMESIS/.config/opencode/skills/impeccable/scripts/detect.mjs" --json src/sidepanel.html src/popup.css src/sidepanel.css src/popup.js` — exit 0, ek warning yok (yalnızca belgelenmiş micro-value advisory'leri kalabilir).
- **Test gerçeği:** repo'da HİÇ test yok; spec'teki "mevcut uçtan uca Signal simülasyonu deseni" gerçekte yok. Plan node:test ile **yalnızca saf mantığı** test eder: `src/codec.js` round-trip (mevcut), `src/i18n.js` sözlük tutarlılığı + HTML `data-i18n` anahtar varlığı (yeni). Chrome/DOM'a bağlı glue (offscreen, popup QR/kamera) build + detektör + manuel smoke ile doğrulanır (projenin gerçek doğrulama kültürü bu).
- **ESM kökü:** package.json'a `"type": "module"` eklenir (testlerin `src/*.js` import edebilmesi için), `build.js` → `build.cjs` yeniden adlandırılır. Bundlarla alakası yok (esbuild IIFE hedefi zaten ESM sözdizimi kullanıyor); `npm run build` script değişir.
- **Kapsam dışı:** çoklu cihaz, anahtar yedeği, yeni ritüel/damga envanteri, mesaj içeriği çevirisi, teslimat göstergelerinde kapsamlı yeniden tasarım.
- **CSS/mimari koruması:** yeni token yok (mevcut `--trust-deep`, `--msg-status`, `--surface*`, `--ink` vb.); yeni bileşenler mevcut kaşe/delikli-kenar/modal dillerini yeniden kullanır. `.msg-status` 9px kalır; `--msg-status` teması tema başına tanımlı.

---

## Task 0: Test altyapısı + ESM kökü + codec regresyon testi

**Files:**
- Modify: `package.json` (`"type": "module"`, `scripts.test`, `scripts.build` → `node build.cjs`)
- Rename: `build.js` → `build.cjs` (içerik değişmez)
- Create: `tests/codec.test.mjs`

**Interfaces:**
- Consumes: mevcut `src/codec.js` export'ları `encodeCode(fields)`, `decodeCode(code)`.
- Produces: `npm test` komutu (tüm alt görevlerin doğrulama aracı); ESM import kökü; yeniden adlandırılmış `build.cjs`.

- [ ] **Step 1: package.json'a ESM kökü ve test script'i ekle**

`package.json`: `"type": "module"` (scripts ile aynı seviyede), scripts:

```json
"scripts": {
  "build": "node build.cjs",
  "test": "node --test tests/"
}
```

- [ ] **Step 2: build.js → build.cjs yeniden adlandır**

build.js'i build.cjs yap (`git yok, rename yeterli`):

```powershell
Rename-Item build.js build.cjs
```

- [ ] **Step 3: codec regresyon testini yaz**

`tests/codec.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCode, decodeCode } from '../src/codec.js';

test('round-trip: tüm alanlar korunur', () => {
  const fields = {
    u: 'abcde234567abcdef234',
    r: 42,
    spkId: 12,
    ik: 'aGVsbG8=',
    spk: 'c3Vr',
    spkSig: 'c2lnbg==',
    opkId: 13,
    opk: 'b3Br',
    exp: Date.now() + 5000,
  };
  const code = encodeCode(fields);
  const back = decodeCode(code);
  assert.equal(back.u, fields.u);
  assert.equal(back.r, fields.r);
  assert.equal(back.spkId, fields.spkId);
  assert.equal(back.ik, fields.ik);
  assert.equal(back.spk, fields.spk);
  assert.equal(back.spkSig, fields.spkSig);
  assert.equal(back.opkId, fields.opkId);
  assert.equal(back.opk, fields.opk);
  assert.equal(back.exp, fields.exp);
});

test('legacy ILQ1. önekli kodlar da çözülür', () => {
  const fields = { u: 'abc', r: 1, spkId: 2, ik: 'a', spk: 'b', spkSig: 'c', opkId: 3, opk: 'd' };
  const back = decodeCode('ILQ1.' + encodeCode(fields));
  assert.equal(back.u, 'abc');
});

test('ad-resimli metin (20 haneli) reddedilir', () => {
  assert.throws(() => decodeCode('abcde234567abcdef234'), /Kimliğim/);
});

test('eksik alan reddedilir', () => {
  assert.throws(() => decodeCode(encodeCode({ u: 'abc' })), /eksik alan/);
});

test('boş kod reddedilir', () => {
  assert.throws(() => decodeCode(''), /girilmedi/);
});
```

- [ ] **Step 4: testleri çalıştır — geçmeli**

Run: `npm test`
Expected: `pass ... 5`, exit 0. (codec.js doğru; bu bir regresyon ağıdır.)

- [ ] **Step 5: build'i doğrula**

Run: `npm run build`
Expected: `dist/` üretilir, `offscreen.js` + `popup.js` bundle olur, kopyalar loglanır, exit 0.

- [ ] **Step 6: Checkpoint**

Kısa açıklama: ESM kökü + node:test altyapısı kuruldu; build.CJS uyumlu; codec regresyon ağı yeşil.

---

## Task 1: Okundu kaşesi — protokol (offscreen.js)

Mevcut k:6 deseninin kopyası; yeni zarf türü k:12. outbox kaydına `read` bayrağı; alıcı tarafı k:12 işleme; gönderen tarafı `sendRead` fire-and-forget.

**Files:**
- Modify: `src/offscreen.js:352` (setRecallWindow outbox kaydı), `src/offscreen.js:645` (k beyaz listesi), `src/offscreen.js` k:6 case (758–768) model alınarak k:12 case eklenir, `src/offscreen.js:534` (sendDeliveredAck) model alınarak `sendRead` eklenir, dispatcher (1032 civarı) `case 'sendRead'`.
- Test: `tests/` (bu görevde yok — UI göreviyle birlikte gerçek doğrulama); build + manuel smoke.

**Interfaces:**
- Consumes: `setRecallWindow` (352), `sendEnvelope` (309).
- Produces: `notify('read', { username, mid })`; dispatcher eylemi `sendRead` → `{ ok: boolean }`; outbox kaydı `{ ts, sent, delivered, read }`.

- [ ] **Step 1: outbox kaydına `read: false` ekle**

`src/offscreen.js:352` — şu satırı değiştir:

```js
  entry.outbox.set(mid, { ts: Date.now(), sent: true, delivered: false });
```

→

```js
  entry.outbox.set(mid, { ts: Date.now(), sent: true, delivered: false, read: false });
```

- [ ] **Step 2: k:12 zarf türünü beyaz listeye ekle**

`src/offscreen.js:645` — şu satırı değiştir:

```js
    if (![1, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(envelope.k)) return;
```

→

```js
    if (![1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(envelope.k)) return;
```

- [ ] **Step 3: `sendRead` (gönderen tarafı fire-and-forget) ekle**

`sendDeliveredAck` fonksiyonundan (534) hemen sonra ekle:

```js
// Paket read: kullanıcı mesajı gördüğünde gönderene k:12 okundu onayı yollar.
// Fire-and-forget: gönderilemezse gönderende çizim durumu değişmez (sessiz hata).
// Per-sohbet kapatma arayüz tarafında uygulanır; burada yalnızca gönderim var.
function sendRead(username, mid) {
  try {
    const entry = state.peers.get(username);
    if (!entry || !entry.cipher) return { ok: false, error: 'error.noConnection' };
    entry.cipher.encrypt(new TextEncoder().encode(JSON.stringify({ m: mid })).buffer)
      .then((r) => { sendEnvelope(entry.conn, 12, r.body, r.registrationId); })
      .catch(() => { /* sessiz — okundu rozeti gönderilemezse tek tik kalır */ });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'error.sendReadFailed' };
  }
}
```

Note: `JSON.stringify({ m: mid })` — `mid` string geleceği garantisi popup tarafında; güvenlik için `String(mid)` zorunlu değildir çünkü gövde zaten şifrelenir ve tek alan sayısaldır. Yine de `{ m: mid }` k:4/k:5/k:6 lesiyle birebir uyumludur.

- [ ] **Step 4: handleIncoming'a k:12 case ekle**

k:11 case bloğunun ardından, handleIncoming'in `else if` zincirine k:12 case ekle (k:6 case 758–768 deseninin kopyası):

```js
    } else if (envelope.k === 12) {
      // Okundu onayı (k:12): alıcı mesajı görünce gönderenin outbox kaydı read olur.
      // Bilinmeyen mid sessizce atlanır (k:6 ile aynı posture).
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      const ctl = decodeMessageBody(plain);
      const myEntry = state.peers.get(remoteUsername);
      if (myEntry && myEntry.outbox && myEntry.outbox.has(ctl.mid)) {
        myEntry.outbox.get(ctl.mid).read = true;
        notify('read', { username: remoteUsername, mid: ctl.mid });
      }
    }
```

- [ ] **Step 5: dispatcher'a `case 'sendRead'` ekle**

`case 'sendTyping'` bloğunun ardına (1049–1061 sonrası) ekle:

```js
        case 'sendRead':
          return sendRead(msg.username, msg.mid);
```

- [ ] **Step 6: build'i doğrula**

Run: `npm run build` → dist/ üretilir, exit 0.

- [ ] **Step 7: Manuel smoke (iki pencereli)**

1. Offscreen sayfasını yeniden yükler (dist'e build edilen bundle yeni kod içerir).
2. `npm test` hâlâ yeşil (öncesine göre değişiklik yok).
3. İki profil bazı (A-B) bağlan, parmak izi onayla. A'dan mesaj gönder → B'de görünür. **B'de balon göründüğü anda** A'da durum çift tik'e dönüşür (Task 2 UI tamamlanınca görünür; bu adımda konsol/notify beklenir).
4. Kapatma (Task 2) öncesi regresyon: k:3/k:1/k:6 akışının bozulmadığını doğrula (Panik + yeniden bağlantı).

- [ ] **Step 8: Checkpoint**

k:12 tüm protokolü: outbox.read, beyaz liste, gönderen fire-and-forget, alıcı işleme, notify('read'). Build yeşil.

---

## Task 2: Okundu kaşesi — arayüz (popup.js / popup.css / sidepanel.html)

Görünür olduğu anda k:12 gönderimi (otomatik), per-sohbet kapatma geçişi, `read` case'inde çift tik (`--trust-deep` ikinci tik).

**Files:**
- Modify: `src/popup.js` (`case 'message'`, `openPeer`, dispatcher'a `case 'read'`, `sendReadIfVisible`, `flushReads`), `src/sidepanel.html` (chatHeader'e readAckBtn), `src/popup.css` (`.read-ack-toggle`).
- Test: `npm run build` + manuel smoke. UI çizimi için detektör koşulur.

**Interfaces:**
- Consumes: `notify('read', { username, mid })` (Task 1); `sendToOffscreen('sendRead', { username, mid })`.
- Produces: `addMessage` sonrası giden balonda tek tik; `msg-status` öğesinde `data-mid` ile eşleşen `read` case çift tik; `window.__readAckOff` (per-sohbet RAM küme).

Tasarım kararı (spec sınırı): k:12 yalnızca **mesaj balonu render edildiği ve o sohbetin penceresi görünür olduğu anda** ateşlenir. Sohbet sekmeli olduğu için: mesaj `activePeer`'a ait değilse (başka sekmede), `openPeer` o sekmeye geçince toplu gönderilir. Görünürlük sınırı: `mainView` görünür (login hidden) ve `panelChat` aktif.

- [ ] **Step 1: popup.js — read bekleme kitlesi (pending) + per-sohbet kapatma ekle**

global tanımların yanına (satır 7 civarı) ekle:

```js
window.__readAckOff = {}; // username -> true (o sohbette k:12 gönderme kapalı), RAM-only
window.__pendingRead = {}; // username -> Set<mid> — henüz k:12 gönderilmemiş mesajlar
```

- [ ] **Step 2: `sendReadIfVisible` + `queueRead` + `flushReads` yardımcılarını ekle**

`openPeer` fonksiyonundan (100) önce ekle:

```js
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
  set.clear();
  // Sohbet görünür hale geldi: bekleyen her mesaj artık okundu — her biri için k:12.
  // (Per-sohbet kapatma sendReadIfVisible içindeki __readAckOff kontrolüyle elenir.)
  for (const mid of set) sendReadIfVisible(username, mid);
}

function isChatVisible() {
  const mainHidden = $('mainView').classList.contains('hidden');
  const panelHidden = $('panelChat').classList.contains('hidden');
  return !mainHidden && !panelHidden;
}
```

Not: `flushReads`, `openPeer` içinde sekme görünür olduğu anda çağrılır; her bekleyen mid için ayrı k:12 zarfı gider (UI durumu `delivered` → `read` geçişini mesaj başına alır). Set temizlenir çünkü okuma anlık gerçekleşmiştir.

- [ ] **Step 3: `case 'message'` içine `queueRead` çağrısı ekle**

`popup.js:430-438` 'message' case'ine, `addMessage` çağrısından sonra ekle:

```js
      queueRead(msg.payload.from, msg.payload.mid);
```

- [ ] **Step 4: `openPeer` içine `flushReads` çağrısı ekle**

`openPeer`'ın sonuna (renderTabs sonrası) ekle:

```js
  if (username) flushReads(username);
```

- [ ] **Step 5: dispatcher'a `case 'read'` ekle**

`case 'delivered'` bloğundan (521) sonra ekle:

```js
    case 'read': {
      const midEl = document.querySelector('#chatMessages .msg[data-mid="' + msg.payload.mid + '"] .msg-status');
      if (midEl) midEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 13l4.5 4.5L20.5 6"/><path d="M10.5 13.5 15 18.5 20.5 13" stroke="var(--trust-deep)"/></svg>';
      break;
    }
```

Not: k:6 delivered çizimi (çift tik, her ikisi `currentColor`) aynen kalır; `read` aynı geometriyi ikinci tik `--trust-deep` ile çizer — iki durum görsel olarak ayrışır, spec'in "delivered tek tik korunur" kuralı çizim temelinde korunur (mevcut delivered zaten çift tiktir).

- [ ] **Step 6: per-sohbet kapatma geçişi (chatHeader) ekle**

`src/sidepanel.html` chatHeader (191-206) `typingHint` span'ından sonra, `chatTimerSelect`'den önce bir buton ekle:

```html
          <button id="readAckBtn" class="read-ack-toggle" type="button" title="Okundu kaşesi" aria-pressed="true">Okundu açık</button>
```

- [ ] **Step 7: popup.js — per-sohbet kapatma geçişini bağla**

`chatTimerSelect` addEventListener'inin yanına ekle:

```js
/* --- paket read: per-sohbet okundu kapatma --- */
const readAckBtn = $('readAckBtn');
if (readAckBtn) {
  const renderReadToggle = () => {
    const off = !!window.__readAckOff[activePeer];
    readAckBtn.textContent = off ? 'Okundu kapalı' : 'Okundu açık';
    readAckBtn.classList.toggle('off', off);
    readAckBtn.setAttribute('aria-pressed', String(!off));
    readAckBtn.title = off ? 'Okundu kaşesi kapalı' : 'Okundu kaşesi';
  };
  readAckBtn.addEventListener('click', () => {
    if (!activePeer) return;
    window.__readAckOff[activePeer] = !window.__readAckOff[activePeer];
    renderReadToggle();
  });
  renderReadToggle();
}
```

Not: `window.__readAckOff` map'i sohbet başına kapatma tutar (spec "per-sohbet"); aktif sohbet yoksa geçiş yapılmaz. Seçim RAM'de, oturum boyu. Alıcı tarafı (offscreen k:12 handler) bu ayardan bağımsız olarak her zaman kabul eder — spec'in "sessiz red yok" ilkesi.

- [ ] **Step 8: popup.css — `.read-ack-toggle` stilleri**

`.chatheader` bölümünün altına ekle:

```css
.read-ack-toggle {
  flex: none;
  border: 1px dashed var(--hairline-strong);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 6px;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}
.read-ack-toggle:hover { background: var(--surface-2); color: var(--ink); }
.read-ack-toggle.off {
  color: var(--ink-mute);
  border-style: solid;
  text-decoration: line-through;
  opacity: 0.75;
}
```

- [ ] **Step 9: build + detektör doğrula**

Run: `npm run build` ve `node "C:/Users/NEMESIS/.config/opencode/skills/impeccable/scripts/detect.mjs" --json src/sidepanel.html src/popup.css src/sidepanel.css src/popup.js`
Expected: build exit 0; detektör exit 0 (ek yeni warning yok).

- [ ] **Step 10: Manuel smoke**

A-B bağlan, onayla. A'dan mesaj gönder. B'de balon görününce A'da iki tik (ikinci tik `--trust-deep`, A bone temasında koyu yeşil ton). B, readAckBtn ile "Okundu kapalı" yapıp başka mesaj gönderirse A'da ikinci tik gelmez (tek tik kalır). Eski delivered rozetinin çift tik çizimi değişmemiş olmalı.

- [ ] **Step 11: Checkpoint**

Read UI: otomatik görünürlük tetiği, per-sohbet kapatma, `--trust-deep` ikinci tik çizimi. Build + detektör yeşil.

---

## Task 3: QR — bağımlılık + manifest izni

**Files:**
- Modify: `package.json` (dependencies → `qrcode`), `src/manifest.json` (permissions → `"videoCapture"`).
- Test: `npm run build` (qrcode bundle'a girer — esbuild platform browser field okur).

**Interfaces:**
- Consumes: — (bağımlılık eklentisi).
- Produces: `import QRCode from 'qrcode'` kullanılabilir hale gelir (browser bundle); getUserMedia izni manifest'te.

- [ ] **Step 1: qrcode paketini kur**

Run: `npm install qrcode@1.5.4` (package.json dependencies'a düşer).

- [ ] **Step 2: manifest'e `videoCapture` iznini ekle**

`src/manifest.json:6`:

```json
  "permissions": ["offscreen", "sidePanel", "videoCapture"],
```

- [ ] **Step 3: build ile qrcode'un bundle'a girdiğini doğrula**

Run: `npm run build`
Expected: `dist/popup.js` içinde qrcode modülü (bundle boyutu artar), exit 0. Hata varsa qrcode'un browser field'ı esbuild tarafından çözülür — `external` listesi popup bundle'ında yok (offscreen bundle'ındaki node builtin external'ları popup'a uygulanmaz).

- [ ] **Step 4: Checkpoint**

qrcode kuruldu; manifest `videoCapture` içeriyor; build yeşil.

---

## Task 4: QR — üretim (panelCode manila zarfı)

Üretilen kodun altına manila QR kartı; `--ink` mürekkep + `--ground` zemin, delikli-kenar köşe detayı; kaşe tipografisi (10.5–11.5px, harf aralıklı).

**Files:**
- Modify: `src/sidepanel.html` (panelCode içine `.qr-wrap` bloğu), `src/popup.js` (`renderQr`, genCodeBtn'de çağrı), `src/popup.css` (`.qr-wrap`, `#qrCanvas`, `.qr-note`).
- Test: `npm run build` + detektör + manuel smoke.

**Interfaces:**
- Consumes: `generatedCode` öğesi (code-readout); `res.code` (generateCode yanıtı).
- Produces: `#qrCanvas` (QR bitmap) + `.qr-note` (yalnızca güvendiğin kişiye göster).

- [ ] **Step 1: sidepanel.html — QR bloğu ekle**

`panelCode` içinde `#codeCountdown` (175) sonrasına ekle:

```html
          <div class="qr-wrap" hidden>
            <canvas id="qrCanvas" aria-label="QR kod"></canvas>
            <p class="qr-note">Bu kodu yalnızca güvendiğin kişiye göster.</p>
          </div>
```

- [ ] **Step 2: popup.js — `renderQr` ekle**

`renderCodeCountdown` (700) yakınına ekle:

```js
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
```

- [ ] **Step 3: genCodeBtn içinde renderQr çağrısı**

`$('genCodeBtn')` handler'ında `$('generatedCode').textContent = res.code;` satırının hemen ardına ekle:

```js
    renderQr(res.code);
```

- [ ] **Step 4: reset/panic/init sırasında QR'ı gizle**

`case 'reset'` (574–591 arası) ve `case 'panic'` (564–573) ve `confirmReset` (812) içinde `$('codeCountdown').hidden = true;` yanına ekle:

```js
      renderQr('');
```

- [ ] **Step 5: popup.css — QR zarfı stilleri**

`.code-card` bölümünün altına ekle:

```css
.qr-wrap {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--hairline-strong);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.qr-wrap[hidden] { display: none; }
#qrCanvas {
  width: 128px;
  height: 128px;
  background: var(--ground);
  border: 1px solid var(--hairline);
  border-radius: 6px;
  box-shadow: var(--shadow-sm);
}
.qr-note {
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--ink-mute);
  text-align: center;
}
```

- [ ] **Step 6: build + detektör doğrula**

Run: `npm run build` + detektör komutu.
Expected: exit 0; ek warning yok (10.5px zaten DESIGN.md note ramp'inde; detektör tamsayı ramp'inden 10.5 düşüyor — belgelenmiş advisory kategorisi, engel değil).

- [ ] **Step 7: Manuel smoke**

"Kod" sekmesi → "Yeni kod üret" → QR kartı çıkar (128px, manila zemin, delikli üst kenar); kod metni değişince QR güncellenir; süre dolunca (countdown expired) buton basılınca yeni QR gelir; reset/panic'te kart gizlenir. Telefon kamerasıyla QR okutulabilir (içerik = bağlantı kodu).

- [ ] **Step 8: Checkpoint**

QR üretimi çalışıyor; `qrcode` bundle'da; görsel dilde manila zarf. Build+deltör yeşil.

---

## Task 5: QR — okuma (kamera + BarcodeDetector)

Bağlan sekmesinde "Kodu tara" butonu; kamera yalnızca taramada açık; çözülen kod normal `attemptConnect` akışına döner; iptalde kapanır; BarcodeDetector yoksa buton gizlenir; kamera izni reddi → `error.cameraDenied` (i18n anahtarı, popup çevirir).

**Files:**
- Modify: `src/sidepanel.html` (panelConnect'e scanBtn; resetModal yanına scanModal), `src/popup.js` (`attemptConnect` refaktörü, `connectBtn` kullanımı, scan akışı, init'te BarcodeDetector yoksa gizle), `src/popup.css` (scan butonu, kamera modalı + çerçeve).
- Test: `npm run build` + detektör + manuel smoke (kamera izni ver/red, BarcodeDetector yokluğu — Chrome'da yoksa devtools'ta simulate).

**Interfaces:**
- Consumes: `codeInput`; `BarcodeDetector` (tarayıcı yerleşik); `navigator.mediaDevices.getUserMedia`; `connectCode` action (offscreen).
- Produces: `attemptConnect(code)` — connectBtn handler'ının yeniden kullanılabilir hali; `#scanModal`, `#scanVideo`, `scanBtn`, `scanCancelBtn`.

- [ ] **Step 1: sidepanel.html — "Kodu tara" butonu**

`panelConnect` içinde, `#connectBtn` (141) sonrasına ekle:

```html
        <button id="scanBtn" class="secondary scan-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><path d="M4 12h16"/></svg>
          <span>Kodu tara</span>
        </button>
```

(Task 7'de metin span'ına `data-i18n="connect.scan"` eklenecek.)

- [ ] **Step 2: sidepanel.html — kamera modalı**

`resetModal` (232) yanına ekle:

```html
      <div id="scanModal" class="modal hidden">
        <div class="modal-card scan-card">
          <p class="scan-stamp">Kodu çerçeveye getir</p>
          <div class="scan-frame">
            <video id="scanVideo" autoplay playsinline muted></video>
            <div class="scan-corner"></div>
          </div>
          <div class="modal-actions">
            <button id="scanCancelBtn" class="secondary" type="button">Vazgeç</button>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: popup.js — `attemptConnect` refaktörü**

`connectBtn` handler'ını (671–696) `attemptConnect(code)` içine yeniden yaz; buton dinleyicisi parametre gönderir:

```js
async function attemptConnect(code) {
  const text = (code || '').trim();
  if (!text) {
    showTempError('Bağlantı kodu girilmedi');
    return;
  }
  if (/^[a-z2-7]{20}$/.test(text)) {
    showTempError('Bu bir "Kimliğim" (adres), bağlantı kodu değil. Arkadaşından "Kod" sekmesinde ürettiği bağlantı kodunu istemelisin.');
    return;
  }
  const btn = $('connectBtn');
  btn.disabled = true;
  btn.textContent = 'Kuruluyor…';
  $('safetyInfo').classList.remove('hidden');
  const res = await sendToOffscreen('connectCode', { code: text });
  if (res.ok) {
    openPeer(res.peer);
    showPanel('chat');
    setStatus('kuruluyor…', 'chatting');
    refreshSessions();
  } else {
    showTempError(res.error || 'Bağlantı kurulamadı');
  }
  btn.disabled = false;
  btn.textContent = 'Bağlantı kur';
}

$('connectBtn').addEventListener('click', () => attemptConnect($('codeInput').value));
```

- [ ] **Step 4: popup.js — kamera/tarama akışı**

`showDecoy` (845) bölgesine ekle:

```js
/* --- paket QR: kamera ile kod okuma --- */
let scanStream = null;
let scanDetector = null;
let scanRaf = 0;
let scanActive = false;

async function startScan() {
  try {
    if (!('BarcodeDetector' in window)) return; // gerileme: buton zaten gizli
    scanDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (e) {
    showTempError('Kamera izni verilmedi — kodu elle girebilirsin.');
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
```

Not: `getUserMedia` başarısız olursa `showTempError` ham TR — Task 9'da `t('error.cameraDenied')` ile değiştirilir. Şimdilik sabit metin.

- [ ] **Step 5: popup.js — init'te BarcodeDetector yoksa butonu gizle**

Dosya sonundaki init bloğuna (869 civarı) ekle:

```js
if (!('BarcodeDetector' in window)) $('scanBtn').hidden = true;
```

- [ ] **Step 6: popup.css — tarama butonu + kamera çerçevesi**

Modal bölümü yakınına ekle:

```css
.scan-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 4px;
}
.scan-btn svg { width: 14px; height: 14px; flex: none; }
#scanModal .scan-card { max-width: 300px; }
.scan-stamp {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
  text-align: center;
  margin-bottom: 10px;
}
.scan-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: var(--ink);
  border: 1px solid var(--hairline-strong);
  border-radius: 6px;
  overflow: hidden;
}
.scan-frame video { width: 100%; height: 100%; object-fit: cover; display: block; }
.scan-corner {
  position: absolute;
  inset: 10px;
  pointer-events: none;
  background:
    linear-gradient(var(--ground) 0 0) top left / 16px 2px no-repeat,
    linear-gradient(var(--ground) 0 0) top left / 2px 16px no-repeat,
    linear-gradient(var(--ground) 0 0) top right / 16px 2px no-repeat,
    linear-gradient(var(--ground) 0 0) top right / 2px 16px no-repeat,
    linear-gradient(var(--ground) 0 0) bottom left / 16px 2px no-repeat,
    linear-gradient(var(--ground) 0 0) bottom left / 2px 16px no-repeat,
    linear-gradient(var(--ground) 0 0) bottom right / 16px 2px no-repeat,
    linear-gradient(var(--ground) 0 0) bottom right / 2px 16px no-repeat;
}
```

- [ ] **Step 7: build + detektör doğrula**

Run: `npm run build` + detektör.
Expected: exit 0; ek warning yok.

- [ ] **Step 8: Manuel smoke**

1. "Bağlan" → "Kodu tara" → kamera açılır, modal + köşe çerçevesi görünür.
2. Telefon QR'ı kameraya tut → otomatik algılanır, kamera kapanır, `codeInput` dolar, `attemptConnect` başlar.
3. "Vazgeç" → kamera izni kapanır (`scanVideo` source null).
4. İzni reddet → hata mesajı; manuel giriş hâlâ çalışır.
5. Devtools'ta `BarcodeDetector`'ı silinti (`delete window.BarcodeDetector`) → sayfayı yeniden yükle, buton görünmez.

- [ ] **Step 9: Checkpoint**

QR okuma ucu kapalı: kamera yaşam döngüsü, BarcodeDetector entegrasyonu, `attemptConnect` yeniden kullanımı, gerileme (bild detector yok). Build+deltör yeşil.

---

## Task 6: i18n — katman (src/i18n.js) + sözlük + test

Tüm statik/dinamik metinlerin anahtar kümesi; TR+EN; saf JS; RAM seçim; `t(key, vars?)`; `applyI18n`; DOM nitelik desteği (`data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria`).

**Files:**
- Create: `src/i18n.js`
- Create: `tests/i18n.test.mjs`
- Modify: `package.json` scripts → `npm test` zaten `tests/` dizinini tarar (ek değişiklik gerekmez).

**Interfaces:**
- Consumes: `navigator.language` varsayılan; DOM (`applyI18n`).
- Produces: `t(key, vars?)`, `getLang()`, `setLang(lang)`, `applyI18n(root)`, `dict` (test için export). Sonraki tüm görevler bunları kullanır.

Not: Key kümesi aşağıdaki gibidir — HTML (Task 7) ve popup (Task 8) tam olarak bu anahtarları kullanır. Eksik anahtar testi (boş/exişlenmiş) reddeder; HTML `data-i18n*` varlık testi de.

- [ ] **Step 1: failing testi yaz**

`tests/i18n.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { dict, t, getLang, setLang } from '../src/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('tr ve en sözlükleri aynı anahtar kümesini taşır', () => {
  const tr = Object.keys(dict.tr).sort();
  const en = Object.keys(dict.en).sort();
  assert.deepEqual(tr, en);
});

test('hiçbir anahtar boş değil, hiçbiri kendisine çevrilmiyor', () => {
  for (const k of Object.keys(dict.tr)) {
    assert.ok(dict.tr[k].length > 0, 'tr.' + k + ' boş');
    assert.ok(dict.en[k].length > 0, 'en.' + k + ' boş');
    assert.notEqual(dict.tr[k], k);
    assert.notEqual(dict.en[k], k);
  }
});

test('t() vars interpolasyonunu destekler', () => {
  setLang('tr');
  assert.equal(t('x.timeout', { seconds: 5 }), '5 saniye içinde dene');
  setLang('en');
  assert.equal(t('x.timeout', { seconds: 5 }), 'try again in 5 seconds');
});

test('bilinmeyen anahtar için anahtarın kendisi döner', () => {
  assert.equal(t('there.is.no.such.key'), 'there.is.no.such.key');
});

test('HTML data-i18n niteliklerinin tümü her iki dilde de var', () => {
  const html = readFileSync(path.join(__dirname, '..', 'src', 'sidepanel.html'), 'utf8');
  const re = /data-i18n(?:-placeholder|-title|-aria)?="([^"]+)"/g;
  const keys = new Set();
  let m;
  while ((m = re.exec(html))) keys.add(m[1]);
  for (const k of keys) {
    assert.ok(k in dict.tr, 'tr eksik: ' + k);
    assert.ok(k in dict.en, 'en eksik: ' + k);
  }
});
```

- [ ] **Step 2: `src/i18n.js` — sözlük ve API**

```js
/* ILQ i18n — saf JS sözlük; RAM seçim, disk yok (chrome.storage kullanılmaz). */

const dict = {
  tr: {
    'x.timeout': '5 saniye içinde dene',
    'app.start': 'Sohbete başla',
    'app.busy': 'Adres oluşturuluyor…',
    'app.headline': 'Sessiz sohbete başla',
    'app.lede': 'Sunucusuz, kayıtsız ve izsiz. Anahtarlar yalnızca bellekte üretilir; bu cihazın diski hiç yazılmaz.',
    'app.addrNote': 'Konuşmak için arkadaşına bağlantı kodu göndermen yeterli — kimliğini paylaşma.',
    'app.footnote': 'Anahtarlar yalnızca bellekte tutulur; kapatınca bağlantılar biter, iz kalmaz.',
    'net.summary': 'Ağ ayarları (gelişmiş)',
    'net.hostLabel': 'Sinyal sunucusu (opsiyonel)',
    'net.hostPh': 'örn. peer.ornek.com',
    'net.portLabel': 'Port',
    'net.pathLabel': 'Yol',
    'net.iceLabel': 'ICE/TURN sunucuları (JSON)',
    'net.help': 'Boş bırakılırsa PeerJS genel bulutu + Google STUN kullanılır. Kendi TURN''unu eklemek simetrik NAT''ta bağlantıyı garanti eder.',
    'status.offline': 'çevrimdışı',
    'status.online': 'yayında',
    'status.verified': 'doğrulanmış',
    'status.connecting': 'kuruluyor…',
    'status.error': 'hata',
    'status.chatPrefix': 'bağlı · ',
    'panic.label': 'Panik',
    'panic.title': 'Mühürü kır, masayı boşalt',
    'ident.label': 'Kimliğim',
    'ident.reset': 'Kimliği sıfırla',
    'tab.connect': 'Bağlan',
    'tab.code': 'Kod',
    'tab.chat': 'Sohbet',
    'connect.title': 'Bağlan',
    'connect.sub': 'Arkadaşının "Kod" sekmesinde ürettiği bağlantı kodunu yapıştır — rastgele harf/rakam dizisi. (Kendi "Kimliğin" değil.)',
    'connect.ph': 'Arkadaşının gönderdiği kodu yapıştır…',
    'connect.btn': 'Bağlantı kur',
    'connect.scan': 'Kodu tara',
    'connect.safety': 'Bağlantı kurulunca güvenlik numarasını karşı cihazdakiyle karşılaştır. Doğrulanana kadar mesaj gönderilemez.',
    'connect.book': 'Adres defteri',
    'connect.busy': 'Kuruluyor…',
    'theme.label': 'Tema',
    'theme.bone': 'Kemik-beyazı',
    'theme.dark': 'Karanlık',
    'theme.hc': 'Yüksek kontrast',
    'theme.system': 'Sistem',
    'lang.label': 'Dil',
    'code.title': 'Bağlantı kodu',
    'code.sub': 'Üretilen kod rastgele görünümlü bir dizedir — Kimliğin (adresin) bu kodun içinde gömülüdür. Kodu güvenilir bir kanaldan gönder; tek kullanımlıktır.',
    'code.your': 'Kodun',
    'code.copy': 'Kopyala',
    'code.copied': 'Kopyalandı',
    'code.expired': 'Kodun süresi doldu — yeni kod üret.',
    'code.validFor': 'Kodun geçerliliği: ',
    'code.gen': 'Yeni kod üret',
    'code.footnote': 'Bu, tüm kodun kopyalandığından emin ol; baştan ve sondan harf eksiltme kodu bozar.',
    'code.qrNote': 'Bu kodu yalnızca güvendiğin kişiye göster.',
    'scan.stamp': 'Kodu çerçeveye getir',
    'scan.cancel': 'Vazgeç',
    'chat.empty': 'Henüz mesaj yok. Bağlantı başka bir pencereden kurulunca buraya mühürlü teslimatlar düşer.',
    'chat.typing': 'yazıyor…',
    'chat.peer': 'Sohbet',
    'chat.timerTitle': 'Sohbet düzeyi otomatik yok etme',
    'chat.timerOff': 'Yok etme yok',
    'chat.timer30': '30 sn',
    'chat.timer300': '5 dk',
    'chat.expiryOff': 'Süre yok',
    'chat.expiry30': '30 sn sonra yok ol',
    'chat.expiry300': '5 dk sonra yok ol',
    'chat.fileBtn': 'Dosya gönder',
    'chat.ph': 'Şifreli mesaj…',
    'chat.send': 'Gönder',
    'chat.secure': 'Güvenli bağlantı kuruldu.',
    'chat.readOn': 'Okundu açık',
    'chat.readOff': 'Okundu kapalı',
    'chat.readTitle': 'Okundu kaşesi',
    'chat.readTitleOff': 'Okundu kaşesi kapalı',
    'menu.local': 'Yerel sil',
    'menu.remote': 'Karşı taraftan da sil',
    'menu.expired': 'Silme süresi doldu (5 dakika)',
    'chat.recalled': 'Bu mesaj geri çekildi',
    'chat.deletedRemote': 'Karşı tarafta da silindi',
    'file.accept': 'Al',
    'file.decline': 'Reddet',
    'file.view': 'Görüntüle',
    'file.sent': 'Gönderildi',
    'file.complete': 'Dosya tamamlandı',
    'file.declined': 'Karşı taraf reddetti',
    'fp.title': 'Güvenlik numarası',
    'fp.sub': 'Bağımsız bir kanaldan karşılaştır; eşleşiyorsa bağlantı güvenilir.',
    'fp.match': 'Numaralar eşleşiyor',
    'fp.mismatch': 'Eşleşmiyor',
    'fp.verified': 'Bağlantı doğrulandı',
    'fp.mismatchEnded': 'Eşleşmiyor — bağlantı sonlandırıldı. Yeni kod üretip yeniden bağlan.',
    'reset.title': 'Kimliği sıfırla',
    'reset.text': 'Yeni kimlik oluşturulacak. Tüm bağlantılar kapanacak, oturumlar ve sohbet geçmişi silinecek. Bu işlem geri alınamaz.',
    'reset.cancel': 'Vazgeç',
    'reset.confirm': 'Sıfırla',
    'decoy.title': 'Hava Durumu — Bugün',
    'decoy.note': 'İstanbul · 18°C · Parçalı bulutlu',
    'decoy.restart': 'Uygulamayı yeniden başlat',
    'contact.new': 'yeni',
    'contact.verified': 'doğrulanmış',
    'err.noCode': 'Bağlantı kodu girilmedi',
    'err.isAddress': 'Bu bir "Kimliğim" (adres), bağlantı kodu değil. Arkadaşından "Kod" sekmesinde ürettiği bağlantı kodunu istemelisin.',
    'err.connectFailed': 'Bağlantı kurulamadı',
    'err.genFailed': 'Kod üretilemedi',
    'err.sendFailed': 'Gönderilemedi',
    'err.recallSent': 'Geri çekme gönderildi',
    'err.recallFailed': 'Silme gönderilemedi',
    'err.reconnectFailed': 'Yeniden bağlanılamadı',
    'err.fileRecvFailed': 'Dosya alınamadı',
    'err.fileRejectFailed': 'Reddetme gönderilemedi',
    'err.fileSendFailed': 'Dosya gönderilemedi',
    'err.fileRead': 'Dosya okunamadı: ',
    'err.openChatFirst': 'Önce bir sohbet aç',
    'err.verificationFailed': 'Doğrulama işlenemedi',
    'err.connectionError': 'Bağlantı hatası: ',
    'err.cameraDenied': 'Kamera izni verilmedi — kodu elle girebilirsin.',
    'error.timeout': '5 saniye içinde dene',
    'error.noConnection': 'Önce bu kişiyle bağlantı kurmalısın',
    'error.notVerified': 'Güvenlik numarası doğrulanana kadar mesaj gönderilemez',
    'error.emptyMessage': 'Boş mesaj gönderilemez',
    'error.messageTooLong': 'Mesaj çok uzun',
    'error.channelClosed': 'Veri kanalı açık değil',
    'error.recallUnauthorized': 'Bu mesaj silmeye uygun değil (yalnızca kendi gönderdiğin mesajları silebilirsin)',
    'error.recallExpired': 'Silme süresi doldu (5 dakika)',
    'error.codeExpired': 'Kodun süresi doldu veya geçersiz',
    'error.identityChanged': 'Kimlik değişti — güvenlik numarasını doğrula',
    'error.noPendingIdentity': 'Bekleyen kimlik değişimi yok',
    'error.peerLimit': 'Eşzamanlı bağlantı sınırı aşıldı',
    'error.decryptFailed': 'Mesaj çözülemedi: ',
    'error.codeEmpty': 'Bağlantı kodu girilmedi',
    'error.codeIsAddress': 'Bu bir "Kimliğim" (adres), bağlantı kodu değil. Arkadaşından "Kod" sekmesinde ürettiği bağlantı kodunu istemelisin.',
    'error.codeInvalid': 'Geçersiz bağlantı kodu',
    'error.codeIncomplete': 'Bağlantı kodu eksik alan içeriyor',
    'error.codecInvalid': 'Geçersiz bağlantı kodu',
    'error.sendReadFailed': 'Okundu onayı gönderilemedi',
  },
  en: {
    'x.timeout': 'try again in 5 seconds',
    'app.start': 'Start chatting',
    'app.busy': 'Creating address…',
    'app.headline': 'Start a silent chat',
    'app.lede': 'Serverless, accountless and traceless. Keys are generated in memory only; this device''s disk is never written.',
    'app.addrNote': 'To talk, just send your friend a connection code — never share your identity.',
    'app.footnote': 'Keys live in memory only; close it and connections end, leaving no trace.',
    'net.summary': 'Network settings (advanced)',
    'net.hostLabel': 'Signaling server (optional)',
    'net.hostPh': 'e.g. peer.example.com',
    'net.portLabel': 'Port',
    'net.pathLabel': 'Path',
    'net.iceLabel': 'ICE/TURN servers (JSON)',
    'net.help': 'Leave empty to use the PeerJS public cloud + Google STUN. Adding your own TURN guarantees connectivity behind symmetric NAT.',
    'status.offline': 'offline',
    'status.online': 'online',
    'status.verified': 'verified',
    'status.connecting': 'connecting…',
    'status.error': 'error',
    'status.chatPrefix': 'connected · ',
    'panic.label': 'Panic',
    'panic.title': 'Break the seal, clear the desk',
    'ident.label': 'My identity',
    'ident.reset': 'Reset identity',
    'tab.connect': 'Connect',
    'tab.code': 'Code',
    'tab.chat': 'Chat',
    'connect.title': 'Connect',
    'connect.sub': 'Paste the connection code your friend generated in the "Code" tab — a random string of letters and digits. (Not your "My identity".)',
    'connect.ph': 'Paste the code your friend sent…',
    'connect.btn': 'Connect',
    'connect.scan': 'Scan code',
    'connect.safety': 'Once connected, compare the security number with the other device. You cannot send messages until it is verified.',
    'connect.book': 'Address book',
    'connect.busy': 'Connecting…',
    'theme.label': 'Theme',
    'theme.bone': 'Bone',
    'theme.dark': 'Dark',
    'theme.hc': 'High contrast',
    'theme.system': 'System',
    'lang.label': 'Language',
    'code.title': 'Connection code',
    'code.sub': 'The generated code looks like a random string — your identity (address) is embedded in it. Send it over a trusted channel; it''s single-use.',
    'code.your': 'Your code',
    'code.copy': 'Copy',
    'code.copied': 'Copied',
    'code.expired': 'Your code expired — generate a new one.',
    'code.validFor': 'Valid for: ',
    'code.gen': 'Generate new code',
    'code.footnote': 'Make sure you copy the whole code; dropping letters from the start or end breaks it.',
    'code.qrNote': 'Show this code only to someone you trust.',
    'scan.stamp': 'Bring the code into the frame',
    'scan.cancel': 'Cancel',
    'chat.empty': 'No messages yet. Sealed deliveries land here once a connection is opened from another window.',
    'chat.typing': 'typing…',
    'chat.peer': 'Chat',
    'chat.timerTitle': 'Chat-level auto-delete',
    'chat.timerOff': 'No auto-delete',
    'chat.timer30': '30s',
    'chat.timer300': '5m',
    'chat.expiryOff': 'No timer',
    'chat.expiry30': 'Disappear in 30s',
    'chat.expiry300': 'Disappear in 5m',
    'chat.fileBtn': 'Send file',
    'chat.ph': 'Encrypted message…',
    'chat.send': 'Send',
    'chat.secure': 'Secure connection established.',
    'chat.readOn': 'Read on',
    'chat.readOff': 'Read off',
    'chat.readTitle': 'Read receipt',
    'chat.readTitleOff': 'Read receipt off',
    'menu.local': 'Delete locally',
    'menu.remote': 'Delete on the other side',
    'menu.expired': 'Recall window expired (5 minutes)',
    'chat.recalled': 'This message was recalled',
    'chat.deletedRemote': 'Deleted on the other side',
    'file.accept': 'Accept',
    'file.decline': 'Decline',
    'file.view': 'View',
    'file.sent': 'Sent',
    'file.complete': 'File complete',
    'file.declined': 'The other side declined',
    'fp.title': 'Security number',
    'fp.sub': 'Compare over an independent channel; if they match, the connection is trustworthy.',
    'fp.match': 'Numbers match',
    'fp.mismatch': 'They don''t match',
    'fp.verified': 'Connection verified',
    'fp.mismatchEnded': 'They don''t match — connection ended. Generate a new code and reconnect.',
    'reset.title': 'Reset identity',
    'reset.text': 'A new identity will be created. All connections close and sessions and chat history are deleted. This cannot be undone.',
    'reset.cancel': 'Cancel',
    'reset.confirm': 'Reset',
    'decoy.title': 'Weather — Today',
    'decoy.note': 'Istanbul · 18°C · Partly cloudy',
    'decoy.restart': 'Restart app',
    'contact.new': 'new',
    'contact.verified': 'verified',
    'err.noCode': 'No connection code entered',
    'err.isAddress': 'This is a "My identity" (address), not a connection code. Ask your friend for the code from their "Code" tab.',
    'err.connectFailed': 'Could not connect',
    'err.genFailed': 'Could not generate code',
    'err.sendFailed': 'Could not send',
    'err.recallSent': 'Recall sent',
    'err.recallFailed': 'Could not recall',
    'err.reconnectFailed': 'Could not reconnect',
    'err.fileRecvFailed': 'Could not accept file',
    'err.fileRejectFailed': 'Could not decline',
    'err.fileSendFailed': 'Could not send file',
    'err.fileRead': 'Could not read file: ',
    'err.openChatFirst': 'Open a chat first',
    'err.verificationFailed': 'Could not process verification',
    'err.connectionError': 'Connection error: ',
    'err.cameraDenied': 'Camera permission denied — you can still enter the code by hand.',
    'error.timeout': 'try again in 5 seconds',
    'error.noConnection': 'You must connect with this person first',
    'error.notVerified': 'You cannot send a message until the security number is verified',
    'error.emptyMessage': 'Cannot send an empty message',
    'error.messageTooLong': 'Message too long',
    'error.channelClosed': 'Data channel is not open',
    'error.recallUnauthorized': 'This message cannot be deleted (you can only delete your own sent messages)',
    'error.recallExpired': 'Recall window expired (5 minutes)',
    'error.codeExpired': 'The code has expired or is invalid',
    'error.identityChanged': 'Identity changed — verify the security number',
    'error.noPendingIdentity': 'No pending identity change',
    'error.peerLimit': 'Concurrent connection limit reached',
    'error.decryptFailed': 'Could not decrypt message: ',
    'error.codeEmpty': 'No connection code entered',
    'error.codeIsAddress': 'This is a "My identity" (address), not a connection code. Ask your friend for the code from their "Code" tab.',
    'error.codeInvalid': 'Invalid connection code',
    'error.codeIncomplete': 'Connection code is missing fields',
    'error.codecInvalid': 'Invalid connection code',
    'error.sendReadFailed': 'Could not send a read receipt',
  },
};

let lang = (() => {
  try {
    const l = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'tr').toLowerCase();
    return l.startsWith('tr') ? 'tr' : 'en';
  } catch (e) {
    return 'tr';
  }
})();

export function getLang() { return lang; }

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'tr';
}

export function t(key, vars) {
  let str = (dict[lang] && dict[lang][key] !== undefined)
    ? dict[lang][key]
    : (dict.tr[key] !== undefined ? dict.tr[key] : key);
  if (vars) {
    for (const k of Object.keys(vars)) {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
    }
  }
  return str;
}

export function applyI18n(root) {
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  r.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
  r.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
  r.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
}

export { dict };
```

- [ ] **Step 3: testleri çalıştır — geçmeli**

Run: `npm test`
Expected: 5 test yeşil; eksik anahtar/boş değer hatası yok.

- [ ] **Step 4: Checkpoint**

i18n katmanı + tam sözlük + testler. Testler HTML `data-i18n` varlığını doğrular — HTML nitelikleri henüz eklenmediği için test şu an yalnızca mevcut anahtar `x.timeout` gibi belirli anahtarları tarar (HTML'de hiç data-i18n yoksa Set boş, test geçer). Task 7 sonrası tarama gerçek yükü görür.

---

## Task 7: i18n — statik DOM süpürme (sidepanel.html) + dil seçici

Tüm statik metinlere `data-i18n` vb.; başlangıçta ve dil değişiminde `applyI18n`; tema ayarının yanına dil seçici.

**Files:**
- Modify: `src/sidepanel.html` (nitelikler + `langSelect` + `chatMessages[data-empty]`), `src/popup.js` (init `applyI18n`, `langSelect` listener, `renderReadToggle` → `t()`).

**Interfaces:**
- Consumes: `applyI18n`, `t`, `getLang`, `setLang` (Task 6).
- Produces: statik DOM anahtarları sözlükte; dil değişiminde tüm DOM yeniden süpürülür; `langSelect` eklendi.

- [ ] **Step 1: sidepanel.html metinleri nitelikli hale getir**

Her metin öğesine anahtar; listeyi birebir uygula (sözlükteki anahtarlarla eşleşmeli):

- `<html lang="tr">` — `lang` attribute'ü ayrıca yönetilir (dil değişiminde `document.documentElement.lang` güncellenir). `data-i18n` yalnızca içerik anahtarıdır.
- `loginView`: `h1.headline` → `data-i18n="app.headline"`; `p.lede` → `data-i18n="app.lede"`; addr-note `<p>` → `data-i18n="app.addrNote"`; `loginBtn` metin → `data-i18n="app.start"`; footnote `<p>` → `data-i18n="app.footnote"`.
- `details.net-settings summary` → `data-i18n="net.summary"`; `label[for=netHost]` → `data-i18n="net.hostLabel"`; `#netHost` → `data-i18n-placeholder="net.hostPh"`; `label[for=netPort]` → `data-i18n="net.portLabel"`; `label[for=netPath]` → `data-i18n="net.pathLabel"`; `label[for=netIce]` → `data-i18n="net.iceLabel"`; `#netIce` **placeholder'ı çevrilmez** (JSON fixture teknik örnektir, iki dilde aynı kalır); `.field-help` → `data-i18n="net.help"`.
- `connectionState .pill-text` → `data-i18n="status.offline"` (initial; JS setStatus ile ezilir). `panicBtn` text span → `data-i18n="panic.label"`; `panicBtn` title → `data-i18n-title="panic.title"`; `panicBtn` aria-label → `data-i18n-aria="panic.title"`.
- identity: `.field-label` (Kimliğim) → `data-i18n="ident.label"`; `resetIdentityBtn` → `data-i18n="ident.reset"`.
- tabs: `tabConnect` → `data-i18n="tab.connect"`; `tabCode` → `data-i18n="tab.code"`; `tabChat` → `data-i18n="tab.chat"`.
- panelConnect: `h2.panel-title` → `data-i18n="connect.title"`; `.panel-sub` → `data-i18n="connect.sub"`; `codeInput` → `data-i18n-placeholder="connect.ph"`; `connectBtn` → (JS sonra `t('connect.btn')` ile — nitelik yerine Task 8 handler dinamikliği); scanBtn metin span → `data-i18n="connect.scan"`; `#safetyInfoText` → `data-i18n="connect.safety"`; "Adres defteri" `.field-label` → `data-i18n="connect.book"`; theme label → `data-i18n="theme.label"`; theme options → `data-i18n="theme.bone|dark|hc|system"`.
- lang seçici (theme-settings içinde, theme label'den önce):

```html
          <label class="field-label" for="langSelect" data-i18n="lang.label">Dil</label>
          <select id="langSelect" class="message-input">
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
```

  `langSelect`'in `option`'ları kullanıcının seçeceği dil adlarıdır — çevrilmez.

- panelConnect ikon+metin butonları (scanBtn, genCodeBtn) SVG + metin içerir: `data-i18n` yalnızca **metin span'ına** konur (`applyI18n` `textContent` yazar, SVG'yi siler). Bu butonlardaki metni `<span data-i18n="...">` içine al: scanBtn → `<span data-i18n="connect.scan">Kodu tara</span>`, genCodeBtn → `<span data-i18n="code.gen">Yeni kod üret</span>`. panicBtn'in metin span'ı zaten mevcut (`<span>Panik</span>` → `data-i18n="panic.label"`).

- panelCode: `h2.panel-title` → `data-i18n="code.title"`; `.panel-sub` → `data-i18n="code.sub"`; "Kodun" `.field-label` → `data-i18n="code.your"`; `copyCodeBtn` → `data-i18n="code.copy"`; `genCodeBtn` text → `data-i18n="code.gen"`; footnote `p` → `data-i18n="code.footnote"`; `.qr-note` → `data-i18n="code.qrNote"`.
- panelChat: `chatPeer` initial → `data-i18n="chat.peer"`; `typingHint` → `data-i18n="chat.typing"`; `chatTimerSelect` title → `data-i18n-title="chat.timerTitle"`; its options → `data-i18n="chat.timerOff|timer30|timer300"`; `expirySelect` options → `data-i18n="chat.expiryOff|expiry30|expiry300"`; `fileBtn` title+aria → `data-i18n-title="chat.fileBtn"` / `data-i18n-aria="chat.fileBtn"`; `messageInput` → `data-i18n-placeholder="chat.ph"`; `sendBtn` title+aria → `data-i18n-title="chat.send"` / `data-i18n-aria="chat.send"`. `chatMessages` → `data-empty="chat.empty"` (CSS `content: attr(data-empty)`).
- `resetModal`: title → `data-i18n="reset.title"`; `.modal-text` → `data-i18n="reset.text"`; `resetCancelBtn` → `data-i18n="reset.cancel"`; `resetConfirmBtn` → `data-i18n="reset.confirm"`.
- `decoyView`: `.decoy-title` → `data-i18n="decoy.title"`; `.decoy-note` → `data-i18n="decoy.note"`; `decoyRestartBtn` → `data-i18n="decoy.restart"`.
- `scanModal`: `.scan-stamp` → `data-i18n="scan.stamp"`; `scanCancelBtn` → `data-i18n="scan.cancel"`.

`data-empty` mekanizması css'te (tamamlandı Task 8 adımında): `.messages:empty::before { content: attr(data-empty); ... }` — `chatMessages`'ta `data-empty` attribute'u applyI18n ile senkronlanmalı; Task 8 adımında popup'ta ayarlanır.

- [ ] **Step 2: popup.js — i18n init + dil seçici**

Dosya üstüne import ekle; init blokuna (869) `applyI18n(document)` ve langSelect listener:

```js
import { t, getLang, setLang, applyI18n } from './i18n.js';
```

```js
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
  renderReadToggle();
});
```

Not: import satırının en üste gelmesi gerekir (bundler hoisting). Mevcut popup.js'te import yok; en üste eklenecek.

- [ ] **Step 3: `renderReadToggle`'ı t() diline çevir**

Task 2'de eklenen `renderReadToggle`'daki sabit metinleri değiştir:

```js
  const renderReadToggle = () => {
    const off = !!window.__readAckOff[activePeer];
    readAckBtn.textContent = t(off ? 'chat.readOff' : 'chat.readOn');
    readAckBtn.classList.toggle('off', off);
    readAckBtn.setAttribute('aria-pressed', String(!off));
    readAckBtn.title = t(off ? 'chat.readTitleOff' : 'chat.readTitle');
  };
```

- [ ] **Step 4: test + build + detektör**

Run: `npm test` (HTML data-i18n varlık testi artık tüm statik anahtarları tarar — eksik anahtar varsa fail), `npm run build`, detektör.
Expected: 5 test yeşil; build exit 0; detektör exit 0.

- [ ] **Step 5: Manuel smoke**

Dil "English" → tüm statik metinler İngilizce; "Türkçe" → geri döner. Alan placeholder/title/aria da değişir. Sohbet açıkken dil değiştir → `data-empty` senkron, sohbet boş göstergesi güncellenir.

- [ ] **Step 6: Checkpoint**

Statik DOM süpürme + dil seçici çalışıyor; sözlük testi HTML anahtarlarını doğruluyor.

---

## Task 8: i18n — dinamik JS metinleri (popup.js)

Sabit `textContent`/`placeholder`/`title` metinleri `t()` ile; `innerHTML` yalnızca SVG ikonlar için (çevrilmez).

**Files:**
- Modify: `src/popup.js` (addMessage who/time, markDeleted, markRecallAcked, fileSizeLabel birimler hariç, addFileCard/updateFileCard metinleri, flashCopied, setStatus çağrıları, loginBtn/connectBtn/sendBtn metinleri, countdown, fingerprint card, openMessageMenu, showTempError çağrıları, file handler'ları), `src/popup.css` (`.messages:empty::before` → `attr(data-empty)`).

**Interfaces:**
- Consumes: `t`, `applyI18n` (Task 6); statik süpürme (Task 7).
- Produces: tüm dinamik kullanıcı metinleri anahtarlı.

- [ ] **Step 1: CSS boş-sohbet metnini data-empty'ye bağla**

`popup.css` `.messages:empty::before` blokunu değiştir:

```css
.messages:empty::before {
  content: attr(data-empty);
  ...
}
```

(content satırını değiştir; diğer stiller aynı kalır.)

- [ ] **Step 2: kilit dinamik metinleri `t()` ile değiştir**

Örnek dönüşümler (birebir uygula):

```js
// addMessage who etiketi (giden balonda) — çevrilmez (gönderen adı). time kullanımı: 
// time.textContent = new Date(ts).toLocaleTimeString(t('app.timeLocale'), {...});
// kapsam dışı — mevcut 'tr-TR' kalır (saat:dakika gösterimi diller arası değişmez).
```

Gerçek değişiklikler (her biri sözlük anahtarıyla):

- `markDeleted`: `el.textContent = 'Bu mesaj geri çekildi'` → `el.textContent = t('chat.recalled');`
- `markRecallAcked`: note text → `t('chat.deletedRemote')`
- `openMessageMenu`: local/remote → `t('menu.local')`, `t('menu.remote')`; `remote.title` → `t('menu.expired')`
- `addFileCard`: accept/reject buttons → `t('file.accept')`, `t('file.decline')`
- `updateFileCard`: `link.textContent = t('file.view')`; note'lardaki `fileSizeLabel` birimleri (B/KB/MB) **çevrilmez** (evrensel); `fileSent`→`t('file.sent')`, `fileComplete`→`t('file.complete')`, `fileDeclined`→`t('file.declined')`
- `flashCopied`: `btn.textContent = t('code.copied')`
- `loginBtn` handler: `'Adres oluşturuluyor…'`→`t('app.busy')`; son geri dönüş `'Sohbete başla'`→`t('app.start')`
- `attemptConnect`: `'Kuruluyor…'`→`t('connect.busy')`; son `'Bağlantı kur'`→`t('connect.btn')`; hata mesajları → `t('err.noCode')`, `t('err.isAddress')`, `(res.error) || t('err.connectFailed')`
- `renderCodeCountdown`: `'Kodun süresi doldu — yeni kod üret.'`→`t('code.expired')`; `'Kodun geçerliliği: '`+mm+':'+ss → `t('code.validFor') + mm + ':' + ss`
- genesis handler: `'Kod üretilemedi'` → `t('err.genFailed')`; `'Kopyala'` geri dönüşü → `t('code.copy')`
- `sendMessage`: `'Gönderilemedi'` → `t('err.sendFailed')`
- `refreshContacts`: `c.username + ' · ' + (verified ? t('contact.verified') : t('contact.new'))`; hata → `t('err.reconnectFailed')`
- file okuma hataları: `'Önce bir sohbet aç'` → `t('err.openChatFirst')`; `'Dosya okunamadı: ' + e.message` → `t('err.fileRead') + e.message`; `'Dosya gönderilemedi'` → `t('err.fileSendFailed')`
- file transfer handler: `'Dosya alınamadı'` → `t('err.fileRecvFailed')`; `'Reddetme gönderilemedi'` → `t('err.fileRejectFailed')`
- recall handler: `'Geri çekme gönderildi'` → `t('err.recallSent')`; `'Silme gönderilemedi'` → `t('err.recallFailed')`
- fingerprint card: `window.__unread` akışı çevrilmez; `fp` title/sub/buttons → `t('fp.title')`, `t('fp.sub')`, `t('fp.match')`, `t('fp.mismatch')`; confirmed span → `t('fp.verified')`; hata `'Doğrulama işlenemedi'` → `t('err.verificationFailed')`; reject sonrası `'Eşleşmiyor — bağlantı sonlandırıldı...'` → `t('fp.mismatchEnded')`
- setStatus çağrıları: `'doğrulanmış'` → `t('status.verified')`, `'yayında'` → `t('status.online')`, `'bağlı · '` → `t('status.chatPrefix')`, `'kuruluyor…'` → `t('status.connecting')`, `'çevrimdışı'` init → `t('status.offline')`, `'hata'` → `t('status.error')`; `setTrustVerified` içinde de aynı.
- `chatPeer` metni `'Sohbet'` → `t('chat.peer')` (initial + null activePeer dönüşlerinde)
- `showTempError` ile gösterilen offscreen kaynaklı hatalar: `res.error` değeri `error.*` anahtarıysa `t(res.error)` ile çevir (Task 9'da tam); `'Bağlantı hatası: ' + detail` → `t('err.connectionError') + detail`
- `showTempError('Kamera izni verilmedi...')` → `t('err.cameraDenied')`
- `connected` case'deki `'Güvenli bağlantı kuruldu.'` → `t('chat.secure')`

- [ ] **Step 3: build + test + detektör + smoke**

Run: `npm test`, `npm run build`, detektör.
Expected: yeşil. Smoke: A-B bağlan, mesaj/silme/dosya/fingerprint akışlarında tüm metinler dil ile birlikte değişir.

- [ ] **Step 4: Checkpoint**

Dinamik JS metinleri sözlüğe bağlandı; SVG innerHTML korundu; CSS empty-state çevrilebilir.

---

## Task 9: i18n — offscreen/codec hata anahtarları + popup çevirisi

Offscreen hataları kullanıcıya gitmez; `error.*` anahtarı döner; arayüz `t()` ile çevirir. `codec.js` hata mesajları da anahtar olur.

**Files:**
- Modify: `src/offscreen.js` (sendMessageTo/recallMessage/codeExpired/identityChanged/verifyFingerprint/acceptNewIdentity/reboot/notify hataları), `src/codec.js` (hata mesajları → `error.*`), `src/popup.js` (res.error çevirisi), `tests/codec.test.mjs` (mesaj match'lerini anahtar with /error/ veya kaldır).
- Test: `npm test` + build + detektör.

**Interfaces:**
- Consumes: `t` (Task 6).
- Produces: fenak anahtarları `error.noConnection|notVerified|emptyMessage|messageTooLong|channelClosed|recallUnauthorized|recallExpired|codeExpired|identityChanged|noPendingIdentity|peerLimit|decryptFailed|codeEmpty|codeIsAddress|codeInvalid|codeIncomplete`.

- [ ] **Step 1: codec.js hata mesajlarını anahtar yap**

`src/codec.js` içindeki TR hata string'lerini sözlükteki karşılıklarıyla değiştir:

- `'Bağlantı kodu girilmedi'` → `error.codeEmpty`
- address 20-hane metni → `error.codeIsAddress`
- `'Geçersiz bağlantı kodu'` (iki yer) → `error.codeInvalid`
- `'Bağlantı kodu eksik alan içeriyor'` (iki yer) → `error.codeIncomplete`

- [ ] **Step 2: offscreen.js hatalarını anahtar yap**

Birebir değişiklikler (mevcut TR string'leri → `error.*`):

- `sendMessageTo`: `'Önce bu kişiyle bağlantı kurmalısın'`→`error.noConnection`; `'Güvenlik numarası doğrulanana kadar mesaj gönderilemez'`→`error.notVerified`; `'Boş mesaj gönderilemez'`→`error.emptyMessage`; `'Mesaj çok uzun'`→`error.messageTooLong`; `'Veri kanalı açık değil'`→`error.channelClosed`
- `recallMessage`: aynı noConnection/notVerified; `'Bu mesaj silmeye uygun değil...'`→`error.recallUnauthorized`; `'Silme süresi doldu (5 dakika)'`→`error.recallExpired`; `'Veri kanalı açık değil'`→`error.channelClosed`
- `connectWithCode`: `'Kodun süresi doldu veya geçersiz'`→`error.codeExpired`; `'Kimlik değişti — güvenlik numarasını doğrula'`→`error.identityChanged`
- `verifyFingerprint`: `'Bağlantı bulunamadı'`→`error.noConnection`
- `acceptNewIdentity`: `'Bekleyen kimlik değişimi yok'`→`error.noPendingIdentity`
- `handleIncoming` peer limit notify: `notify('error', { message: 'Eşzamanlı bağlantı sınırı aşıldı' })` → `notify('error', { message: 'error.peerLimit' })`
- `handleIncoming` catch: `'Mesaj çözülemedi: '` → `'error.decryptFailed'` (popup `t('error.decryptFailed')+detail` şeklinde; ama burada detail yok — anahtar tek başına)
- `reconnectContact`: `'defterde yok'` → `error.noConnection` (popup zaten kendi fallback'ini gösterir; anahtar tutarlılığı için)

`sendRead` (Task 1) içindeki `'error.noConnection'`/`'error.sendReadFailed'` zaten anahtar.

- [ ] **Step 3: popup.js res.error çevirisi**

`showTempError` çağrılarına genel kural uygula — hata değeri `error.*` prefix'liyse `t()` ile: Tek yardımcı:

```js
function errorText(e) {
  if (typeof e === 'string' && e.indexOf('error.') === 0) return t(e);
  return e || t('err.sendFailed');
}
```

`showTempError` içinde hiçbir çağrı değişmez ama içerik `errorText(res.error)` ile sarılır: `showTempError(errrorText(res.error))` — dikkat: `showTempError` çağrılarının hepsi tek merkezi noktadan geçer: `showTempError` fonksiyonu içinde değil, **çağıran yerlerde** `errorText` uygulanır. En pratik: `showTempError` fonksiyonunun gövdesinde `fn` yok — çağrıları güncelle.

Kritik çağrılar: loginBtn (`res.error||t('app.start')` yanlış — `err` fallbackleri düzelt), connectBtn, sendBtn, recall, file. `note`: `'error'` event case: `showTempError(msg.payload.message === 'error.peerLimit' ? t(msg.payload.message) : msg.payload.message)` — genel: `showTempError(errorText(msg.payload.message))`.

- [ ] **Step 4: codec testini anahtarlara göre güncelle**

`tests/codec.test.mjs`'deki regex match'leri artık TR değil — anahtar ile eşleşsin:

- `/Kimliğim/` → `/error\.codeIsAddress/`
- `/eksik alan/` → `/error\.codeIncomplete/`
- `/girilmedi/` → `/error\.codeEmpty/`

- [ ] **Step 5: test + build + detektör + smoke**

Run: `npm test`, `npm run build`, detektör.
Expected: yeşil. Smoke: kodu bozuk/süresi dolmuş gir, bağlanamayan eş, silme süresi dolmuş mesaj — tüm hata mesajları seçilen dilde.

- [ ] **Step 6: Checkpoint**

Offscreen/codec hataları `error.*` anahtarı; popup çeviriyor; testler güncel.

---

## Task 10: i18n — yeniden süpürme + EN yerleşim uyumu + detektör turu

Dil değişince `applyI18n` tüm DOM'u (statik + dinamik oluşturulmuş `data-i18n` öğeleri) yeniler; EN uzun metinler 352px sütunda taşmamalı; detektör turu.

**Files:**
- Modify: `src/popup.js` (dil değişiminde `applyI18n(document)` + `renderReadToggle` + `chatMessages.dataset.empty`; dinamik oluşturulan metinli öğelere `setAttribute('data-i18n', ...)`), `src/popup.css` (gerekirse EN uzun metin için taşma düzeltmesi — buton genişliği, word-break).

**Interfaces:**
- Consumes: `applyI18n` (Task 6).

- [ ] **Step 1: dil değişiminde tam yeniden süpürme**

`langSelect` listener (Task 7) zaten `applyI18n(document)` çağırıyor. Ek olarak dinamik öğelerin anahtar taşıdığından emin ol: Task 8'de oluşturulan metin öğelerine (markDeleted/recall/file notes/fp sub) `el.setAttribute('data-i18n', '<key>')` ekle; `applyI18n` onları da günceller. Dil değişince yeniden çizilen mevcut balonlardaki okundu/delivered rozetleri SVG'dir — çevrilmez, değişmez.

- [ ] **Step 2: EN yerleşim denetimi**

Side panel genişliği 352px sabit. EN metinler için panel-sub/lede/connect.sub (uzun paragraflar) `word-wrap: break-word` garanti; butonlar md dolgu + kısa etiketler (Connect/Scan code/Copy/Reset). `read-ack-toggle` EN'de "Read on/off" — 10.5px'e sığar. QR note EN kısa. Doğrula: en uzun buton metni "Generate new code" genCodeBtn'de serbest satır kırılmasıyla sığmalı; `.qr-note` genişlik 128px canvas altında taşmamalı (text-align center, word-wrap).

- [ ] **Step 3: detektör turu**

Run: detektör (4 dosya). Ek warning olmamalı; çıkan advisory'ler belgelenmiş micro-değer kategorisinde kalmalı. Gerekirse CSS'te yalnızca mevcut token/ramp kullanarak düzelt.

- [ ] **Step 4: Test + build + smoke**

`npm test`, `npm run build`. Smoke: TR↔EN geçişlerinde hiçbir yerleşim taşmaz; sohbet balonları, durum kaşeleri, butonlar EN'de tam görünür.

- [ ] **Step 5: Checkpoint**

i18n tam: dynamik yeniden süpürme + EN yerleşim uyumu + detektör temiz.

---

## Task 11: Görsel işleme — dünyaya işleme + DESIGN.md + harici kontrol

Her yeni mekanik (okundu çift tiki, QR zarfı, kamera çerçevesi) DESIGN.md'ye yeni ritüel olarak değil, mevcut dünyanın türevi olarak belgelenir. Tasarım sözlüğüne giren her yeni mikro-bileşen için DESIGN.md güncellenir.

**Files:**
- Modify: `DESIGN.md` (Components bölümüne okundu tiki, QR zarfı, kamera çerçevesi; hiçbir yeni token/renk eklemez), `src/popup.css` (son görsel düzeltmeler, yalnızca mevcut token'lar).
- Test: build + detektör + tam smoke (her dört özellik).

**Interfaces:**
- Consumes: 1–10 arası tüm çıktılar.

- [ ] **Step 1: Okundu kaşesini dünyaya işle**

`read` çift tiki `--trust-deep` ailesindedir (parmak izi kartı doğrulama dili). UI'da doğrulama anındaki yeşil mum mühür + okundu tiki aynı aile içinde kalır; `--msg-status` taşıyan ilk tik korunur. Kontrast: `--trust-deep` açık temada `#16502F` (trust-bg üzerinde 8.06:1) — balon zeminleri farklı ama tik 9px'te işaret olarak yeterli görünür. Gerekirse tik `--trust` (açık #246C43) ile netleştirilebilir — DESIGN.md bunu not eder; sabit `--trust-deep` spec gereğidir, değiştirilmez.

- [ ] **Step 2: QR zarfı + kamera çerçevesi için DESIGN.md güncelle**

`DESIGN.md` Components bölümüne ekle:

```md
### Okundu Kaşesi (read-receipt tick)
Teslimat rozeti çizim hali: `delivered` = mevcut çift tik; `read` = aynı geometri, ikinci tik mum yeşili derinde (--trust-deep). Yeşil yalnızca doğrulanmış an + okundu anında görünür (Mum Mühür Kuralı'nın türevi). Liç (per-sehis) kapatma: "OKUNDU" kaşe geçişi (dashed → solid, üstü çizili).

### QR Zarfı
Kod fişinin altında manila zarf: delikli üst kenar, `--ground` zeminde `--ink` QR, 6px köşe, shadow-sm. Not metni kaşe tipografisinde (10.5px, harf aralıklı). QR içerik = bağlantı kodunun ta kendisi; yeni ritüel değil.

### Kamera Çerçevesi
Modal kaplama (--shadow-md, kemik zemin). Android frame: 1:1 `--ink` zemin + `--ground` köşe braketleri. Üstte kaşe notu ("Kodu çerçeveye getir"). Kamera yalnızca taramada açık; iptalde kapanır.
```

- [ ] **Step 3: DESIGN.md "Components" bölümüne dört özelliği teyit et**

Yukarıdaki üç blok yeterli; "Okundu Kaşesi" zaten mesaj-fiş bölümüyle uyumlu. Ekstra token ekleme YOK.

- [ ] **Step 4: build + detektör + tam smoke**

Run: `npm run build` + detektör. Tam uçtan uca smoke: kod üret (QR çıkar, süre sayar, qr-note görünür) → A kamera ile tarar / elle yapıştırır → bağlan → fingerprint doğrulaması → mesaj → B'de görününce A'da okundu çift tik → per-sohbet kapat → silme (gönül akışı) → dosya transferi → panik (kamera/sıra kayar). Tümu TR + EN.

- [ ] **Step 5: Checkpoint**

Dört özellik de dünyada; DESIGN.md güncel; build/detektör/tüm smoke yeşil. Bu planın final görevi.

---

## Self-Review

**1. Spec kapsamı:**
- Bölüm 1 (k:12): Task 1 (protokol) + Task 2 (UI + per-sohbet kapatma) ✓
- Bölüm 2 (QR): Task 3 (bağımlılık+izin) + Task 4 (üretim) + Task 5 (okuma) ✓
- Bölüm 3 (i18n): Task 6 (katman+sözlük+test) + Task 7 (statik) + Task 8 (dinamik) + Task 9 (error keys) + Task 10 (yeniden süpürme) ✓
- Bölüm 4 (görsel): Task 11 ✓
- Test yaklaşımı: codec video + i18n sözlük/HTML varlık testleri; Chrome/DOM glue build+detektör+smoke (repo gerçeği) ✓
- Uygulama sırası: Okundu → QR → i18n → görsel ✓
- Kapsam dışı maddeleri: hiçbir görev eklememiş ✓

**2. Placeholder taraması:** Tüm kod adımları gerçek içerik taşır; "add error handling", "similar to" ifadeleri yok; her anahtar sözlükte tanımlı.

**3. Tip tutarlılığı:** `sendRead(username, mid)` Task 1 dispatcher + Task 2 `sendToOffscreen('sendRead', { username, mid })` uyumlu. `queueRead/flushReads/sendReadIfVisible` tutarlı. `errorText` Task 9'da tanımlı ve Task 8'in bazı çağrılarını Task 9'ın `errorText` ile sarması tutarlı (Task 8 ham mesaj gösterir, Task 9 sarmalar). `t/getLang/setLang/applyI18n` imzaları Task 6'da sabit; tüm kullanımlar uyumlu. `attemptConnect` Task 5'te tanımlı; connectBtn + scan bunu çağırır. `renderReadToggle` Task 2'de tanımlı, Task 7 diline çevrilir, Task 10'da yeniden çağrılır.