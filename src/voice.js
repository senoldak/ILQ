/* ILQ voice — sesli mesaj parça protokolü (saf, node:test tarafından da import edilir)
 * + side panel için browser yardımcıları (MediaRecorder, RTCPeerConnection).
 * Önceki katmanlarla uyum: base64url taşıma, chunk JSON gövdesi, 65ms pompa deseni.
 * RAM-only: hiçbir şey diske yazılmaz. */

export const VOICE_CHUNK_SIZE = 64 * 1024;
export const VOICE_MAX_SECONDS = 60;
export const VOICE_MAX_BYTES = 8 * 1024 * 1024; // peer başına alıcı bütçesi
export const VOICE_MAX_PARTS = Math.ceil(VOICE_MAX_BYTES / VOICE_CHUNK_SIZE);

// ---------- base64url (saf-temiz; codec.js'teki desenin kopyası değil, küçük taşıma) ----------
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