# ILQ Medya Desteği (Sesli Mesaj + Sesli/Görüntülü Arama) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ILQ sohbetine üç medya yeteneği ekler: Signal-şifreli, parçalı **sesli mesaj** (k:13), **canlı sesli arama** ve **canlı görüntülü arama** (k:14 sinyal rölesi + side panelde RTCPeerConnection).

**Architecture:** Katman ayrımı korunur — `offscreen.js` P2P + Signal + k:13/k:14 envelope protokolü (RAM-only), `popup.js`/`sidepanel.html` tek UI yüzeyi. `peer.call()` **iptal edildi** (spec Bölüm 3.3): medya + RTCPeerConnection side panelde yaşar, SDP/ICE sinyali mevcut ratchet'li DataChannel üzerinden k:14 envelope olarak akar, offscreen yalnızca röle + doğrulanmış eş zorlaması yapar. Test edilebilirlik için saf mantık iki yeni modüle çekilir: `src/voice.js` (parça bölme/birleştirme + browser yardımcıları) ve `src/call-state.js` (çağrı durum makinesi). Offscreen bu modülleri import eder; node:test bunları doğrudan test eder. Chrome/DOM'a bağlı glue build + detektör + iki-Chrome manuel smoke ile doğrulanır (repo'nun gerçek doğrulama kültürü).

**Tech Stack:** Vanilla JS (esbuild IIFE bundle, `chrome110`, platform browser), peerjs (DataChannel), navigator.mediaDevices + MediaRecorder (sesli mesaj), RTCPeerConnection + DTLS-SRTP (çoklu ortam), @privacyresearch/libsignal-protocol-typescript (k:13/k:14 şifreleme), node:test (saf mantık — `npm test`).

## Global Constraints

(spec'ten birebir ve doğrulanmış kod gerçekleri; her görevin gereksinimleri bu bölümü içerir)

- **RAM-only:** ses blob'ları, `URL.createObjectURL` kayıtları, çağrı durumu ve `state.call` RAM'de yaşar. `chrome.storage`/`localStorage`/`IndexedDB` kullanılmaz. Panik/sıfırlama tüm track'leri `stop()`, URL'leri `revokeObjectURL` eder, çağrıyı kapatır, k:13 tamponlarını temizler.
- **Doğrulanmış eş şartı (offscreen'de zorlanır, UI değil):** `entry.verified === false` ise `startCall` rölesi başlatılmaz (`error.notVerified`). Gelen k:14 `c:'request'` `entry.verified === false` ise otomatik k:14 `reject` + `notify('callBlocked')`; medya asla kurulmaz, panele `callSignal` dahi gitmez. Sesli mesaj gönderimi `sendMessageTo` gibi `entry.verified` şartına tabidir.
- **k:11/k:12 ve dosya kanalları dokunulmaz:** k:13 (ses) ve k:14 (çağrı) **yeni, ayrı** envelope türleridir. Zarf kabul listesi (`offscreen.js:661`) `[1,3,4,5,6,7,8,9,10,11,12]` → `[1,3,4,5,6,7,8,9,10,11,12,13,14]` genişletilir.
- **Sesli mesaj parça gövdesi:** `{m: mid, idx, total, bytes: base64url}` — opsiyonel `mime`, `ts`, `e` (expSeconds) yalnızca `idx === 0` parçasında taşınır. `VOICE_CHUNK_SIZE = 64 * 1024`, `VOICE_MAX_SECONDS = 60`, alıcı peer başına tampon bütçesi `VOICE_MAX_BYTES = 8 * 1024 * 1024`.
- **Parça pompası:** dosya akışıyla aynı desen — `setTimeout(pump, 65)` (offscreen k:13'te), token-bucket rate-limit'e takılmamak için (65ms ≈ 15/sn, 20/sn kova). `checkRate`/`handleIncoming`'e dokunulmaz.
- **Alıcı bütçesi:** `filesBytesFor` benzeri peer başına ses tampon limiti. Aşım, duplicate ve boş/geçersiz parça **sessizce atılır** (notify yok). Eksik parça toleransı: `received >= total` şartı; tamamlanmayan kayıtlar peer kapanınca/panic/reset'te temizlenir.
- **Süre/yok etme:** sesli mesaj `expirySelect` + `chatTimer` kurallarına tabidir. Senkron mevcut `trackExpiryTimer`/`scheduleMessageExpiry`/`scheduleChatExpiryForMessage` işlevleriyle; gönderen tarafı `setRecallWindow` benzeri mid takibi + kendi balonu için `notify('expired', {mid, from})`. Popup'ta `window.__voiceUrls[mid]` blob URL'si `expired`/panik/reset başına `revokeObjectURL`.
- **Tek aktif arama:** `state.call = null | { callId, username, mode, phase: 'outgoing'|'incoming'|'active'|'closed' }`. `startCall` yalnızca `state.call` boşken; gelen request yalnızca boşken kabul. Eşleşmeyen callId sinyali sessizce atılır (spec risk 4).
- **Mute/video toggle:** panelde `localStream.getTracks()` `.enabled` — sinyal/meta gönderilmez.
- **Kamera/mikro izin reddi:** `getUserMedia` hatası → net hata (i18n); otomatik sese düşme yok.
- **i18n:** tüm yeni metinler `src/i18n.js` tr/en. `error.*` anahtarları offscreen'den döner, arayüz `t()` ile çevirir. Mevcut `tests/i18n.test.mjs` HTML `data-i18n` varlığını doğrular → HTML'de kullanılan her anahtar sözlükte olmalı (görev sırası buna göre: sözlük önce, HTML sonra).
- **Kapsam dışı (YAGNI):** cihaz/kamera seçici, flip, ekran paylaşımı, ses filtreleri, aramada codec/kalite ayarı, arama kaydı, üçüncü taraf bildirim/zil, video hatasında otomatik sese düşme. Kapsamda **değişmez:** `offscreen.html`, `build.cjs`, `background.js`, `codec.js`.
- **Build/verification:** her görev `npm test` (saf mantık) ve `npm run build` ile doğrulanır; UI görevleri detektör + manuel smoke. `npm test` glob'u `tests/**/*.test.mjs`'i zaten tarar — yeni test dosyaları otomatik yakalanır.
- **Manifest:** `permissions` dizisine `"audioCapture"` eklenir (`videoCapture` zaten var). `audio/webm;codecs=opus` MediaRecorder isTypeSupported değilse mime boş bırakılır.
- **CSS/mimari koruması:** yeni token yok — mevcut `--surface*`, `--ink*`, `--hairline*`, `--trust*` (yalnızca doğrulanmış için), `--danger*` (tek RET). Yeni bileşenler kaşe/delikli-kenar/modal dilini yeniden kullanır.

---

## Task 0: `src/voice.js` — saf parça protokolü + browser yardımcıları + testleri

**Files:**
- Create: `src/voice.js`
- Test: `tests/voice.test.mjs`

**Interfaces:**
- Consumes: hiçbir şey (sat-temiz, `btoa`/`atob`/`crypto` globalleri).
- Produces: `VOICE_CHUNK_SIZE`, `VOICE_MAX_SECONDS`, `VOICE_MAX_BYTES`, `VOICE_MAX_PARTS`, `bytesToB64Url(bytes)`, `b64UrlToBytes(b64)`, `splitVoiceParts(mid, bytes, extra?) → string[]`, `parseVoicePart(text) → part|null`, `VoiceAssembly` sınıfı (`add`, `bytesFor`, `clear`, `clearAll`), `startVoiceRecorder(opts)`, `createCallPeerConnection(opts)`, `attachLocalTracks(pc, stream)`. Task 2 (offscreen), Task 4 (offscreen), Task 6/7 (popup) bunları kullanır.

- [ ] **Step 1: `src/voice.js` oluştur**

```js
/* ILQ voice — sesli mesaj parça protokolü (saf, node:test tarafından da import edilir)
 * + side panel için browser yardımcıları (MediaRecorder, RTCPeerConnection).
 * Önceki katmanlarla uyum: base64url taşıma, chunk JSON gövdesi, 65ms pompa deseni.
 * RAM-only: hiçbir şey diske yazılmaz. */

export const VOICE_CHUNK_SIZE = 64 * 1024;
export const VOICE_MAX_SECONDS = 60;
export const VOICE_MAX_BYTES = 8 * 1024 * 1024; // peer başına alıcı bütçesi
export const VOICE_MAX_PARTS = Math.ceil(VOICE_MAX_BYTES / VOICE_CHUNK_SIZE);

// ---------- base64url (sat-temiz; codec.js'teki desenin kopyası değil, küçük taşıma) ----------
export function bytesToB64Url(bytes) {
  const u8 = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64UrlToBytes(b64) {
  const std = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = std.length % 4 === 0 ? '' : '='.repeat(4 - (std.length % 4));
  const bin = atob(std + padding);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

// ---------- gönderen tarafı: parçalama ----------
// extra: { mime?, ts?, e? } — yalnızca idx === 0 parçasına yazılır.
export function splitVoiceParts(mid, bytes, extra = {}) {
  const view = new Uint8Array(bytes);
  const total = Math.max(1, Math.ceil(view.length / VOICE_CHUNK_SIZE));
  const parts = [];
  for (let i = 0; i < total; i++) {
    const slice = view.subarray(i * VOICE_CHUNK_SIZE, Math.min((i + 1) * VOICE_CHUNK_SIZE, view.length));
    const o = { m: mid, idx: i, total, bytes: bytesToB64Url(slice) };
    if (i === 0) {
      if (extra.mime) o.mime = extra.mime;
      if (extra.ts) o.ts = extra.ts;
      if (extra.e) o.e = extra.e;
    }
    parts.push(JSON.stringify(o));
  }
  return parts;
}

// ---------- alıcı tarafı: doğrulama + ayrıştırma ----------
// Geçersiz/boş parça → null (çağıran sessizce atar). total sınırı VOICE_MAX_PARTS.
export function parseVoicePart(text) {
  let o;
  try { o = JSON.parse(String(text || '')); } catch (_) { return null; }
  if (!o || typeof o.m !== 'string' || !o.m) return null;
  if (!Number.isInteger(o.idx) || o.idx < 0) return null;
  if (!Number.isInteger(o.total) || o.total < 1 || o.total > VOICE_MAX_PARTS) return null;
  if (o.idx >= o.total) return null;
  if (typeof o.bytes !== 'string' || !o.bytes) return null;
  let bytes;
  try { bytes = b64UrlToBytes(o.bytes); } catch (_) { return null; }
  if (!bytes.byteLength) return null; // boş parça
  const part = { m: o.m, idx: o.idx, total: o.total, bytes };
  if (o.idx === 0) {
    if (typeof o.mime === 'string' && o.mime) part.mime = o.mime;
    if (typeof o.ts === 'number') part.ts = o.ts;
    if (typeof o.e === 'number') part.e = o.e;
  }
  return part;
}

// ---------- alıcı birleştirme (peer başına bütçe) ----------
// add(): duplicate / bütçe aşımı / total uyumsuzluğu → sessizce null döner.
// Tamamlanınca { complete:true, mid, bytes:ArrayBuffer, mime, ts, e } döner, kaydı siler.
export class VoiceAssembly {
  constructor() {
    this.buckets = new Map(); // username -> Map<mid, { received, total, chunks, mime, ts, e }>
  }

  bytesFor(username) {
    const recs = this.buckets.get(username);
    if (!recs) return 0;
    let total = 0;
    for (const st of recs.values()) {
      if (st) for (const ch of st.chunks) if (ch) total += ch.length;
    }
    return total;
  }

  add(username, part) {
    let recs = this.buckets.get(username);
    if (!recs) { recs = new Map(); this.buckets.set(username, recs); }
    let st = recs.get(part.m);
    if (!st) {
      st = { received: 0, total: part.total, chunks: [], mime: undefined, ts: undefined, e: undefined };
      recs.set(part.m, st);
    } else if (st.total !== part.total) {
      return null; // uyumsuz total → sessiz at
    }
    if (st.chunks[part.idx]) return null; // duplicate → sessiz at
    if (this.bytesFor(username) + part.bytes.byteLength > VOICE_MAX_BYTES) return null; // bütçe aşımı
    st.chunks[part.idx] = part.bytes;
    st.received++;
    if (part.idx === 0) {
      st.mime = part.mime;
      st.ts = part.ts;
      st.e = part.e;
    }
    if (st.received >= st.total) {
      const partsArr = st.chunks.filter(Boolean); // boşluğa (sıra dışı) karşı
      const totalBytes = partsArr.reduce((a, c) => a + c.length, 0);
      const full = new Uint8Array(totalBytes);
      let off = 0;
      for (const c of partsArr) { full.set(c, off); off += c.length; }
      recs.delete(part.m);
      return { complete: true, mid: part.m, bytes: full.buffer, mime: st.mime, ts: st.ts, e: st.e };
    }
    return null;
  }

  clear(username) { this.buckets.delete(username); }
  clearAll() { this.buckets.clear(); }
}

// ---------- side panel browser yardımcıları (node'da çağrılmaz, yalnızca tanımlıdır) ----------
export async function startVoiceRecorder({ onTick, onComplete, onError, maxSeconds = VOICE_MAX_SECONDS }) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    throw new Error('err.micDenied');
  }
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  let elapsed = 0;
  let timer = null;
  const finish = () => {
    clearInterval(timer);
    if (rec.state === 'recording') rec.stop();
    stream.getTracks().forEach((t) => t.stop());
  };
  rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
  rec.onerror = () => { finish(); if (onError) onError(new Error('err.voiceFailed')); };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    if (onComplete) onComplete(blob);
  };
  rec.start();
  timer = setInterval(() => {
    elapsed++;
    if (elapsed >= maxSeconds) { finish(); return; } // stop() → onComplete ateşler
    if (onTick) onTick(elapsed);
  }, 1000);
  return {
    stop: finish,
    elapsed: () => elapsed,
  };
}

export function createCallPeerConnection({ iceServers, onIce, onTrack, onStateChange, onFail }) {
  let pc;
  try {
    pc = new RTCPeerConnection({ iceServers: (iceServers && iceServers.length) ? iceServers : [] });
  } catch (e) {
    if (onFail) onFail(new Error('call.unsupported'));
    return null;
  }
  pc.onicecandidate = (ev) => { if (ev.candidate && onIce) onIce(ev.candidate); };
  pc.ontrack = (ev) => { if (ev.streams && ev.streams[0] && onTrack) onTrack(ev.streams[0]); };
  pc.onconnectionstatechange = () => { if (onStateChange) onStateChange(pc.connectionState); };
  return pc;
}

export function attachLocalTracks(pc, stream) {
  for (const track of stream.getTracks()) pc.addTrack(track, stream);
}
```

- [ ] **Step 2: `tests/voice.test.mjs` — saf parça protokolü testlerini yaz**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_CHUNK_SIZE, VOICE_MAX_BYTES, VOICE_MAX_SECONDS, VOICE_MAX_PARTS,
  bytesToB64Url, b64UrlToBytes, splitVoiceParts, parseVoicePart, VoiceAssembly,
} from '../src/voice.js';

test('sabitler: 64KB parça, 60sn kayıt, 8MB bütçe, 128 parça', () => {
  assert.equal(VOICE_CHUNK_SIZE, 65536);
  assert.equal(VOICE_MAX_SECONDS, 60);
  assert.equal(VOICE_MAX_BYTES, 8 * 1024 * 1024);
  assert.equal(VOICE_MAX_PARTS, 128);
});

test('b64url round-trip byte korunur', () => {
  const buf = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]).buffer;
  const back = b64UrlToBytes(bytesToB64Url(buf));
  assert.deepEqual(Array.from(back), Array.from(new Uint8Array(buf)));
});

test('splitVoiceParts: parça sayısı ve ilk parçada mime/ts/e', () => {
  const bytes = new Uint8Array(VOICE_CHUNK_SIZE * 3 + 10).fill(7).buffer;
  const parts = splitVoiceParts('mid1', bytes, { mime: 'audio/webm', ts: 1000, e: 30 });
  assert.equal(parts.length, 4);
  const p0 = JSON.parse(parts[0]);
  assert.equal(p0.m, 'mid1'); assert.equal(p0.idx, 0); assert.equal(p0.total, 4);
  assert.equal(p0.mime, 'audio/webm'); assert.equal(p0.ts, 1000); assert.equal(p0.e, 30);
  const p3 = JSON.parse(parts[3]);
  assert.equal(p3.idx, 3);
  assert.ok(!('mime' in p3)); assert.ok(!('ts' in p3)); assert.ok(!('e' in p3));
});

test('parseVoicePart round-trip doğru alanları döndürür', () => {
  const bytes = new Uint8Array([5, 6, 7]).buffer;
  const json = JSON.stringify({ m: 'x', idx: 0, total: 1, bytes: bytesToB64Url(bytes), mime: 'audio/webm', ts: 9, e: 0 });
  const part = parseVoicePart(json);
  assert.deepEqual(Array.from(part.bytes), [5, 6, 7]);
  assert.equal(part.m, 'x'); assert.equal(part.mime, 'audio/webm'); assert.equal(part.ts, 9); assert.equal(part.e, 0);
});

test('parseVoicePart: geçersiz/boş parçalar null döner', () => {
  assert.equal(parseVoicePart(''), null);
  assert.equal(parseVoicePart('{'), null);
  assert.equal(parseVoicePart('null'), null);
  assert.equal(parseVoicePart('{"m":""}'), null);
  assert.equal(parseVoicePart('{"m":"a"}'), null); // idx/total eksik
  assert.equal(parseVoicePart('{"m":"a","idx":-1,"total":1,"bytes":"AA=="}'), null);
  assert.equal(parseVoicePart('{"m":"a","idx":0,"total":0,"bytes":"AA=="}'), null);
  assert.equal(parseVoicePart('{"m":"a","idx":0,"total":1,"bytes":""}'), null);
  assert.equal(parseVoicePart('{"m":"a","idx":0,"total":1,"bytes":"!!!!"}'), null); // geçersiz b64
  const big = JSON.stringify({ m: 'a', idx: 0, total: VOICE_MAX_PARTS + 1, bytes: 'AA==' });
  assert.equal(parseVoicePart(big), null); // total sınırı
});

test('VoiceAssembly: sıralı parçalar tamamlar', () => {
  const asm = new VoiceAssembly();
  const bytes = new Uint8Array(VOICE_CHUNK_SIZE + 3).fill(9).buffer;
  const parts = splitVoiceParts('m1', bytes, { mime: 'audio/webm', ts: 5 });
  let done = null;
  parts.forEach((p) => { const r = asm.add('alice', parseVoicePart(p)); if (r) done = r; });
  assert.ok(done && done.complete);
  assert.equal(done.mid, 'm1');
  assert.deepEqual(Array.from(new Uint8Array(done.bytes)), Array.from(new Uint8Array(bytes)));
  assert.equal(done.mime, 'audio/webm'); assert.equal(done.ts, 5);
  assert.equal(asm.bytesFor('alice'), 0); // tamamlanan kayıt silinir
});

test('VoiceAssembly: sıra dışı parçalar eksiksizle tamamlar', () => {
  const asm = new VoiceAssembly();
  const bytes = new Uint8Array(VOICE_CHUNK_SIZE * 2).fill(1).buffer;
  const parts = splitVoiceParts('m2', bytes).map((p) => parseVoicePart(p));
  const r0 = asm.add('bob', parts[1]); // önce son parça
  assert.equal(r0, null); // eksik parça → tamamlanmaz
  const r1 = asm.add('bob', parts[0]);
  assert.ok(r1 && r1.complete);
  assert.equal(asm.bytesFor('bob'), 0);
});

test('VoiceAssembly: duplicate parça sessizce atılır, çift tamamlama olmaz', () => {
  const asm = new VoiceAssembly();
  const bytes = new Uint8Array(VOICE_CHUNK_SIZE).fill(3).buffer;
  const parts = splitVoiceParts('m3', bytes).map((p) => parseVoicePart(p));
  const dup = { ...parts[0] }; // aynı idx
  asm.add('carol', parts[0]);
  assert.equal(asm.add('carol', dup), null);
  assert.equal(asm.bytesFor('carol'), VOICE_CHUNK_SIZE); // çift sayılmaz
});

test('VoiceAssembly: bütçe aşımı parçası sessizce düşer', () => {
  const asm = new VoiceAssembly();
  // İlk kayıt tamamlanmamış (total:2, sadece idx 0 geldi) → bütçenin yarısı dolu
  const half = new Uint8Array(VOICE_MAX_BYTES / 2).fill(0).buffer;
  assert.equal(asm.add('dave', parseVoicePart(JSON.stringify({ m: 'a', idx: 0, total: 2, bytes: bytesToB64Url(half) }))), null);
  // İkinci kayıt yarıdan büyük → bütçeyi aşar → sessizce düşer
  const over = new Uint8Array(VOICE_MAX_BYTES / 2 + 1).fill(0).buffer;
  assert.equal(asm.add('dave', parseVoicePart(JSON.stringify({ m: 'b', idx: 0, total: 1, bytes: bytesToB64Url(over) }))), null);
  assert.equal(asm.bytesFor('dave'), VOICE_MAX_BYTES / 2); // yalnızca ilk parça sayıldı
});

test('VoiceAssembly: total uyumsuzluğu sessizce atılır; clear/clearAll temizler', () => {
  const asm = new VoiceAssembly();
  const a = parseVoicePart(JSON.stringify({ m: 't', idx: 0, total: 2, bytes: 'AA==' }));
  const b = parseVoicePart(JSON.stringify({ m: 't', idx: 1, total: 3, bytes: 'AA==' }));
  asm.add('erin', a);
  assert.equal(asm.add('erin', b), null);
  asm.clear('erin');
  assert.equal(asm.bytesFor('erin'), 0);
  asm.add('erin', a);
  asm.clearAll();
  assert.equal(asm.bytesFor('erin'), 0);
});
```

- [ ] **Step 3: testleri çalıştır — geçmeli**

Run: `npm test`
Expected: `tests/voice.test.mjs` 9 test `pass`, exit 0. (i18n/codec testleri de yeşil kalır.)

---

## Task 1: `src/call-state.js` — saf çağrı durum makinesi + testleri

**Files:**
- Create: `src/call-state.js`
- Test: `tests/call.test.mjs`

**Interfaces:**
- Consumes: hiçbir şey (`crypto` globali).
- Produces: `CALL_MODES`, `newCallId()`, `beginCall(verified, current, username, mode)`, `acceptIncoming(verified, current, from, mode, callId)`, `markActive(record)`, `clearCall()`, `callMatches(record, callId, username?)`. Task 3 (offscreen k:14) bunları kullanır.

- [ ] **Step 1: `src/call-state.js` oluştur**

```js
/* ILQ call-state — çağrı durum makinesi (saf, node:test tarafından da import edilir).
 * state.call = null | { callId, username, mode, phase } — tek aktif aramanın hakemi.
 * `entry.verified` zorlaması ve tek-aktif kuralı burada; medya RTCPeerConnection
 * side panelde yaşar ve bu dosyada YOKTUR. RAM-only: diske hiçbir şey yazılmaz. */

export const CALL_MODES = ['audio', 'video'];

export function newCallId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Arayan: startCall doğrulaması. Verified yoksa başlatılmaz; aktif çağrı varken reddeder.
export function beginCall(verified, current, username, mode) {
  if (!CALL_MODES.includes(mode)) return { ok: false, error: 'error.callBadSignal' };
  if (!verified) return { ok: false, error: 'error.notVerified' };
  if (current) return { ok: false, error: 'error.callActive' };
  return { ok: true, record: { callId: newCallId(), username, mode, phase: 'outgoing' } };
}

// Alıcı: gelen k:14 'request' kararı.
// blocked → otomatik reject + callBlocked (medya asla kurulmaz). busy → otomatik reject.
export function acceptIncoming(verified, current, from, mode, callId) {
  if (!CALL_MODES.includes(mode)) return { drop: true };
  if (!verified) return { blocked: true };
  if (current) return { busy: true };
  return { record: { callId, username: from, mode, phase: 'incoming' } };
}

export function markActive(record) {
  return record ? { ...record, phase: 'active' } : null;
}

export function clearCall() { return null; }

export function callMatches(record, callId, username) {
  return !!(record && record.callId === callId && (!username || record.username === username));
}
```

- [ ] **Step 2: `tests/call.test.mjs` — durum makinesi testlerini yaz**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCallId, beginCall, acceptIncoming, markActive, clearCall, callMatches } from '../src/call-state.js';

test('beginCall: verified yoksa başlatılamaz', () => {
  const r = beginCall(false, null, 'alice', 'audio');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'error.notVerified');
});

test('beginCall: aktif çağrı varken ikinci çağrı reddedilir', () => {
  const first = { callId: '1', username: 'alice', mode: 'audio', phase: 'active' };
  const r = beginCall(true, first, 'bob', 'video');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'error.callActive');
});

test('beginCall: geçerli başlatma outgoing kayıt üretir', () => {
  const r = beginCall(true, null, 'alice', 'video');
  assert.equal(r.ok, true);
  assert.equal(r.record.username, 'alice');
  assert.equal(r.record.mode, 'video');
  assert.equal(r.record.phase, 'outgoing');
  assert.ok(r.record.callId.length > 0);
});

test('beginCall: geçersiz mod reddedilir', () => {
  const r = beginCall(true, null, 'alice', 'screen');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'error.callBadSignal');
});

test('acceptIncoming: verified yoksa blocked (reject + bildirim, medya yok)', () => {
  const r = acceptIncoming(false, null, 'alice', 'audio', 'c1');
  assert.equal(r.blocked, true);
  assert.ok(!r.record);
});

test('acceptIncoming: mevcut çağrı varken busy', () => {
  const current = { callId: 'x', username: 'old', mode: 'audio', phase: 'active' };
  const r = acceptIncoming(true, current, 'new', 'audio', 'c2');
  assert.equal(r.busy, true);
});

test('acceptIncoming: geçerli kabul incoming kayıt üretir, callId korunur', () => {
  const r = acceptIncoming(true, null, 'bob', 'video', 'c3');
  assert.equal(r.record.username, 'bob');
  assert.equal(r.record.callId, 'c3');
  assert.equal(r.record.phase, 'incoming');
});

test('acceptIncoming: geçersiz mod sessiz düşer', () => {
  const r = acceptIncoming(true, null, 'bob', 'chat', 'c4');
  assert.equal(r.drop, true);
});

test('markActive phase\'i active yapar; clearCall null döner', () => {
  const rec = { callId: 'c', username: 'u', mode: 'audio', phase: 'incoming' };
  assert.equal(markActive(rec).phase, 'active');
  assert.equal(clearCall(), null);
});

test('callMatches: callId ve username eşleşmesini doğrular', () => {
  const rec = { callId: 'c1', username: 'alice', mode: 'audio', phase: 'active' };
  assert.equal(callMatches(rec, 'c1', 'alice'), true);
  assert.equal(callMatches(rec, 'c1', 'bob'), false);
  assert.equal(callMatches(rec, 'c2', 'alice'), false);
  assert.equal(callMatches(null, 'c1', 'alice'), false);
});

test('newCallId: tahmin edilemez, tekil görünümlü', () => {
  const a = newCallId(); const b = newCallId();
  assert.notEqual(a, b);
  assert.equal(a.length, 32); // 16 bayt hex
});
```

- [ ] **Step 3: testleri çalıştır — geçmeli**

Run: `npm test`
Expected: `tests/call.test.mjs` 12 test `pass`, exit 0.

---

## Task 2: offscreen — k:13 sesli mesaj kanalı

**Files:**
- Modify: `src/offscreen.js` (state, offscreen.py değil — doğru dosya `src/offscreen.js`; imports, kabul listesi 661, yeni fonksiyonlar, `cleanupConn`, `resetIdentity`, `resetAll`, message handler case'leri)
- Test: `npm test` (saf kısım Task 0'da); glue build + manuel smoke

**Interfaces:**
- Consumes: `VoiceAssembly`, `splitVoiceParts`, `parseVoicePart` (Task 0), mevcut `sendEnvelope`, `trackExpiryTimer`, `scheduleMessageExpiry`, `scheduleChatExpiryForMessage`, `setRecallWindow`, `randomMid`, `base64ToB64Url`.
- Produces: `state.voice = new VoiceAssembly()`; `sendVoiceMessage(username, bytes, mime, expSeconds)`; k:13 gelen dalı; `notify('voiceMessage', {from, mid, bytes, mime, ts})`, `notify('voiceSent', {username, mid})`; cleanup entegrasyonu. Task 6 (popup) `voiceMessage`/`voiceSent`/`expired` olaylarını tüketir.

- [ ] **Step 1: `src/offscreen.js` import'una voice modülünü ekle**

`src/offscreen.js` satır 13'ten sonra:

```js
import { VoiceAssembly, splitVoiceParts, parseVoicePart } from './voice.js';
```

- [ ] **Step 2: `state` bloğuna `voice` alanını ekle**

`src/offscreen.js` `state` nesnesine (satır 146 civarı, `decoy: false,` üstüne):

```js
  voice: new VoiceAssembly(), // k:13 sesli mesaj birleştirme tamponları (RAM-only)
  call: null, // tek aktif çağrı kaydı (Task 3 doldurur)
```

- [ ] **Step 3: k:13 gerçekleştirmesini ekle — `sendVoiceChunks` + `sendVoiceMessage`**

`sendFileChunks` fonksiyonundan sonra (satır ~625 sonrası):

```js
// ---------- sesli mesaj (Paket 5, k:13) ----------
// Parça gövdesi: {m, idx, total, bytes:base64url}; mime/ts/e yalnızca idx===0'da.
// Pompa dosya transferiyle aynı ritimde (65ms) — token-bucket'a takılmaz.
function sendVoiceChunks(username, mid, parts) {
  let idx = 0;
  const pump = () => {
    const entry = state.peers.get(username);
    if (!entry || !entry.cipher || !entry.conn || !entry.conn.open) return;
    if (idx >= parts.length) {
      notify('voiceSent', { username, mid });
      return;
    }
    entry.cipher.encrypt(new TextEncoder().encode(parts[idx]).buffer)
      .then((r) => {
        try { sendEnvelope(entry.conn, 13, r.body, r.registrationId); } catch (_) { return; }
        idx++;
        setTimeout(pump, 65);
      })
      .catch(() => { /* sessiz — kanal kapalıysa gönderim durur */ });
  };
  pump();
}

async function sendVoiceMessage(username, bytes, mime, expSeconds) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) throw new Error('error.noConnection');
  if (!entry.verified) throw new Error('error.notVerified');
  if (!bytes || bytes.byteLength === 0) throw new Error('error.emptyVoice');
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('error.voiceTooLarge');
  if (!entry.conn || !entry.conn.open) throw new Error('error.channelClosed');
  const mid = randomMid();
  const ts = Date.now();
  const parts = splitVoiceParts(mid, bytes, { mime, ts, e: (expSeconds && expSeconds > 0) ? expSeconds : undefined });
  sendVoiceChunks(username, mid, parts);
  setRecallWindow(username, mid);
  // Paket 3 senkronu: gönderenin kendi balonu da süresi/sohbet zamanlayıcısı gelince düşer
  if (expSeconds && expSeconds > 0) {
    trackExpiryTimer(entry, setTimeout(() => { notify('expired', { mid, from: username }); }, expSeconds * 1000));
  }
  if (entry.timer && entry.timer > 0) {
    trackExpiryTimer(entry, setTimeout(() => { notify('expired', { mid, from: username }); }, entry.timer * 1000));
  }
  return { ok: true, mid };
}
```

- [ ] **Step 4: gelen k:13 dalını `handleIncoming`'e ekle — kabul listesini 13 ile genişlet**

`src/offscreen.js:661` zarf tipi satırı:

```js
    if (![1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(envelope.k)) return; // bilinmeyen zarf türü: sessiz at (Paket 1 posture)
```

`handleIncoming`'de k:12 dalından (satır ~886) sonra:

```js
    } else if (envelope.k === 13) {
      // Sesli mesaj parçası (alıcı): tek tek birleştir; tümü gelince VoiceAssembly tamamlar.
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      const part = parseVoicePart(new TextDecoder().decode(plain));
      if (!part) return; // geçersiz/boş parça → sessiz at
      const done = state.voice.add(remoteUsername, part);
      if (done && done.complete) {
        notify('voiceMessage', { from: remoteUsername, mid: done.mid, bytes: done.bytes, mime: done.mime, ts: done.ts });
        // Süre/yok etme: mesaj süresi (e) ve sohbet zamanlayıcısı kuralı aynen uygulanır
        if (done.e && done.ts) scheduleMessageExpiry({ mid: done.mid, e: done.e, ts: done.ts }, entry, remoteUsername);
        if (entry.timer && done.ts) scheduleChatExpiryForMessage({ mid: done.mid, ts: done.ts }, entry, remoteUsername);
      }
    }
```

- [ ] **Step 5: `cleanupConn`, `resetIdentity`, `resetAll`'a voice temizliği ekle**

`cleanupConn` — eş kaydı silinen döngü içine (satır ~284), `state.peers.delete(username);` yanına:

```js
      state.voice.clear(username); // k:13 parça tamponları (RAM-only)
```

Not: k:3/k:1'i kirletmeyin — voice.clear yalnızca bu bloğa eklenir.

`resetIdentity` (satır ~1021 `state.files.clear();` sonrası):

```js
  state.voice.clearAll(); // bekleyen ses parçaları da RAM'den düşer
  state.call = null; // aktif çağrı kapanır (Task 3)
```

`resetAll` (satır ~1038 `state.files.clear();` sonrası):

```js
  state.voice.clearAll();
  state.call = null;
```

- [ ] **Step 6: message handler'a `sendVoiceMessage` case'i ekle**

`sendFileOffer` case'inden sonra (satır ~1111):

```js
        case 'sendVoiceMessage':
          return await sendVoiceMessage(msg.username, msg.bytes, msg.mime, msg.expSeconds);
```

- [ ] **Step 7: build + saf test**

Run: `npm test; npm run build`
Expected: 12 (voice) + 12 (call) + i18n + codec hepsi yeşil; `dist/offscreen.js` üretilir, `dist/popup.js` bozulmaz. Chrome'un DevTools konsolunda k:13 akışı iki tarafıyla `sendVoiceMessage` → `voiceMessage` → `voiceSent` — Task 6 sonrası tam smoke.

---

## Task 3: offscreen — k:14 çağrı sinyal rölesi + `state.call`

**Files:**
- Modify: `src/offscreen.js` (import, k:14 gelen dalı, `startCall`, `callSignal`, helper `sendCallSignal`, cleanup)
- Test: `npm test` (saf kısım Task 1'de); glue build + iki-Chrome manuel (Task 8)

**Interfaces:**
- Consumes: `beginCall`, `acceptIncoming`, `markActive`, `clearCall`, `callMatches` (Task 1), mevcut `sendEnvelope`, `notify`.
- Produces: message handler case'leri `startCall({username, mode})` ve `callSignal({username, callId, c, mode?, desc?, candidate?})`; k:14 gelen dalı; `notify('callSignal', {from, c, callId, mode?, desc?, candidate?})`, `notify('callEnded', {from, callId})`, `notify('callBlocked', {from})`. Task 6 (popup) bunları tüketir. `startCall` yanıtı `{ok, callId, iceServers}` döndürür (panel RTCPeerConnection için).

- [ ] **Step 1: `src/offscreen.js` import'una call-state ekle**

`src/offscreen.js` satır 13'ten sonra ekle (voice import'unun yanına):

```js
import { beginCall, acceptIncoming, markActive, clearCall, callMatches } from './call-state.js';
```

- [ ] **Step 2: k:14 helper + röle fonksiyonlarını ekle** (`sendWithout` almaz; `sendVoiceChunks` sonrası)

```js
// ---------- canlı arama (Paket 5, k:14 sinyal rölesi) ----------
// Medya RTCPeerConnection panelde; burada yalnızca Signal-şifreli röle ve doğrulama.
function sendCallSignal(entry, payload) {
  if (!entry || !entry.cipher || !entry.conn || !entry.conn.open) return;
  entry.cipher.encrypt(new TextEncoder().encode(JSON.stringify(payload)).buffer)
    .then((r) => {
      try { sendEnvelope(entry.conn, 14, r.body, r.registrationId); } catch (_) {}
    })
    .catch(() => { /* sessiz */ });
}

async function startCall(username, mode) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) throw new Error('error.noConnection');
  const res = beginCall(!!entry.verified, state.call, username, mode);
  if (!res.ok) throw new Error(res.error);
  state.call = res.record;
  return { ok: true, callId: res.record.callId, iceServers: (state.network && state.network.iceServers) || [] };
}

// Panel → offscreen röle: her c türü için callId eşleşmesi zorunlu; mismatch sessizce engellenir.
function callSignal(username, payload) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) throw new Error('error.noConnection');
  if (!entry.verified) throw new Error('error.notVerified');
  const c = payload.c;
  const callId = payload.callId;
  if (!callMatches(state.call, callId, username) && c !== 'reject') throw new Error('error.callBadSignal');
  if (c === 'request') {
    if (!state.call || state.call.phase !== 'outgoing' || state.call.callId !== callId) throw new Error('error.callBadSignal');
  } else if (c === 'answer') {
    state.call = markActive(state.call);
  } else if (c === 'reject' || c === 'end') {
    state.call = clearCall();
  } else if (c !== 'ice') {
    return { ok: false, error: 'error.callBadSignal' };
  }
  sendCallSignal(entry, payload);
  return { ok: true };
}

function endCallForPeer(username) {
  if (state.call && state.call.username === username) {
    const callId = state.call.callId;
    state.call = clearCall();
    notify('callEnded', { from: username, callId });
  }
}
```

- [ ] **Step 3: gelen k:14 dalını `handleIncoming`'e ekle** (k:13 dalından sonra)

```js
    } else if (envelope.k === 14) {
      // Çağrı sinyali (alıcı): doğrula, gerekirse otomatik reject, panele ilet (röle).
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      let sig;
      try { sig = JSON.parse(new TextDecoder().decode(plain)); } catch (_) { return; }
      if (!sig || typeof sig.callId !== 'string' || typeof sig.c !== 'string') return;
      if (sig.c === 'request') {
        const res = acceptIncoming(!!entry.verified, state.call, remoteUsername, sig.mode, sig.callId);
        if (res.drop) return; // geçersiz mod → sessiz
        if (res.blocked) {
          sendCallSignal(entry, { callId: sig.callId, c: 'reject' });
          notify('callBlocked', { from: remoteUsername });
          return; // medya asla kurulmaz, panele callSignal gitmez
        }
        if (res.busy) { sendCallSignal(entry, { callId: sig.callId, c: 'reject' }); return; }
        state.call = res.record;
        notify('callSignal', { from: remoteUsername, c: 'request', callId: sig.callId, mode: sig.mode, desc: sig.desc });
      } else if (sig.c === 'answer') {
        if (!callMatches(state.call, sig.callId, remoteUsername)) return; // eşleşmeyen → sessiz
        state.call = markActive(state.call);
        notify('callSignal', { from: remoteUsername, c: 'answer', callId: sig.callId, desc: sig.desc });
      } else if (sig.c === 'ice') {
        if (!callMatches(state.call, sig.callId, remoteUsername)) return;
        notify('callSignal', { from: remoteUsername, c: 'ice', callId: sig.callId, candidate: sig.candidate });
      } else if (sig.c === 'reject') {
        if (!callMatches(state.call, sig.callId, remoteUsername)) return;
        state.call = clearCall();
        notify('callSignal', { from: remoteUsername, c: 'reject', callId: sig.callId });
      } else if (sig.c === 'end') {
        if (!callMatches(state.call, sig.callId, remoteUsername)) return;
        state.call = clearCall();
        notify('callEnded', { from: remoteUsername, callId: sig.callId });
      }
    }
```

- [ ] **Step 4: `cleanupConn` + panic/reset entegrasyonu**

`cleanupConn` — `state.peers.delete(username);` yanındaki voice.clear satırından sonra:

```js
      endCallForPeer(username); // veri kanalı kapanınca çağrı da biter
```

`resetIdentity` — `state.voice.clearAll();` altına (Task 2 zaten `state.call = null;` koydu; bildirim ekle):

```js
  if (state.call) { const { callId } = state.call; state.call = null; notify('callEnded', { callId }); }
```

`resetAll` — aynı şekilde `state.call = null;` yerine:

```js
  if (state.call) { const { callId } = state.call; state.call = null; notify('callEnded', { callId }); }
```

- [ ] **Step 5: message handler'a `startCall` ve `callSignal` case'lerini ekle**

`sendVoiceMessage` case'inden sonra:

```js
        case 'startCall':
          return await startCall(msg.username, msg.mode);
        case 'callSignal':
          return callSignal(msg.username, msg.payload || {});
```

- [ ] **Step 6: build + saf test**

Run: `npm test; npm run build`
Expected: tüm testler yeşil, dist üretilir. `callBlocked`'ın panele `callSignal` göndermediği — Task 8 manuel akışında doğrulanır.

---

## Task 4: `src/i18n.js` — yeni tr/en anahtarları (ses + çağrı)

**Files:**
- Modify: `src/i18n.js` (tr bloğu: `'chat.send':` sonrası; en bloğu aynı noktada — anahtarlar SIRALI eşleşmelidir)
- Test: `tests/i18n.test.mjs` (tr/en anahtar kümesi eşitliği + HTML varlığı)

**Interfaces:**
- Consumes: hiçbir şey. Produces: `voice.*`, `call.*`, `err.*`, `error.*` anahtarları. Task 5 (HTML) ve Task 6/7 (popup) kullanır.

- [ ] **Step 1: tr anahtarlarını ekle**

`src/i18n.js` tr bloğunda `'chat.send': 'Gönder',` satırından sonra:

```js
    'chat.recMic': 'Sesli mesaj',
    'voice.record': 'Kaydet',
    'voice.recording': 'kayıt…',
    'voice.stop': 'Dur',
    'voice.cancel': 'Vazgeç',
    'voice.send': 'Gönder',
    'voice.play': 'Oynat',
    'voice.pause': 'Duraklat',
    'voice.ready': 'Ses kaydı hazır',
    'voice.sent': 'Sesli mesaj gönderildi',
    'voice.countdown': 'kayıt',
    'call.audio': 'Sesli arama',
    'call.video': 'Görüntülü arama',
    'call.calling': 'çağrılıyor…',
    'call.ringing': 'gelen arama',
    'call.accept': 'Kabul et',
    'call.reject': 'Reddet',
    'call.end': 'Bitir',
    'call.mute': 'Mikrofon kapat',
    'call.unmute': 'Mikrofon aç',
    'call.videoOn': 'Kamera açık',
    'call.videoOff': 'Kamera kapalı',
    'call.endedNote': 'Arama sona erdi',
    'call.activeNote': 'Görüşme sürüyor',
    'err.micDenied': 'Mikrofon izni verilmedi',
    'err.voiceFailed': 'Ses kaydı başlatılamadı',
    'err.voiceSendFailed': 'Sesli mesaj gönderilemedi',
    'err.callStartFailed': 'Arama başlatılamadı',
    'err.callBlocked': 'Doğrulanmamış eş — arama engellendi',
    'err.callBadSignal': 'Geçersiz arama sinyali',
    'error.emptyVoice': 'Boş ses kaydı gönderilemez',
    'error.voiceTooLarge': 'Ses kaydı çok büyük (en fazla 8 MB)',
    'error.callActive': 'Zaten aktif bir arama var',
    'error.callBadSignal': 'Geçersiz arama sinyali',
```

- [ ] **Step 2: en anahtarlarını ekle (aynı sıra, aynı anahtarlar)**

`src/i18n.js` en bloğunda `'chat.send': 'Send',` satırından sonra:

```js
    'chat.recMic': 'Voice message',
    'voice.record': 'Record',
    'voice.recording': 'recording…',
    'voice.stop': 'Stop',
    'voice.cancel': 'Cancel',
    'voice.send': 'Send',
    'voice.play': 'Play',
    'voice.pause': 'Pause',
    'voice.ready': 'Voice recording ready',
    'voice.sent': 'Voice message sent',
    'voice.countdown': 'recording',
    'call.audio': 'Voice call',
    'call.video': 'Video call',
    'call.calling': 'calling…',
    'call.ringing': 'incoming call',
    'call.accept': 'Accept',
    'call.reject': 'Decline',
    'call.end': 'End',
    'call.mute': 'Mute mic',
    'call.unmute': 'Unmute',
    'call.videoOn': 'Camera on',
    'call.videoOff': 'Camera off',
    'call.endedNote': 'Call ended',
    'call.activeNote': 'Call in progress',
    'err.micDenied': 'Microphone permission denied',
    'err.voiceFailed': 'Could not start voice recording',
    'err.voiceSendFailed': 'Could not send voice message',
    'err.callStartFailed': 'Could not start the call',
    'err.callBlocked': 'Unverified peer — call blocked',
    'err.callBadSignal': 'Invalid call signal',
    'error.emptyVoice': 'Cannot send an empty voice message',
    'error.voiceTooLarge': 'Voice message too large (max 8 MB)',
    'error.callActive': 'A call is already active',
    'error.callBadSignal': 'Invalid call signal',
```

- [ ] **Step 3: testleri çalıştır — sözlük tutarlı**

Run: `npm test`
Expected: `i18n.test.mjs` yeşil (tr/en anahtar kümeleri eşit, boş yok, HTML eksik anahtar yok — HTML henüz değişmediği için geçer). `error.callBadSignal` tr/en'de de `error.callBadSignal`'e eşit DEĞİL — kural geçer (Test 2: anahtar kendisine çevrilmiyor).

---

## Task 5: `src/manifest.json` + `src/sidepanel.html` — izin + kompozör/çoklu ortam UI

**Files:**
- Modify: `src/manifest.json`
- Modify: `src/sidepanel.html`
- Test: `npm test` (i18n HTML varlık testi artık gerçek yük görür) + `npm run build`

**Interfaces:**
- Consumes: Task 4 anahtarları. Produces: `#micBtn`, `#voiceDraftBar`, `#callBtn`, `#callVideoBtn`, `#callOverlay` + alt bileşenler, `#remoteVideo`, `#localVideo`. Task 6/7 (popup.js) bunlara bağlanır; Task 8 (CSS) stiller.

- [ ] **Step 1: manifest'e `audioCapture` ekle**

`src/manifest.json`:

```json
  "permissions": ["offscreen", "sidePanel", "videoCapture", "audioCapture"],
```

- [ ] **Step 2: kompozöre sesli mesaj butonu + taslak çubuğu ekle**

`src/sidepanel.html` — `#fileBtn` butonundan ÖNCE:

```html
          <input type="file" id="fileInput" hidden>
          <button id="micBtn" class="button-secondary filebtn" type="button" title="Sesli mesaj" aria-label="Sesli mesaj" data-i18n-title="chat.recMic" data-i18n-aria="chat.recMic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3"/>
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/>
              <path d="M12 18v3"/>
            </svg>
          </button>
          <button id="fileBtn" class="button-secondary filebtn" type="button" title="Dosya gönder" aria-label="Dosya gönder" data-i18n-title="chat.fileBtn" data-i18n-aria="chat.fileBtn">
```

Not: `fileInput` zaten hemen üstte; yapı şöyle olur: `expirySelect`, `fileInput`, `micBtn`, `fileBtn`, `messageInput`, `sendBtn`. (fileBtn zaten `input`'un altında; micBtn ondan önce gelir.)

- [ ] **Step 3: kompozörün altına taslak çubuğu ekle** (`</div>` kompozör kapanışından SONRA, `#fpToast`'tan önce)

```html
        <div id="voiceDraftBar" class="voice-draft hidden">
          <span class="voice-draft-label" data-i18n="voice.ready">Ses kaydı hazır</span>
          <audio id="voiceDraftAudio" controls preload="metadata"></audio>
          <button id="voiceDraftSendBtn" class="secondary" type="button" data-i18n="voice.send">Gönder</button>
          <button id="voiceDraftCancelBtn" class="ghost" type="button" data-i18n="voice.cancel">Vazgeç</button>
        </div>
```

- [ ] **Step 4: chat header'a arama butonları ekle** (`#readAckBtn`'in hemen öncesi)

```html
          <button id="callBtn" class="chat-call-btn" type="button" title="Sesli arama" aria-label="Sesli arama" data-i18n-title="call.audio" data-i18n-aria="call.audio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6.5 3.5h4l1.5 5-2.2 1.6a13 13 0 0 0 4.6 4.6l1.6-2.2 5 1.5v4a1.8 1.8 0 0 1-2 1.8A15.5 15.5 0 0 1 4.7 5.5a1.8 1.8 0 0 1 1.8-2Z"/>
            </svg>
            <span data-i18n="call.audio">Sesli arama</span>
          </button>
          <button id="callVideoBtn" class="chat-call-btn" type="button" title="Görüntülü arama" aria-label="Görüntülü arama" data-i18n-title="call.video" data-i18n-aria="call.video">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="6" width="13" height="12" rx="1.5"/>
              <path d="m16 10 5-2.5v9L16 14"/>
            </svg>
            <span data-i18n="call.video">Görüntülü arama</span>
          </button>
          <button id="readAckBtn" ...
```

- [ ] **Step 5: `#fpToast`'tan sonra çağrı overlay'ini ekle**

```html
        <div id="callOverlay" class="call-overlay hidden">
          <div class="call-card">
            <div class="call-head">
              <span id="callPeer" class="mono"></span>
              <span id="callStatus" class="call-status" data-i18n="call.calling">çağrılıyor…</span>
              <span id="callTimer" class="call-timer mono" hidden></span>
            </div>
            <div id="callVideos" class="call-videos hidden">
              <video id="remoteVideo" autoplay playsinline class="call-remote"></video>
              <video id="localVideo" autoplay playsinline muted class="call-local"></video>
            </div>
            <div id="callAvatar" class="call-avatar hidden"></div>
            <div class="call-actions">
              <button id="callAcceptBtn" class="primary hidden" type="button" data-i18n="call.accept">Kabul et</button>
              <button id="callRejectBtn" class="danger" type="button" data-i18n="call.reject">Reddet</button>
              <button id="callEndBtn" class="danger hidden" type="button" data-i18n="call.end">Bitir</button>
              <button id="callMuteBtn" class="secondary hidden" type="button" data-i18n="call.mute">Mikrofon kapat</button>
              <button id="callVideoToggleBtn" class="secondary hidden" type="button" data-i18n="call.videoOff">Kamera kapalı</button>
            </div>
          </div>
        </div>
```

- [ ] **Step 6: build + i18n testi**

Run: `npm test; npm run build`
Expected: i18n HTML varlık testi geçer (tüm yeni `data-i18n`/`data-i18n-title`/`data-i18n-aria` anahtarları sözlükte); manifest doğru; dist üretilir.

---

## Task 6: popup — sesli mesaj akışı (kayıt + fiş oynatıcı + yok etme + temizlik)

**Files:**
- Modify: `src/popup.js`
- Test: `npm test` + `npm run build` + manuel tek-taraf smoke

**Interfaces:**
- Consumes: `startVoiceRecorder` (Task 0), `sendToOffscreen`, `t`, mevcut `removeMessageBubble`, `showTempError`, `errorText`, olaylar `voiceMessage`/`voiceSent`/`expired`/`panic`/`reset` (Task 2).
- Produces: `window.__voiceUrls`, `window.__voiceRec` (recorder), `window.__voiceDraft`; `addVoiceChip(mid, bytes, mime, who)`, `showVoiceDraftBar(blob)`, `clearVoiceDraft()`, `clearVoiceCards()`, `stopActiveRecording()`. Task 7 (popup çağrı) ve Task 8 (CSS) bunlarla arayüzlenir.

- [ ] **Step 1: import + window kayıtları**

`src/popup.js` satır 1-3 arası importlara ekle:

```js
import { startVoiceRecorder } from './voice.js';
```

Satır 12 (`window.__pendingRead` sonrası):

```js
window.__voiceUrls = {}; // mid -> objectURL (RAM-only; expired/panik/reset revoke)
window.__voiceRec = null; // { stop, elapsed } — aktif kayıt
window.__voiceDraft = null; // { url, blob, mime, bytes }
```

- [ ] **Step 2: sesli mesaj fişi + taslak barı yardımcıları**

`clearFileCards` fonksiyonundan sonra ekle:

```js
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
```

- [ ] **Step 3: olaylara voice + temizlik case'leri ekle**

`chrome.runtime.onMessage` `switch`'inde `fileAck` case'inden sonra:

```js
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
```

`panic` case'ine (mevcut `clearFileCards();` sonrası):

```js
      stopActiveRecording();
      clearVoiceDraft();
      clearVoiceCards();
```

`reset` case'ine (aynı yere):

```js
      stopActiveRecording();
      clearVoiceDraft();
      clearVoiceCards();
```

- [ ] **Step 4: build + i18n + manuel tek-taraf smoke**

Run: `npm test; npm run build`
Expected: tüm testler yeşil. Manuel: kayıt başlat (mikrofon izni), geri sayım, dur → taslak barı, gönder → out fişi oynatılabilir; süreli gönderim 30sn sonra balon düşer; panik/reset sonrası fişler temizlenir.

---

## Task 7: popup — çağrı akışı (RTCPeerConnection + k:14 röle)

**Files:**
- Modify: `src/popup.js`
- Test: `npm test` + `npm run build` + iki-Chrome manuel (Task 9 checklist)

**Interfaces:**
- Consumes: `createCallPeerConnection`, `attachLocalTracks` (Task 0), Task 3 röle case'leri + olayları, Task 5 DOM kimlikleri.
- Produces: `window.__call`, `openCallUI`/`closeCallUI`, çağrı olay işleyicileri (`callSignal`, `callEnded`, `callBlocked`), `flush` kilidi `window.__callPendingIce`. Task 8 (CSS) overlay stillerini kullanır.

- [ ] **Step 1: window kaydı + UI yardımcıları**

`window.__voiceDraft = null;` satırından sonra:

```js
window.__call = null; // { callId, username, mode, pc, localStream, remoteStream, phase, pendingIce }
window.__callTimerId = null;
```

`setStatusToConnection` fonksiyonundan sonra ekle:

```js
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
```

- [ ] **Step 2: aramayı başlat (ses/video)**

`sendVoiceDraft`/dinleyiciler bölümünden sonra ekle:

```js
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
    sendToOffscreen('callSignal', { username: activePeer, callId: startRes.callId, c: 'cancelled' }).catch(() => {});
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
```

- [ ] **Step 3: gelen olayları işle (callSignal / callEnded / callBlocked)**

`voiceSent` case'inden sonra, `switch` içine:

```js
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
```

- [ ] **Step 4: `awaitRemoteAnswer` + kabul/red/bitir + mute/video toggle**

Aynı bölüme ekle:

```js
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
```

- [ ] **Step 5: panik/reset + ayrılma temizliği**

`panic` case'ine (`clearVoiceCards();` sonrası):

```js
      teardownCall();
```

`reset` case'ine (aynı):

```js
      teardownCall();
```

`window.addEventListener('beforeunload', ...)` anahtarına (dosya sonu yakını) ekle — panel kapanınca PC düzgün kapanır:

```js
window.addEventListener('beforeunload', teardownCall);
```

- [ ] **Step 6: build + iki-Chrome smoke sonrası i18n/algı alma**

Run: `npm test; npm run build`
Expected: tüm testler yeşil. İki Chrome penceresiyle sesli arama → zil → kabul → karşılıklı dinleme; görüntülü aramada uzak/yerel video; red/bitir; panik sonrası her iki uçta overlay kapanır.

---

## Task 8: CSS — voice fişi + taslak barı + çağrı overlay

**Files:**
- Modify: `src/popup.css` (fiş + taslak)
- Modify: `src/sidepanel.css` (overlay)
- Test: `npm run build` + detektör

**Interfaces:**
- Consumes: Task 5 DOM sınıfları. Produces: `.voice-chip`, `.voice-play`, `.voice-progress`, `.voice-progress-fill`, `.voice-time`, `.recording`, `.voice-draft`, `.call-overlay`, `.call-card`, `.call-head`, `.call-videos`, `.call-remote`, `.call-local`, `.call-avatar`, `.call-actions`, `.chat-call-btn`. Task 9 (docs) sonrası genel smoke.

- [ ] **Step 1: `popup.css`'e voice fişi stilleri ekle** (`.file-card` bloğunun sonrası, satır ~779 sonrası)

```css
/* --- paket 5: sesli mesaj fişi --- */
.voice-chip { display: flex; flex-direction: row; align-items: center; gap: 8px; min-width: 180px; max-width: 230px; }
.voice-play {
  flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--surface-2); color: var(--ink); border: 1px solid var(--hairline-strong);
  cursor: pointer; padding: 0;
}
.voice-play svg { width: 14px; height: 14px; display: block; }
.voice-play:hover { background: var(--surface); border-color: var(--ink-mute); }
.voice-progress { flex: 1 1 auto; height: 4px; background: var(--hairline); border-radius: 2px; overflow: hidden; }
.voice-progress-fill { height: 100%; width: 100%; background: var(--ink-soft); transform: scaleX(0); transform-origin: left; }
.voice-time { font-size: 10px; color: var(--ink-mute); }
#micBtn.recording { color: var(--danger); border-color: var(--danger); }
#micBtn.recording svg { display: none; }
#micBtn { font: 600 10px 'JetBrainsMono Variable', monospace; min-width: 34px; }
.voice-draft { display: flex; align-items: center; gap: 8px; padding: 8px 4px; }
.voice-draft audio { flex: 1 1 auto; height: 34px; }
.voice-draft-label { font: 600 10px 'InterVar'; color: var(--ink-mute); text-transform: uppercase; letter-spacing: 0.08em; }
```

- [ ] **Step 2: `sidepanel.css`'e çağrı overlay stilleri ekle** (dosya sonuna)

```css
/* --- paket 5: canlı arama overlay --- */
.chat-call-btn {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px;
  font: 600 10px 'InterVar'; color: var(--ink-soft);
  background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--r-sm);
  padding: 3px 7px; cursor: pointer;
}
.chat-call-btn svg { width: 13px; height: 13px; }
.chat-call-btn:hover { background: var(--surface-2); border-color: var(--hairline-strong); color: var(--ink); }
.call-overlay {
  position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(2px);
}
.call-card {
  width: min(320px, 86%); background: var(--surface); border: 1px solid var(--hairline-strong);
  border-radius: var(--r-lg, 14px); box-shadow: 0 10px 30px rgba(0,0,0,0.18); padding: 14px;
  display: flex; flex-direction: column; gap: 12px;
}
.call-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.call-status { font: 600 11px 'InterVar'; color: var(--ink-soft); }
.call-timer { font: 600 11px 'JetBrainsMono Variable', monospace; color: var(--ink-mute); }
.call-videos { position: relative; aspect-ratio: 4 / 3; background: var(--ground); border-radius: 8px; overflow: hidden; }
.call-remote { width: 100%; height: 100%; object-fit: cover; }
.call-local { position: absolute; right: 8px; bottom: 8px; width: 30%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; border: 1px solid var(--hairline-strong); background: #000; }
.call-avatar {
  aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center;
  background: var(--surface-2); border-radius: 8px; color: var(--ink-mute);
  font-size: 44px;
}
.call-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
```

- [ ] **Step 3: build + detektör**

Run: `npm run build` + impeccable detektör:
`node "C:/Users/NEMESIS/.config/opencode/skills/impeccable/scripts/detect.mjs" --json src/sidepanel.html src/popup.css src/sidepanel.css src/popup.js`
Expected: build başarılı; detektör exit 0, ek warning yok (yalnızca belgelenmiş micro-value advisory'leri).

---

## Task 9: `PRODUCT.md` + `README.md` — dürüst güvenlik notu + yetenekler

**Files:**
- Modify: `PRODUCT.md`, `README.md`
- Test: statik kontrol

- [ ] **Step 1: PRODUCT.md — Capabilities + Açık kararlar**

`PRODUCT.md` "Capabilities and Constraints" maddelerinden `- Arayüz Türkçe. Tek cihaz...` sonrasına eklenecek:

```markdown
- Uçtan uca sesli arama: WebRTC medyası DTLS-SRTP ile şifrelidir; arama sinyali (SDP/ICE) Signal ratchet (k:14) ile taşınır ve sunucuya düz metin gitmez. Arama sinyali meta verisi (IP adresi) mevcut sinyal sunucusu tarafından görülebilir — mesajlardaki Double Ratchet anahtar dönüşü medya için geçerli değildir.
- Sesli mesajlar (k:13) mesaj ve sohbet yok etme kurallarına tabidir; kayıtlar 60 saniye ile sınırlıdır.
```

`- Açık kararlar: ...` satırına `medya çağrısı` ekle:

```markdown
- Açık kararlar: çoklu cihaz, teslimat göstergeleri, kendi sinyal sunucusu, i18n, medya çağrısı (opsiyonel, DTLS-SRTP).
```

- [ ] **Step 2: README.md — yeni yetenekler + güvenlik tablosu + sınırlar**

Güvenlik tablosuna (README satır ~10 `İleri gizlilik` satırından sonra):

```markdown
| Canlı arama | DTLS-SRTP (WebRTC medyası) — uçtan uca; arama sinyali ratchet'li k:14; mesajlardaki Double Ratchet anahtar dönüşü medya için geçerli değildir |
| Sesli mesaj | Signal ratchet (k:13 parçalı akış), mesaj/sohbet yok etme kurallarına tabi, 60 saniye sınırı |
```

"Kullanım" bölümüne (güvenlik numarası sonrası):

```markdown
5. **Sesli mesaj / çağrı:** kompozördeki mikrofon butonuyla sesli mesaj kaydet (60 sn); sohbet başlığındaki ses/görüntü butonlarıyla doğrulanmış eşe canlı arama başlat. Aramadaki medya DTLS-SRTP ile şifrelidir; arama için her iki eş de doğrulanmış olmalıdır.
```

"Notlar / Sınırlar"a:

```markdown
- **Arama meta verisi:** çağrı sinyali (SDP/ICE) Signal-şifreli taşınır ancak sinyal sunucusu IP adresini görür; tam meta veri gizliliği için kendi PeerJS + TURN'unu barındır.
- **Zil yalnızca açık panelde:** gelen arama panel açıkken görünür; üçüncü taraf bildirim yoktur.
- **Kamera/mikro izni:** izin verilmezse sesli mesaj/çağrı başlatılamaz; videoda izin hatası otomatik sese düşmez.
```

- [ ] **Step 3: statik kontrol**

Run: `npm test; npm run build`
Expected: tüm testler/bundle yeşil; dokümanlar spec'in dürüstlük notunu birebir taşır.

---

## Task 10: Final — tam test + iki taraf manuel checklist

**Files:**
- No new files.
- Test: `npm test; npm run build` + tam manuel akış (iki Chrome profili): A kodu üretir, B kodla bağlanır, her iki taraf fingerprint'i doğrular.

**Interfaces:**
- Consumes: tüm önceki görevlerin bütünleşmesi.

- [ ] **Step 1: tam test + build**

Run: `npm test; npm run build`
Expected: codec (5) + i18n (5) + voice (9) + call (12) = 31 test `pass`, exit 0; dist/ üretilir; `dist/offscreen.js` + `dist/popup.js` boyutları makul değişim (voice.js/call-state.js bundle'a girer).

- [ ] **Step 2: P0 manuel doğrulama (iki Chrome)**

1. İki Chrome profili; her iki tarafta `dist/` yüklü; bağlan + fingerprint doğrula (gönderim ancak verified sonrası).
2. **Sesli mesaj:** A mikrofon butonuna bas → kayıt → dur → gönder; B fişi oynatır (B de ters yönde test eder). 60sn sınır ve geri sayım çalışır. `expirySelect=30sn` ile gönderilen mesaj 30sn sonra iki tarafta da düşer; `chatTimer=30sn` aynı şekilde.
3. **Sesli arama:** A `callBtn` → "çağrılıyor…"; B zil overlay → kabul → iki yönlü ses; mute/unmute; bitir → iki uçta overlay kapanır. Red → çağrı sonlanır.
4. **Görüntülü arama:** `callVideoBtn` → uzak + yerel video görünür; kamera toggle.
5. **Güvenlik:** doğrulanmamış eşten gelen k:14 request → otomatik red + `callBlocked` (B tarafında çağrı açılmaz). Doğrulanmamış eşe `startCall` → `error.notVerified`.
6. **Temizlik:** çağrı sırasında panic → her iki uçta overlay kapanır, track'ler stop (chrome://media-internals veya görev yöneticisi), RAM-only doğrulama: `dist/` içinde `chrome.storage`/`localStorage`/`IndexedDB` grep'i boş.
7. **Yeniden bağlanma:** DataChannel kapanması (B paneli kapat) → `state.call` temizlenir, ses tamponları düşer.

- [ ] **Step 3: kapanış**

Oturum verileri `.superpowers/sdd/2026-08-12-media-support/` altına toplanır; görev raporları `verification-before-completion` kuralıyla doğrulanmadan kapanmaz.

---

## Self-Review (plan bittikten sonra, spec'e karşı)

- **Spec 2 (güvenlik):** verified zorlaması Task 1 (`beginCall`/`acceptIncoming`) → Task 3 (offscreen k:14 rölesi + otomatik reject + `callBlocked`) ve Task 2 (k:13 `sendVoiceMessage` verified şartı) ile karşılandı. PRODUCT.md dürüstlük notu Task 9.
- **Spec 3.1 (dosyalar):** tüm dosyalar görevlere dağıtıldı; `offscreen.html`/`background.js`/`build.cjs`/`codec.js` dokunulmaz (Global Constraints).
- **Spec 3.2 (k:13 akış):** parça gövdesi, 64KB/65ms, bütçe (Task 0) + offscreen akışı (Task 2) + popup blob/oynatıcı (Task 6) ✓.
- **Spec 3.3 (k:14 akış):** `peer.call` YOK; panelde PC (Task 7), offscreen röle (Task 3), `startCall` → `iceServers` dönüşü ✓.
- **Spec 3.4 (durum makinesi):** `state.call` + geçişler (Task 1/3), tek aktif, cleanup/panic/reset (Task 2/3/7) ✓.
- **Spec 3.5 (UI):** composer butonu, fiş, overlay, i18n, video elementleri (Task 4/5/6/7/8) ✓.
- **Spec 4 (YAGNI):** kapsam dışı madde eklenmedi ✓.
- **Spec 5 (test):** `tests/voice.test.mjs` (9) + `tests/call.test.mjs` (12) + manuel checklist (Task 10) ✓.
- **Type tutarlılığı:** `beginCall`/`acceptIncoming`/`markActive`/`clearCall`/`callMatches` aynı imzalar Task 1→3; `splitVoiceParts`/`parseVoicePart`/`VoiceAssembly` Task 0→2; `startVoiceRecorder`/`createCallPeerConnection`/`attachLocalTracks` Task 0→6/7 ✓.
- **Placeholder taraması:** tüm adımlarda gerçek kod; "benzer şekilde/uygun hata" yok ✓.