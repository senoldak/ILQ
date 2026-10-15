/*
 * ILQ offscreen document — P2P + Signal protokolü burada çalışır.
 * Tüm durum RAM'dedir; hiçbir şey diske yazılmaz (chrome.storage/localStorage/IndexedDB kullanılmaz).
 */
import Peer from 'peerjs';
import {
  KeyHelper,
  SignalProtocolAddress,
  SessionBuilder,
  SessionCipher,
  FingerprintGenerator,
} from '@privacyresearch/libsignal-protocol-typescript';
import { encodeCode, decodeCode } from './codec.js';
import { VoiceAssembly, splitVoiceParts, parseVoicePart } from './voice.js';
import { beginCall, acceptIncoming, markActive, clearCall, callMatches } from './call-state.js';

const DEVICE_ID = 1;
const MAX_TEXT_LENGTH = 4000; // karakter
const MAX_ENVELOPE_LENGTH = 200000; // base64url karakter

const CODE_TTL_MS = 5 * 60 * 1000; // 5 dakika — Paket 3
const RATE_LIMIT_PER_SEC = 20;
const PEER_LIMIT = 3;

// ---------- dosya paylaşımı (Paket 4) ----------
const FILE_MAX_BYTES = 8 * 1024 * 1024;
const FILE_CHUNK_SIZE = 64 * 1024;
const FILE_ALLOWED_MIME = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'audio/', 'video/'];

// ---------- mesaj gövdesi (Paket 1) ----------
const RECALL_WINDOW_MS = 5 * 60 * 1000;

function randomMid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function encodeMessageBody(text, expSeconds) {
  const mid = randomMid();
  const body = { m: mid, t: text, ts: Date.now() };
  if (expSeconds && expSeconds > 0) body.e = expSeconds;
  return { bytes: new TextEncoder().encode(JSON.stringify(body)).buffer, mid };
}

function decodeMessageBody(bytes) {
  const raw = new TextDecoder().decode(bytes);
  try {
    const j = JSON.parse(raw);
    // k:4/k:5 kontrol gövdeleri yalnızca {m:...} taşır; t şartı aranmaz.
    if (j && typeof j.m === 'string') {
      const e = (typeof j.e === 'number') ? j.e : undefined;
      return { mid: j.m, text: typeof j.t === 'string' ? j.t : raw, ts: typeof j.ts === 'number' ? j.ts : 0, e };
    }
  } catch (e) { /* düz metin */ }
  return { mid: randomMid(), text: raw, ts: 0 };
}

// ---------- RAM-only StorageType (asla diske yazmaz) ----------
class RamStore {
  constructor() {
    this.identityKeyPair = undefined;
    this.registrationId = undefined;
    this.trusted = new Map(); // identifier -> pubKey (base64)
    this.denylist = new Set(); // reddedilmiş kimlik anahtarları (base64)
    this.lastRejectedIdentity = null; // { identifier, key } | null
    this.preKeys = new Map(); // keyId -> KeyPair
    this.signedPreKeys = new Map();
    this.sessions = new Map(); // address -> serialized record
  }
  async getIdentityKeyPair() { return this.identityKeyPair; }
  async getLocalRegistrationId() { return this.registrationId; }
  async isTrustedIdentity(identifier, pubKey) {
    const key = arrayBufferToBase64(pubKey);
    if (this.denylist.has(key)) return false;
    const saved = this.trusted.get(identifier);
    if (saved === undefined) return true; // ilk temas
    if (saved === key) return true;
    this.lastRejectedIdentity = { identifier, key, oldKey: saved }; // kimlik değişimi tespiti
    return false;
  }
  async saveIdentity(identifier, pubKey) {
    this.trusted.set(identifier, arrayBufferToBase64(pubKey));
    return true;
  }
  async loadPreKey(id) { return this.preKeys.get(id); }
  async storePreKey(id, kp) { this.preKeys.set(id, kp); }
  async removePreKey(id) { this.preKeys.delete(id); }
  async storeSession(addr, rec) { this.sessions.set(addr, rec); }
  async loadSession(addr) { return this.sessions.get(addr); }
  async removeSession(addr) { this.sessions.delete(addr); }
  async loadSignedPreKey(id) { return this.signedPreKeys.get(id); }
  async storeSignedPreKey(id, kp) { this.signedPreKeys.set(id, kp); }
  async removeSignedPreKey(id) { this.signedPreKeys.delete(id); }
}

// ---------- yardımcılar ----------
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function binaryStringToArrayBuffer(s) {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

// base64url -> standart base64 (padding geri eklenir)
function b64UrlToBase64(s) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return b64;
}

// standart base64 -> base64url (padding atılır)
function base64ToB64Url(s) {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeB64Url(bytes) {
  const bin = String.fromCharCode.apply(null, new Uint8Array(bytes));
  return base64ToB64Url(btoa(bin));
}

// ---------- merkezi durum ----------
const state = {
  peer: null,
  peerId: null, // kullanıcı adı
  store: new RamStore(),
  ready: false,
  peers: new Map(), // karşı kullanıcı adı -> { conn, cipher, initialized, verified }
  preKeyCounter: 10, // bir kullanımda üretilen prekey ID'lerine tekil başlangıç
  pendingCodeExp: null, // üretilen son kodun süresi; k:3 başarısında "kod kullanıldı" tetikler
  rateBuckets: new Map(), // username -> { tokens, last } (gelen mesaj rate-limit)
  contacts: new Map(), // username -> { address, identityKey, verified } (adres defteri — RAM-only, Paket 4)
  files: new Map(), // username -> Map<mid, {...}> (dosya transfer kayıtları — RAM-only, Paket 4)
  theme: 'bone', // tema modu: bone|dark|hc|system (Paket 4; reset/panikte temizlenmez — oturum boyu kalır)
  network: null, // özel sinyal sunucusu / ICE yapılandırması
  voice: new VoiceAssembly(), // k:13 sesli mesaj birleştirme tamponları (RAM-only)
  call: null, // tek aktif çağrı kaydı (Task 3 doldurur)
  decoy: false, // panik modu aktif → decoy ekran (Paket 3)
  _bootPromise: null, // yeniden kurulum sırasında çift initPeer'i önler (Paket 3)
};

async function bootstrapIdentity() {
  if (!state.store.identityKeyPair) {
    state.store.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    state.store.registrationId = KeyHelper.generateRegistrationId();
  }
}

function addressFor(username) {
  return new SignalProtocolAddress(username, DEVICE_ID);
}

// ---------- adres defteri (RAM-only, Paket 4) ----------
function saveContact(username, address, identityKeyB64, verified) {
  state.contacts.set(username, { address, identityKey: identityKeyB64, verified: !!verified });
}
function listContacts() {
  const out = [];
  for (const [username, v] of state.contacts) out.push({ username, address: v.address, verified: v.verified });
  return out;
}
function getContact(username) {
  return state.contacts.get(username);
}

// Tahmin edilemez adres: 32 sembollü alfabe (a-z2-7), crypto.getRandomValues ile.
// 256 % 32 === 0 olduğundan modulo bias yok. 20 karakter ≈ 100 bit entropi.
const ADDR_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const ADDR_LENGTH = 20;

function generateAddress() {
  const bytes = new Uint8Array(ADDR_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < ADDR_LENGTH; i++) {
    out += ADDR_ALPHABET[bytes[i] % 32];
  }
  return out;
}

// ---------- kod (prekey bundle) üretimi / çözümü ----------
// Kod formatı: base64url(JSON dizi) — öneksiz, rastgele görünümlü taşıma.
// Gövde maskeli sabit sıralı dizidir; alan adları taşınmaz.
// Sıra: [u, r, spkId, ik, spk, spkSig, opkId, opk]

async function generateCode() {
  await bootstrapIdentity();

  const spkId = ++state.preKeyCounter;
  const opkId = ++state.preKeyCounter;

  const signed = await KeyHelper.generateSignedPreKey(state.store.identityKeyPair, spkId);
  const oneTime = await KeyHelper.generatePreKey(opkId);
  // Önceki tek kullanımlık prekey'ler geçersiz: yeni kod eski kodu çalışmaz kılar
  state.store.preKeys.clear();
  await state.store.storeSignedPreKey(signed.keyId, signed.keyPair);
  await state.store.storePreKey(oneTime.keyId, oneTime.keyPair);

  const exp = Date.now() + CODE_TTL_MS;
  state.pendingCodeExp = exp;

  return encodeCode({
    u: state.peerId,
    r: state.store.registrationId,
    ik: arrayBufferToBase64(state.store.identityKeyPair.pubKey),
    spkId: signed.keyId,
    spk: arrayBufferToBase64(signed.keyPair.pubKey),
    spkSig: arrayBufferToBase64(signed.signature),
    opkId: oneTime.keyId,
    opk: arrayBufferToBase64(oneTime.keyPair.pubKey),
    exp,
  });
}

function parseCode(code) {
  const p = decodeCode(code);
  if (!p.u || !p.ik || p.spkId === undefined || !p.spk || !p.spkSig || p.opkId === undefined || !p.opk) {
    throw new Error('error.codeIncomplete');
  }
  return p;
}

// ---------- PeerJS ----------
// network: opsiyonel { host, port, path, secure, iceServers: [...] }
// Varsayılan: PeerJS genel bulutu + Google STUN (PeerJS varsayılanı).
function buildPeerOptions(id, network) {
  const opts = {
    debug: 0,
    config: { iceServers: network?.iceServers?.length ? network.iceServers : [] },
  };
  if (network?.host) {
    opts.host = network.host;
    if (network.port) opts.port = network.port;
    if (network.path) opts.path = network.path;
    if (typeof network.secure === 'boolean') opts.secure = network.secure;
    else if (String(network.port) === '443' || opts.port === 443) opts.secure = true;
  }
  return opts;
}

function initPeer(username, network) {
  return new Promise((resolve, reject) => {
    if (state.peer) state.peer.destroy();
    // Kullanıcı adı senin üretilir: tahmin edilebilir ad, iz bırakan bir kusurdur.
    const id = username || generateAddress();
    const peer = new Peer(id, buildPeerOptions(id, network));
    state.peerId = id;
    state.network = network || null;

    peer.on('open', async () => {
      state.peer = peer;
      state.enabled = true;
      await bootstrapIdentity();
      resolve({ ok: true, peerId: peer.id });
    });

    peer.on('error', (err) => {
      if (state.enabled) notify('status', { status: 'error', detail: err.type });
      reject(new Error(err.type === 'unavailable-id' ? 'error.initFailed' : 'error.peerError'));
    });

    peer.on('connection', (conn) => {
      conn.on('data', (data) => handleIncoming(conn, data));
      conn.on('error', (e) => notify('status', { status: 'error', detail: e.type }));
      conn.on('close', () => cleanupConn(conn));
    });
  });
}

// Veri kanalı kapandığında ilgili kayıtları RAM'den temizle; kimliği karalisteye almaz,
// ancak oturumu kapatır ki eski güven belirteci eski anahtarlarla sürmez.
function cleanupConn(conn) {
  for (const [username, entry] of state.peers) {
    if (entry.conn === conn) {
      closePeerEntry(entry);
      state.peers.delete(username);
      state.voice.clear(username); // k:13 parça tamponları (RAM-only)
      endCallForPeer(username); // veri kanalı kapanınca çağrı da biter
      notify('status', { status: 'closed', detail: username });
    }
  }
}

// Paket 3: tek seferlik mesaj/sohbet süresi setTimeout'larını peer kaydına bağla;
// kayıt kapanınca hepsi iptal edilir (panik/sıfırlama sonrası stale 'expired' basmasın).
function trackExpiryTimer(entry, timerId) {
  if (!entry) return;
  if (!entry._expiryTimers) entry._expiryTimers = [];
  entry._expiryTimers.push(timerId);
}

// Peer kaydı yok edilirken tüm zamanlayıcılarını temizle: k:11 sohbet interval'i ve
// bekleyen mesaj süresi setTimeout'ları (Paket 3 — 1 Hz interval sızıntısı + stale expire).
function closePeerEntry(entry) {
  if (!entry) return;
  if (entry._chatTimer) { clearInterval(entry._chatTimer); entry._chatTimer = null; }
  if (entry._expiryTimers) {
    for (const t of entry._expiryTimers) clearTimeout(t);
    entry._expiryTimers.length = 0;
  }
}

// ---------- mesaj gönderimi ----------
function sendEnvelope(conn, type, body, registrationId) {
  const envelope = {
    t: 'ilq',
    v: 1,
    k: type, // 1 = WhisperMessage, 3 = PreKeyWhisperMessage
    m: base64ToB64Url(btoa(body)),
    r: registrationId,
  };
  conn.send(envelope);
}

async function sendMessageTo(username, text, expSeconds) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) throw new Error('error.noConnection');
  if (!entry.verified) throw new Error('error.notVerified');
  if (typeof text !== 'string' || text.length === 0) throw new Error('error.emptyMessage');
  if (text.length > MAX_TEXT_LENGTH) throw new Error('error.messageTooLong');
  const { bytes, mid } = encodeMessageBody(text, expSeconds);
  const buffer = bytes;
  const result = await entry.cipher.encrypt(buffer);
  const conn = entry.conn;
  if (!conn || !conn.open) throw new Error('error.channelClosed');
  sendEnvelope(conn, result.type, result.body, result.registrationId);
  setRecallWindow(username, mid);
  // Paket 3: süreli mesajlarda gönderenin kendi balonu da süresi gelince düşer
  if (expSeconds && expSeconds > 0) {
    trackExpiryTimer(entry, setTimeout(() => {
      notify('expired', { mid, from: username });
    }, expSeconds * 1000));
  }
  // Paket 3: sohbet düzeyi yok etme — gönderenin balonu da entry.timer kuralıyla düşer
  if (entry.timer && entry.timer > 0) {
    trackExpiryTimer(entry, setTimeout(() => {
      notify('expired', { mid, from: username });
    }, entry.timer * 1000));
  }
  return { ok: true, mid };
}

function setRecallWindow(username, mid) {
  const entry = state.peers.get(username);
  if (!entry) return;
  if (!entry.outbox) entry.outbox = new Map();
  entry.outbox.set(mid, { ts: Date.now(), sent: true, delivered: false, read: false });
}

async function recallMessage(username, mid) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) throw new Error('error.noConnection');
  if (!entry.verified) throw new Error('error.notVerified');
  if (!entry.outbox || !entry.outbox.has(mid)) throw new Error('error.recallUnauthorized');
  const rec = entry.outbox.get(mid);
  if (Date.now() - rec.ts > RECALL_WINDOW_MS) throw new Error('error.recallExpired');
  const conn = entry.conn;
  if (!conn || !conn.open) throw new Error('error.channelClosed');
  const bytes = new TextEncoder().encode(JSON.stringify({ m: mid })).buffer;
  const result = await entry.cipher.encrypt(bytes);
  sendEnvelope(conn, 4, result.body, result.registrationId);
  return { ok: true };
}

// Paket 3: sohbet düzeyi otomatik yok etme süresi — her iki tarafa k:11 ile şifreli gönder
async function setChatTimer(username, seconds) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher || !entry.conn || !entry.conn.open) return { ok: false, error: 'mesaj gönderilemez' };
  const body = JSON.stringify({ s: seconds });
  const result = await entry.cipher.encrypt(new TextEncoder().encode(body).buffer);
  sendEnvelope(entry.conn, 11, result.body, result.registrationId);
  entry.timer = seconds;
  return { ok: true };
}

// ---------- bağlantı (kodu giren taraf: initiator) ----------
async function connectWithCode(codeHidden) {
  const parsed = parseCode(codeHidden);
  if (parsed.exp !== undefined && Date.now() > parsed.exp) {
    throw new Error('error.codeExpired');
  }
  await bootstrapIdentity();

  const device = {
    registrationId: parsed.r,
    identityKey: base64ToArrayBuffer(parsed.ik),
    signedPreKey: {
      keyId: parsed.spkId,
      publicKey: base64ToArrayBuffer(parsed.spk),
      signature: base64ToArrayBuffer(parsed.spkSig),
    },
    preKey: {
      keyId: parsed.opkId,
      publicKey: base64ToArrayBuffer(parsed.opk),
    },
  };

  const remoteUsername = parsed.u;
  const builder = new SessionBuilder(state.store, addressFor(remoteUsername));
  try {
    await builder.processPreKey(device);
  } catch (e) {
    if (/Identity key changed|Unknown identity key/.test(e.message)) {
      const gen = new FingerprintGenerator(5200);
      const fp = await gen.createFor(
        state.peerId,
        state.store.identityKeyPair.pubKey,
        remoteUsername,
        base64ToArrayBuffer(parsed.ik)
      );
      notify('fingerprint', { username: remoteUsername, fingerprint: fp, reason: 'changed' });
      throw new Error('error.identityChanged');
    }
    throw e;
  }

  const cipher = new SessionCipher(state.store, addressFor(remoteUsername));

  // PeerJS bağlantısı kur
  const conn = state.peer.connect(remoteUsername, { reliable: true });

  const entry = { conn, cipher, initialized: false, verified: false };
  state.peers.set(remoteUsername, entry);
  conn.on('data', (data) => handleIncoming(conn, data));
  conn.on('close', () => cleanupConn(conn));

  // Initiator tarafında remote identity key kod üzerinden biliniyor
  entry.remoteIdentityKey = base64ToArrayBuffer(parsed.ik);

  await new Promise((resolve, reject) => {
    conn.on('open', () => resolve());
    conn.on('error', (e) => reject(new Error(e.type)));
  });

  // İlk mesaj (PreKeyWhisperMessage) gönder → oturumu başlat
  const greeting = new TextEncoder().encode('__ilq_init__').buffer;
  const first = await cipher.encrypt(greeting);
  sendEnvelope(conn, first.type, first.body, first.registrationId);
  entry.initialized = true;
  await maybeIntroduce(remoteUsername, entry);
  // Paket 4: bağlantı başarılı → adres defterine otomatik kayıt (verified=false; onay verifyFingerprint'te)
  saveContact(remoteUsername, remoteUsername, entry.remoteIdentityKey, false);
  notify('connected', { username: remoteUsername, peer: parsed.u });
  return { ok: true, peer: parsed.u };
}

// Paket 4: adres defterinden bilinen eşe kod/prekey olmadan doğrudan bağlan.
// Session store'da oturum zaten var (RAM); PeerJS bağlantısı yeniden kurulur.
function connectToKnown(username) {
  const c = getContact(username);
  const entry = state.peers.get(username) || { conn: null, cipher: null, initialized: false, verified: false };
  // Reconnect'ta verified rozetini defterden taşı — aksi halde doğrulanmış eş "yeni" görünür
  // ve sendMessageTo "doğrulanana kadar gönderilemez" hatasına takılır.
  entry.verified = !!(c && c.verified);
  const conn = state.peer.connect(username, { reliable: true });
  entry.conn = conn;
  entry.cipher = new SessionCipher(state.store, addressFor(username));
  state.peers.set(username, entry);
  conn.on('error', (e) => notify('status', { status: 'error', detail: e.type }));
  conn.on('data', (data) => handleIncoming(conn, data));
  conn.on('close', () => cleanupConn(conn));
  entry.remoteIdentityKey = (c || {}).identityKey;
  conn.on('open', () => {
    notify('connected', { username, peer: username });
  });
  return { ok: true, peer: username };
}

async function reconnectContact(username) {
  const c = getContact(username);
  if (!c) return { ok: false, error: 'error.noConnection' };
  const existing = state.peers.get(username);
  if (existing && existing.conn && existing.conn.open) return { ok: true, peer: username };
  if (!state.peer || !state.enabled) await initPeer(undefined, state.network);
  return connectToKnown(username);
}

// Gelen mesaj rate-limit (token bucket): 20 msg/sn kullanıcı başına
function checkRate(username) {
  const now = Date.now();
  const sec = 1000;
  let b = state.rateBuckets.get(username);
  if (!b) {
    b = { tokens: RATE_LIMIT_PER_SEC, last: now };
    state.rateBuckets.set(username, b);
  }
  b.tokens = Math.min(RATE_LIMIT_PER_SEC, b.tokens + ((now - b.last) / sec) * RATE_LIMIT_PER_SEC);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// ---------- gelen mesajlar (kod üreten taraf: responder) ----------
// Paket 3: süreli mesaj (e) alıcı ekranından da zamanı gelince düşer
function scheduleMessageExpiry(decoded, entry, remoteUsername) {
  if (decoded.e && decoded.ts) {
    const delay = Math.max(0, (decoded.ts + decoded.e * 1000) - Date.now());
    trackExpiryTimer(entry, setTimeout(() => {
      notify('expired', { mid: decoded.mid, from: remoteUsername });
    }, delay));
  }
}

// Paket 3: sohbet düzeyi zamanlayıcı (k:11) — yalnızca işaret üretir; balonlar UI'da
// 'expired' event'iyle düşer. Süre değişince eski interval iptal edilir; teslim edilmiş
// mesajların tek seferlik zamanlayıcıları ise olduğu gibi bırakılır (basit tutulur).
function scheduleChatExpiry(username, entry) {
  const sec = entry.timer;
  if (entry._chatTimer) clearInterval(entry._chatTimer);
  if (sec <= 0) return;
  entry._chatTimer = setInterval(() => {
    notify('chatTimerTick', { username });
  }, 1000);
}

// Her teslim edilen mesaj için tek seferlik kur: ts + timer saniye sonra 'expired'
function scheduleChatExpiryForMessage(decoded, entry, remoteUsername) {
  if (entry.timer && entry.timer > 0 && decoded.ts) {
    const delay = Math.max(0, (decoded.ts + entry.timer * 1000) - Date.now());
    trackExpiryTimer(entry, setTimeout(() => {
      notify('expired', { mid: decoded.mid, from: remoteUsername });
    }, delay));
  }
}

// Paket 4: alıcı, normal mesaj çözüldükten sonra k:6 teslimat onayı (ack) yollar.
// Fire-and-forget: ack gönderilemezse gönderenin rozeti ✓ kalır (sessiz hata).
function sendDeliveredAck(entry, conn, mid) {
  try {
    entry.cipher.encrypt(new TextEncoder().encode(JSON.stringify({ m: mid })).buffer)
      .then((r) => { sendEnvelope(conn, 6, r.body, r.registrationId); })
      .catch(() => { /* sessiz — ack gönderilemezse rozet ✓ kalır */ });
  } catch (_) { /* sessiz */ }
}

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

// ---------- dosya paylaşımı (Paket 4, k:7/8/9/10) ----------
// state.files[username] = Map<mid, {...}>; sender kaydı { name, type, size, parts, bytes, state },
// alıcı kaydı { name, type, size, parts, received, chunks } (case 7) — birleşim sorun değil,
// toparlama yalnızca alıcı alanlarını okur.
function filesFor(username) {
  if (!state.files.has(username)) state.files.set(username, new Map());
  return state.files.get(username);
}

// Paket 4 takip: bir eş için şu an tamponda tutulan çözülmüş bayt toplamı (yalnızca alıcı kayıtları,
// gönderen kayıtlarında chunks yoktur). k:9 kabulü öncesi peer başına 16MB bütçe kontrolünde kullanılır.
function filesBytesFor(username) {
  const recs = state.files.get(username);
  if (!recs) return 0;
  let total = 0;
  for (const st of recs.values()) {
    if (st && Array.isArray(st.chunks)) {
      for (const ch of st.chunks) if (ch) total += ch.length;
    }
  }
  return total;
}

function sendFileOffer(username, name, mime, bytes) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) return { ok: false, error: 'error.noConnection' };
  if (!bytes || bytes.byteLength === 0) return { ok: false, error: 'error.emptyFile' };
  if (bytes.byteLength > FILE_MAX_BYTES) return { ok: false, error: 'error.fileTooLarge' };
  const typeOk = FILE_ALLOWED_MIME.some((p) => String(mime || '').toLowerCase().startsWith(p));
  if (!typeOk) return { ok: false, error: 'error.fileTypeForbidden' };
  const mid = randomMid();
  const parts = Math.ceil(bytes.byteLength / FILE_CHUNK_SIZE);
  const offer = JSON.stringify({ m: mid, name, size: bytes.byteLength, type: mime, parts });
  entry.cipher.encrypt(new TextEncoder().encode(offer).buffer)
    .then((r) => {
      try { sendEnvelope(entry.conn, 7, r.body, r.registrationId); } catch (_) {}
    })
    .catch(() => { /* sessiz */ });
  filesFor(username).set(mid, { name, type: mime, size: bytes.byteLength, parts, bytes, state: 'offer' });
  return { ok: true, mid };
}

// Controller ruling (2026-08-11): pompa aralığı 20ms -> 65ms. handleIncoming 20 msg/sn token-bucket
// rate limit'i her envelope'a uygular; 50/s akış parçaları düşürürdü. 65ms ~15 parça/sn, kova içinde,
// sohbet (k:1/3) ile paylaşılan kova için de pay bırakır. checkRate'e dokunulmaz.
function sendFileChunks(username, mid) {
  const entry = state.peers.get(username);
  const f = filesFor(username).get(mid);
  if (!entry || !f) return { ok: false, error: 'error.fileNotFound' };
  const total = f.parts;
  if (!total) return { ok: false, error: 'error.emptyFile' };
  let idx = 0;
  const pump = () => {
    if (idx >= total) { sendFileDone(entry, username, mid); return; }
    const start = idx * FILE_CHUNK_SIZE;
    const slice = f.bytes.slice(start, Math.min(start + FILE_CHUNK_SIZE, f.size));
    const chunk = JSON.stringify({ m: mid, idx, total, bytes: arrayBufferToBase64(slice) });
    entry.cipher.encrypt(new TextEncoder().encode(chunk).buffer)
      .then((r) => {
        try { sendEnvelope(entry.conn, 9, r.body, r.registrationId); } catch (_) { return; }
        notify('fileProgress', { username, mid, idx, total });
        idx++;
        setTimeout(pump, 65);
      })
      .catch(() => { /* sessiz — kanal kapalıysa gönderim durur */ });
  };
  pump();
}

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

function sendFileDone(entry, username, mid) {
  entry.cipher.encrypt(new TextEncoder().encode(JSON.stringify({ m: mid })).buffer)
    .then((r) => {
      try { sendEnvelope(entry.conn, 10, r.body, r.registrationId); } catch (_) {}
    })
    .catch(() => { /* sessiz */ });
  notify('fileSent', { username, mid });
  // Paket 4 takip: tüm parçalar enqueue edildi — staged kayıt tam bytes'ı tutar, artık RAM'de gerek yok.
  // sendFileChunks pompası son tick'ten sonra buraya düşer; delete sonrası f erişimi kalmaz (idx>=total).
  filesFor(username).delete(mid);
}

// Alıcı onayı/reddi: k:8 gönderen tarafına gider (case 8). Reddedilirse alıcı kendi yerel
// kaydını (case 7) da temizler; gönderen tarafı case 8 else'inde kendi bekleyen kaydını siler.
function acceptFileTransfer(username, mid, accept) {
  const entry = state.peers.get(username);
  if (!entry || !entry.cipher) return { ok: false, error: 'error.noConnection' };
  const body = JSON.stringify({ m: mid, accept: !!accept });
  entry.cipher.encrypt(new TextEncoder().encode(body).buffer)
    .then((r) => {
      try { sendEnvelope(entry.conn, 8, r.body, r.registrationId); } catch (_) {}
    })
    .catch(() => { /* sessiz */ });
  if (!accept) filesFor(username).delete(mid);
  return { ok: true };
}

async function handleIncoming(conn, data) {
  try {
    const envelope = data;
    if (!envelope || envelope.t !== 'ilq') return;

    // Zarfı doğrula: alan tipleri ve boyut sınırı (dev girdi/DoS koruması)
    if (typeof envelope.m !== 'string' || envelope.m.length === 0 || envelope.m.length > MAX_ENVELOPE_LENGTH) return;
    if (![1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(envelope.k)) return; // bilinmeyen zarf türü: sessiz at (Paket 1 posture)

    const remoteUsername = conn.peer;

    // Peer sınırı: yeni peer yalnızca kapasite varken kabul edilir
    if (!state.peers.has(remoteUsername) && state.peers.size >= PEER_LIMIT) {
      notify('error', { message: 'error.peerLimit' });
      return;
    }

    // Rate-limit: token yoksa envelope sessizce atılır (bağlantı kapanmaz)
    if (!checkRate(remoteUsername)) {
      const existing = state.peers.get(remoteUsername);
      if (existing && !existing.rateLimitNotified) {
        existing.rateLimitNotified = true;
        notify('rateLimited', { username: remoteUsername });
      }
      return;
    }

    if (!state.peers.has(remoteUsername)) {
      state.peers.set(remoteUsername, { conn, cipher: null, initialized: false, verified: false });
    }
    const entry = state.peers.get(remoteUsername);
    if (!entry.conn) entry.conn = conn;

    const body = atob(b64UrlToBase64(envelope.m));
    if (body.length > MAX_ENVELOPE_LENGTH) return;

    if (envelope.k === 3) {
      // PreKeyWhisperMessage → oturum kur
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      let plain;
      try {
        plain = await entry.cipher.decryptPreKeyWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      } catch (e) {
        if (state.store.lastRejectedIdentity && state.store.lastRejectedIdentity.identifier === remoteUsername) {
          await notifyIdentityChanged(remoteUsername, state.store.lastRejectedIdentity.key);
          return;
        }
        throw e;
      }
      // processV3 isTrustedIdentity çağrısı await edilmeden Promise döner; kütüphane asla
      // "Unknown identity key" atmaz. Reddedilen kimlik sinyali lastRejectedIdentity'de saklanır.
      if (state.store.lastRejectedIdentity && state.store.lastRejectedIdentity.identifier === remoteUsername) {
        const rej = state.store.lastRejectedIdentity;
        if (rej.oldKey) {
          // processV3 saveIdentity poisoning'ini geri al: henüz karar verilmediyse eski (güvenilen) anahtar geri yüklenir
          await state.store.saveIdentity(remoteUsername, base64ToArrayBuffer(rej.oldKey));
        }
        await notifyIdentityChanged(remoteUsername, rej.key);
        if (entry) { entry.cipher = null; entry.initialized = false; entry.verified = false; }
        return;
      }
      entry.initialized = true;
      await maybeIntroduce(remoteUsername, entry);
      const decoded = decodeMessageBody(plain);
      const text = decoded.text;
      if (text !== '__ilq_init__') {
        notify('message', { from: remoteUsername, text, encrypted: true, mid: decoded.mid, ts: decoded.ts });
        sendDeliveredAck(entry, conn, decoded.mid);
      } else {
        notify('connected', { username: remoteUsername, peer: remoteUsername });
      }
      scheduleMessageExpiry(decoded, entry, remoteUsername);
      scheduleChatExpiryForMessage(decoded, entry, remoteUsername);
      // Kod üreten taraf: kodu kullanılan kod artık ekrandan silinir (P7)
      if (state.pendingCodeExp) {
        state.pendingCodeExp = null;
        notify('codeUsed', { username: remoteUsername });
      }
    } else if (envelope.k === 1) {
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      let plain;
      try {
        plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      } catch (e) {
        if (state.store.lastRejectedIdentity && state.store.lastRejectedIdentity.identifier === remoteUsername) {
          await notifyIdentityChanged(remoteUsername, state.store.lastRejectedIdentity.key);
          return;
        }
        throw e;
      }
      const decoded = decodeMessageBody(plain);
      const text = decoded.text;
      await maybeIntroduce(remoteUsername, entry);
      // Paket 6: "yazıyor…" sinyali k:1 gövdesi {m:'typing', t:'', ts:0} ile gelir; normal mesaj
      // işlemeye (k:6 teslimat ack + zamanlayıcılar) sokulmadan yalnız bildirim yükseltilir.
      if (decoded.mid === 'typing') {
        notify('typing', { from: remoteUsername });
        return;
      }
      if (text !== '__ilq_init__') {
        notify('message', { from: remoteUsername, text, encrypted: true, mid: decoded.mid, ts: decoded.ts });
        sendDeliveredAck(entry, conn, decoded.mid);
      }
      scheduleMessageExpiry(decoded, entry, remoteUsername);
      scheduleChatExpiryForMessage(decoded, entry, remoteUsername);
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
    } else if (envelope.k === 6) {
      // Teslimat onayı (k:6): alıcı decrypt edince gönderenin outbox kaydı delivered olur.
      // Bilinmeyen mid ise sessizce atlanır (Paket 4 spec).
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      const ackCtl = decodeMessageBody(plain);
      const ackEntry = state.peers.get(remoteUsername);
      if (ackEntry && ackEntry.outbox && ackEntry.outbox.has(ackCtl.mid)) {
        ackEntry.outbox.get(ackCtl.mid).delivered = true;
        notify('delivered', { username: remoteUsername, mid: ackCtl.mid });
      }
    } else if (envelope.k === 7) {
      // Dosya teklifi (alıcı): kayıt oluştur, UI'da teklif kartı
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      let o;
      try { o = JSON.parse(new TextDecoder().decode(plain)); } catch (_) { return; }
      if (!o || typeof o.m !== 'string' || typeof o.name !== 'string') return;
      const rec = filesFor(remoteUsername);
      rec.set(o.m, { name: o.name, type: o.type, size: o.size, parts: o.parts, received: 0, chunks: [] });
      notify('fileOffer', { from: remoteUsername, mid: o.m, name: o.name, size: o.size, type: o.type, parts: o.parts });
    } else if (envelope.k === 8) {
      // Onay/red — gönderen tarafında çalışır (alıcı k:8'i sendFileOffer tarafına yollar)
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      let a;
      try { a = JSON.parse(new TextDecoder().decode(plain)); } catch (_) { return; }
      if (!a || typeof a.m !== 'string') return;
      if (a.accept) {
        sendFileChunks(remoteUsername, a.m);
      } else {
        // Alıcı reddetti: gönderenin bekleyen kaydı (case 7 karşılığı) temizlenir
        filesFor(remoteUsername).delete(a.m);
        notify('fileDeclined', { username: remoteUsername, mid: a.m });
      }
    } else if (envelope.k === 9) {
      // Dosya parçası (alıcı): parçaları birleştir; tümü gelince k:10 alıcı tarafı tetiklenmez,
      // gönderen sendFileDone ile k:10'u kendisi yollar. Burada yalnızca complete bildirimi.
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      let c;
      try { c = JSON.parse(new TextDecoder().decode(plain)); } catch (_) { return; }
      if (!c || typeof c.m !== 'string' || typeof c.bytes !== 'string') return;
      // Sınır doğrulaması: idx/total tamsayı ve 1..128 parça (FILE_MAX_BYTES / FILE_CHUNK_SIZE).
      // Uygunsuz parça sessizce düşürülür (notify yok).
      const MAX_PARTS = Math.ceil(FILE_MAX_BYTES / FILE_CHUNK_SIZE);
      if (typeof c.total !== 'number' || c.total < 1 || c.total > MAX_PARTS) return;
      if (!Number.isInteger(c.idx) || c.idx < 0 || c.idx >= c.total) return;
      const rec = filesFor(remoteUsername);
      let st = rec.get(c.m);
      // Brief-mandated !st dalı korunur ve sertleştirilir: teklif kaydı yoksa (ör. yeniden bağlanma)
      // total ilk parçadan alınır; teklif kaydı varsa parça total'i teklif parts'ıyla uyuşmalı.
      if (!st) {
        st = { name: undefined, type: undefined, received: 0, chunks: [], parts: c.total, complete: false };
        rec.set(c.m, st);
      } else if (typeof st.parts === 'number' && st.parts !== c.total) {
        return; // teklif edilen parts ile uyumsuz parça → sessiz at
      }
      if (st.complete) return; // çift tamamlama koruması
      let chunkBytes;
      try { chunkBytes = new Uint8Array(base64ToArrayBuffer(c.bytes)); } catch (_) { return; }
      if (!chunkBytes.byteLength) return; // boş parça → sessiz at
      // Peer başına tampon bütçesi: kabul edilecek çözülmüş bayt toplamı 16MB'ı aşarsa parça sessizce düşer.
      if (filesBytesFor(remoteUsername) + chunkBytes.byteLength > FILE_MAX_BYTES * 2) return;
      st.chunks[c.idx] = chunkBytes;
      st.received++;
      notify('fileProgress', { username: remoteUsername, mid: c.m, idx: c.idx, total: c.total });
      if (st.received >= c.total) {
        // Boşluklara (sıra dışı parça) karşı filter(Boolean); WebRTC ordered/reliable ama güvence.
        const partsArr = st.chunks.filter(Boolean);
        const totalBytes = partsArr.reduce((a, ch) => a + ch.length, 0);
        const full = new Uint8Array(totalBytes);
        let off = 0;
        for (const ch of partsArr) { full.set(ch, off); off += ch.length; }
        st.complete = true;
        st.bytes = full.buffer;
        // st.name/type: case 7 kaydı varsa taşır (7→9 akışı); teklifsiz parça akışında boş kalır
        notify('fileComplete', { username: remoteUsername, mid: c.m, name: st.name, type: st.type, bytes: full.buffer });
        // Paket 4 takip: tamamlanan alıcı kaydı (chunks + st.bytes kopyası) RAM'den düşer.
        // k:10/fileAck akışı kayda bağımlı değildir — case 10 yalnızca bildirir.
        filesFor(remoteUsername).delete(c.m);
      }
    } else if (envelope.k === 10) {
      // Gönderen tüm parçaları bitirdi son k:10'u yollar → alıcıda onay notu
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      let mid;
      try { mid = JSON.parse(new TextDecoder().decode(plain)).m; } catch (_) { return; }
      if (typeof mid !== 'string') return;
      notify('fileAck', { username: remoteUsername, mid });
    } else if (envelope.k === 11) {
      // Sohbet düzeyi zamanlayıcı senkronu: gövde JSON { s: saniye } — oturum kurulu
      // olduğundan WhisperMessage olarak gelir (k:4/k:5 ile aynı çözüm yolu).
      if (!entry.cipher) entry.cipher = new SessionCipher(state.store, addressFor(remoteUsername));
      const plain = await entry.cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
      try {
        const ctrl = JSON.parse(new TextDecoder().decode(plain));
        entry.timer = typeof ctrl.s === 'number' ? ctrl.s : 0;
        if (entry.timer > 0) scheduleChatExpiry(remoteUsername, entry);
        notify('chatTimer', { username: remoteUsername, seconds: entry.timer });
      } catch (_) { /* sessiz */ }
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
  } catch (e) {
    notify('error', { message: 'error.decryptFailed' });
  }
}

// Oturum kurulunca fingerprint / safety number'i popup'a bildir
async function maybeIntroduce(username, entry) {
  if (entry.fingerprintNotified) return;
  try {
    const localPub = state.store.identityKeyPair.pubKey;
    const gen = new FingerprintGenerator(5200);
    const localId = state.peerId;
    const remoteId = username;
    // remote identity key'i oturumdan al
    const rec = await state.store.loadSession(addressFor(username).toString());
    const remotePub = entry.remoteIdentityKey || (await loadRemoteIdentity(rec, username));
    const fp = await gen.createFor(localId, localPub, remoteId, remotePub);
    entry.fingerprintNotified = true;
    notify('fingerprint', { username, fingerprint: fp });
  } catch (e) {
    /* fingerprint hesaplanamadıysa sessiz geç */
  }
}

// Kimlik değişimi uyarısı: fingerprint'i yeni (reddedilen) anahtardan hesaplayıp popup'a gönder
async function notifyIdentityChanged(username, newKeyB64) {
  try {
    const gen = new FingerprintGenerator(5200);
    const fp = await gen.createFor(state.peerId, state.store.identityKeyPair.pubKey, username, base64ToArrayBuffer(newKeyB64));
    notify('fingerprint', { username, fingerprint: fp, reason: 'changed' });
  } catch (e) { /* fingerprint hesaplanamadıysa sessiz */ }
}

// Oturum kaydından remote identity key'i ayıkla (indexInfo.remoteIdentityKey)
// SessionRecord serialize edilmiş JSON'dan; daha sağlam yol: cipher.getRecord → session
async function loadRemoteIdentity(_rec, _username) {
  // Cipher üzerinden açık oturumu çekmeyi dene
  const entry = state.peers.get(_username);
  if (entry && entry.cipher) {
    const record = await entry.cipher.getRecord(addressFor(_username).toString());
    if (record) {
      const s = record.getOpenSession();
      if (s && s.indexInfo && s.indexInfo.remoteIdentityKey) {
        const key = s.indexInfo.remoteIdentityKey;
        entry.remoteIdentityKey = key;
        return key;
      }
    }
  }
  throw new Error('remote identity unavailable');
}

// ---------- güvenlik numarası doğrulama / reddetme ----------
// Kullanıcı "Numaralar eşleşiyor" derse: oturum doğrulanmış sayılır, mesaj gönderilebilir.
async function verifyFingerprint(username) {
  const entry = state.peers.get(username);
  if (!entry || !entry.conn) throw new Error('error.noConnection');
  entry.verified = true;
  // Paket 4: parmak izi onaylandı → adres defterindeki kayıt "doğrulanmış" olur
  if (state.contacts.has(username)) state.contacts.get(username).verified = true;
  notify('status', { status: 'verified', detail: username });
  return { ok: true, peer: username };
}

// Kullanıcı "Eşleşmiyor" derse: bağlantıyı sonlandır, oturum ve kayıtları sil.
async function rejectFingerprint(username) {
  const entry = state.peers.get(username);
  // Kimlik değişimi reddinde yeni anahtarı kalıcı engelle
  const rej = state.store.lastRejectedIdentity;
  if (rej && rej.identifier === username && rej.key) {
    state.store.denylist.add(rej.key);
    state.store.lastRejectedIdentity = null;
  } else if (entry && entry.remoteIdentityKey) {
    state.store.denylist.add(arrayBufferToBase64(entry.remoteIdentityKey));
  }
  if (entry) {
    closePeerEntry(entry);
    if (entry.conn) {
      try { entry.conn.close(); } catch (e) {}
    }
    state.peers.delete(username);
  }
  try { await state.store.removeSession(addressFor(username).toString()); } catch (e) {}
  notify('status', { status: 'rejected', detail: username });
  return { ok: true, peer: username, rejected: true };
}

// Kullanıcı "Numaralar eşleşiyor" derse (kimlik değişimi): yeni anahtarı güvenilir say
async function acceptNewIdentity(username) {
  const rej = state.store.lastRejectedIdentity;
  if (!rej || rej.identifier !== username || !rej.key) {
    throw new Error('error.noPendingIdentity');
  }
  await state.store.saveIdentity(username, base64ToArrayBuffer(rej.key));
  state.store.lastRejectedIdentity = null;
  const entry = state.peers.get(username);
  if (entry) {
    entry.cipher = null;
    entry.initialized = false;
    entry.verified = false;
  }
  notify('status', { status: 'accepted', detail: username });
  return { ok: true, peer: username };
}

// Panik/sıfırlama ortak yeniden kurulum yolu (Paket 3):
// - Bir yeniden kurulum sürerken ikinci initPeer başlatmaz (devam eden promise'i döndürür).
// - initPeer hatası notify('status', {status:'error'}) ile görünür kılınır; unhandled rejection olmaz.
function rebootPeer() {
  if (state._bootPromise) return state._bootPromise;
  state._bootPromise = bootstrapIdentity()
    .then(() => initPeer(undefined, state.network))
    .catch((e) => {
      notify('status', { status: 'error', detail: 'Yeniden kurulum hatası: ' + e.message });
      return null;
    })
    .finally(() => { state._bootPromise = null; });
  return state._bootPromise;
}

async function resetIdentity() {
  // Her zaman temiz durum dönüşü: panik (decoy) bayrağı ve bekleyen kod süresi sıfırlanır
  state.decoy = false;
  state.pendingCodeExp = null;
  // Tüm mevcut bağlantıları ve zamanlayıcılarını kapat
  for (const [username, entry] of state.peers) {
    closePeerEntry(entry);
    if (entry.conn) { try { entry.conn.close(); } catch (e) {} }
  }
  state.peers.clear();
  // Yeni RAM store: anahtarlar, oturumlar, prekeyler, güven kayıtları hepsi sıfırlanır
  state.store = new RamStore();
  state.preKeyCounter = 10;
  state.contacts.clear(); // Paket 4: kimlik sıfırlanınca adres defteri de temizlenir
  state.files.clear(); // Paket 4: bekleyen dosya transfer kayıtları da RAM'den düşer
  state.voice.clearAll(); // bekleyen ses parçaları da RAM'den düşer
  if (state.call) { const { callId } = state.call; state.call = null; notify('callEnded', { callId }); }
  // Yeni anahtar çifti + yeni adresle peer yeniden kurulur
  const result = await rebootPeer();
  if (!result || !result.ok) return { ok: false, error: 'error.resetFailed' };
  notify('reset', { peerId: result.peerId });
  return { ok: true, peerId: result.peerId };
}

function resetAll() {
  for (const [, entry] of state.peers) closePeerEntry(entry);
  state.peers.clear();
  state.store = new RamStore();
  state.preKeyCounter = 10;
  state.decoy = true;
  state.pendingCodeExp = null;
  state.rateBuckets.clear();
  state.contacts.clear(); // Paket 4: panik/sıfırlama adres defterini de temizler
  state.files.clear(); // Paket 4: panik/sıfırlama dosya transfer kayıtlarını da siler
  state.voice.clearAll();
  if (state.call) { const { callId } = state.call; state.call = null; notify('callEnded', { callId }); }
  if (state.peer) { try { state.peer.destroy(); } catch (_) {} state.peer = null; }
  // fire-and-forget: hata bildirimi + çift initPeer koruması rebootPeer içinde
  rebootPeer();
  notify('panic', {});
  return { ok: true };
}

// ---------- olay bildirimi (background üzerinden popup'a) ----------
function notify(ev, payload) {
  try {
    chrome.runtime.sendMessage({ hop: 'offscreen->bg', ev, payload });
  } catch (e) {}
}

// ---------- message handling ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.hop !== 'bg->offscreen') return false;

  (async () => {
    try {
      switch (msg.action) {
        case 'initPeer':
          return { ok: true, ...(await initPeer(msg.username, msg.network)) };
        case 'generateCode': {
          const code = await generateCode();
          return { ok: true, code, exp: state.pendingCodeExp, peerId: state.peerId };
        }
        case 'connectCode':
          return await connectWithCode(msg.code);
        case 'sendMessage':
          return await sendMessageTo(msg.username, msg.text);
        case 'sendMessageTimed':
          return await sendMessageTo(msg.username, msg.text, msg.expSeconds);
        case 'recallMessage':
          return await recallMessage(msg.username, msg.mid);
        case 'setChatTimer':
          return await setChatTimer(msg.username, msg.seconds);
        case 'sendTyping': {
          // Paket 6: "yazıyor…" sinyali — k:1'de özel {m:'typing',t:'',ts:0} gövdesi.
          // Fire-and-forget: oturum hazır değilse (parked PreKey) sessizce düşer.
          const entry = state.peers.get(msg.username);
          if (entry && entry.cipher && entry.conn && entry.conn.open) {
            try {
              entry.cipher.encrypt(new TextEncoder().encode(JSON.stringify({ m: 'typing', t: '', ts: 0 })).buffer)
                .then((r) => { sendEnvelope(entry.conn, 1, r.body, r.registrationId); })
                .catch(() => { /* sessiz */ });
            } catch (_) { /* sessiz */ }
          }
          return { ok: true };
        }
        case 'sendRead':
          return sendRead(msg.username, msg.mid);
        case 'verifyFingerprint':
          return await verifyFingerprint(msg.username);
        case 'rejectFingerprint':
          return await rejectFingerprint(msg.username);
        case 'acceptNewIdentity':
          return await acceptNewIdentity(msg.username);
        case 'resetIdentity':
          return await resetIdentity();
        case 'panic':
          return resetAll();
        case 'status':
          return { ok: true, peerId: state.peerId, ready: !!state.peer, decoy: !!state.decoy, sessions: [...state.peers.keys()], theme: state.theme || 'bone' };
        case 'listContacts':
          return { ok: true, contacts: listContacts() };
        case 'saveContact':
          saveContact(msg.username, msg.address, msg.identityKey, false);
          return { ok: true };
        case 'reconnectContact':
          return await reconnectContact(msg.username);
        case 'sendFileOffer':
          return await sendFileOffer(msg.username, msg.name, msg.mime, msg.bytes);
        case 'sendVoiceMessage':
          return await sendVoiceMessage(msg.username, msg.bytes, msg.mime, msg.expSeconds);
        case 'startCall':
          return await startCall(msg.username, msg.mode);
        case 'callSignal':
          return callSignal(msg.username, msg.payload || {});
        case 'acceptFileTransfer':
          return acceptFileTransfer(msg.username, msg.mid, msg.accept);
        case 'setTheme':
          state.theme = msg.mode || 'bone';
          return { ok: true };
        default:
          return { ok: false, error: 'bilinmeyen eylem' };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  })().then(sendResponse);

  return true; // async
});

console.log('ILQ offscreen yüklendi');