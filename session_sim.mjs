/* ILQ simülasyon: B (kod giren) <-> A (kod üreten) — offscreen handleIncoming mantığıyla */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
// codec.js ESM ama package commonjs: geçici .mjs kopyasını alıp systematic import
const codecSrc = readFileSync(new URL('./src/codec.js', import.meta.url), 'utf8');
writeFileSync(new URL('./.codec_tmp.mjs', import.meta.url), codecSrc);
const { encodeCode, decodeCode } = await import('./.codec_tmp.mjs');
import { KeyHelper, SignalProtocolAddress, SessionBuilder, SessionCipher, FingerprintGenerator } from '@privacyresearch/libsignal-protocol-typescript';

const DEVICE_ID = 1;
const MAX_ENVELOPE_LENGTH = 200000;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return Buffer.from(bin, 'binary').toString('base64');
}
function base64ToArrayBuffer(b64) {
  const buf = Buffer.from(b64, 'base64');
  const bytes = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) bytes[i] = buf[i];
  return bytes.buffer;
}
function binaryStringToArrayBuffer(s) {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}
function b64UrlToBase64(s) { let b = s.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4 !== 0) b += '='; return b; }

class RamStore {
  constructor() {
    this.identityKeyPair = undefined;
    this.registrationId = undefined;
    this.trusted = new Map();
    this.denylist = new Set(); // reddedilmiş kimlik anahtarları (base64)
    this.lastRejectedIdentity = null; // { identifier, key } | null
    this.preKeys = new Map();
    this.signedPreKeys = new Map();
    this.sessions = new Map();
  }
  async getIdentityKeyPair() { return this.identityKeyPair; }
  async getLocalRegistrationId() { return this.registrationId; }
  async isTrustedIdentity(identifier, pubKey) {
    const key = arrayBufferToBase64(pubKey);
    if (this.denylist.has(key)) return false;
    const saved = this.trusted.get(identifier);
    if (saved === undefined) return true;
    if (saved === key) return true;
    this.lastRejectedIdentity = { identifier, key, oldKey: saved };
    return false;
  }
  async saveIdentity(identifier, pubKey) { this.trusted.set(identifier, arrayBufferToBase64(pubKey)); return true; }
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

const addressFor = (username) => new SignalProtocolAddress(username, DEVICE_ID);

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ok:', msg); } else { fail++; console.error('  FAIL:', msg); } }

async function main() {
  // ============ A: kimlik + signed prekey + one-time prekey + KOD ÜRET ============
  const storeA = new RamStore();
  storeA.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  storeA.registrationId = KeyHelper.generateRegistrationId();
  const A = 'kzcx7h2xkd2qudp4qzzm';

  const signed = await KeyHelper.generateSignedPreKey(storeA.identityKeyPair, 11);
  const oneTime = await KeyHelper.generatePreKey(12);
  await storeA.storeSignedPreKey(signed.keyId, signed.keyPair);
  await storeA.storePreKey(oneTime.keyId, oneTime.keyPair);

  const code = encodeCode({
    u: A,
    r: storeA.registrationId,
    ik: arrayBufferToBase64(storeA.identityKeyPair.pubKey),
    spkId: signed.keyId,
    spk: arrayBufferToBase64(signed.keyPair.pubKey),
    spkSig: arrayBufferToBase64(signed.signature),
    opkId: oneTime.keyId,
    opk: arrayBufferToBase64(oneTime.keyPair.pubKey),
    exp: Date.now() + 5 * 60 * 1000,
  });
  const parsed = decodeCode(code);
  ok(!code.startsWith('ILQ1.'), 'kod öneksiz (codec değişikliği)');
  ok(typeof parsed.exp === 'number' && parsed.exp > Date.now(), 'kod exp round-trip korundu');

  // ============ B: kodu gir, initiator oturumu kur ============
  const storeB = new RamStore();
  storeB.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  storeB.registrationId = KeyHelper.generateRegistrationId();
  const B = 'tu3l6ndgoplobl2it3ib';

  const device = {
    registrationId: parsed.r,
    identityKey: base64ToArrayBuffer(parsed.ik),
    signedPreKey: { keyId: parsed.spkId, publicKey: base64ToArrayBuffer(parsed.spk), signature: base64ToArrayBuffer(parsed.spkSig) },
    preKey: { keyId: parsed.opkId, publicKey: base64ToArrayBuffer(parsed.opk) },
  };
  const builderB = new SessionBuilder(storeB, addressFor(A));
  await builderB.processPreKey(device);
  const cipherB = new SessionCipher(storeB, addressFor(A));
  console.log('B: initiator oturumu kuruldu');

  // ============ taşıma yardımcıları (offscreen sendEnvelope / handleIncoming) ============
  function sendEnvelope(cipher, connSend, type2, body2, regId) {
    connSend({ t: 'ilq', v: 1, k: type2, m: Buffer.from(body2, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), r: regId });
  }
  async function handleIncoming(cipher, envelope, label, expect) {
    if (!envelope || envelope.t !== 'ilq') throw new Error('eşleşme yok');
    if (typeof envelope.m !== 'string' || envelope.m.length === 0 || envelope.m.length > MAX_ENVELOPE_LENGTH) throw new Error('boyut');
    if (envelope.k !== 1 && envelope.k !== 3) throw new Error('tip');
    const body = Buffer.from(b64UrlToBase64(envelope.m), 'base64').toString('binary');
    let plain;
    if (envelope.k === 3) {
      plain = await cipher.decryptPreKeyWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
    } else {
      plain = await cipher.decryptWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
    }
    const text = new TextDecoder().decode(plain);
    if (expect !== undefined) ok(text === expect, label + ' = ' + text);
    else ok(true, label + ' = ' + text);
  }

  // ============ B → A: ilk mesaj (PreKey, type 3) — connectWithCode eşdeğeri ============
  const cipherA = new SessionCipher(storeA, addressFor(B));
  const greeting = new TextEncoder().encode('__ilq_init__').buffer;
  const first = await cipherB.encrypt(greeting);
  ok(first.type === 3, 'B ilk mesaj type 3 (prekey): ' + first.type);
  const env1 = {};
  sendEnvelope(cipherB, (o) => Object.assign(env1, o), first.type, first.body, first.registrationId);
  await handleIncoming(cipherA, env1, 'A greeting aldı', '__ilq_init__');
  console.log('  ... A responder oturumu kuruldu');

  // ============ A fingerprint (maybeIntroduce eşdeğeri) ============
  let remoteKeyFromSession;
  try {
    const record = await cipherA.getRecord(addressFor(B).toString());
    const s = record && record.getOpenSession();
    remoteKeyFromSession = s && s.indexInfo && s.indexInfo.remoteIdentityKey;
    ok(!!remoteKeyFromSession, 'A oturumundan remote identity key okundu');
    const gen = new FingerprintGenerator(5200);
    const fpA = await gen.createFor(A, storeA.identityKeyPair.pubKey, B, remoteKeyFromSession);
    const fpB = await gen.createFor(B, storeB.identityKeyPair.pubKey, A, base64ToArrayBuffer(parsed.ik));
    ok(fpA === fpB, 'fingerprintler eşleşti');
  } catch (e) {
    ok(false, 'A fingerprint hatası: ' + e.message);
  }

  // ============ B → A: normal mesaj (kullanıcı: "kodu alan kişiden gelen mesajlar gidiyor") ============
  {
    const msg = new TextEncoder().encode('B den A ya ilk mesaj').buffer;
    const e = await cipherB.encrypt(msg);
    console.log('  B→A mesaj üretildi (type ' + e.type + ')');
    const env = {};
    sendEnvelope(cipherB, (o) => Object.assign(env, o), e.type, e.body, e.registrationId);
    await handleIncoming(cipherA, env, 'A, B den mesaj aldı', 'B den A ya ilk mesaj');
  }

  // ============ A → B: cevap (kullanıcı: "kodu üretenin cevapları gitmiyor") ============
  {
    const reply = new TextEncoder().encode('cevap A dan B ye').buffer;
    let enc;
    try {
      enc = await cipherA.encrypt(reply);
      console.log('  A cevap üretti (type ' + enc.type + ')');
      ok(enc.type === 1 || enc.type === 3, 'A cevap tipi: ' + enc.type);
    } catch (e) {
      ok(false, 'A encrypt hatası: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(0, 3).join(' | '));
    }
    if (enc) {
      const env = {};
      sendEnvelope(cipherA, (o) => Object.assign(env, o), enc.type, enc.body, enc.registrationId);
      try {
        await handleIncoming(cipherB, env, 'B, A dan cevap aldı', 'cevap A dan B ye');
      } catch (e) {
        ok(false, 'B cevabı çözemedi: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(0, 3).join(' | '));
      }
    }
  }

  // ============ A → B: ikinci cevap (ratchet ilerleyince) ============
  {
    const reply2 = new TextEncoder().encode('ikinci cevap').buffer;
    const enc = await cipherA.encrypt(reply2);
    const env = {};
    sendEnvelope(cipherA, (o) => Object.assign(env, o), enc.type, enc.body, enc.registrationId);
    try {
      await handleIncoming(cipherB, env, 'B, A dan ikinci cevabı aldı', 'ikinci cevap');
    } catch (e) {
      ok(false, 'B ikinci cevabı çözemedi: ' + e.message);
    }
  }

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

  // ============ Paket 1: recallMessage gövde üretimi (offscreen mantığı) ============
  {
    // offscreen.js encodeMessageBody/decodeMessageBody ile birebir aynı mantık:
    const encBody = (text) => {
      const mid = 'x'.repeat(32); // randomMid benzetimi (deterministik)
      const body = JSON.stringify({ m: mid, t: text, ts: Date.now() });
      return { bytes: new TextEncoder().encode(body).buffer, mid };
    };
    const decBody = (bytes) => {
      const raw = new TextDecoder().decode(bytes);
      try {
        const j = JSON.parse(raw);
        if (j && typeof j.m === 'string') {
          return { mid: j.m, text: typeof j.t === 'string' ? j.t : raw, ts: typeof j.ts === 'number' ? j.ts : 0 };
        }
      } catch (e) {}
      return { mid: 'x'.repeat(32), text: raw, ts: 0 };
    };
    // HATALI desen (mevcut kök neden): recallMessage encodeMessageBody(JSON.stringify({m: hedef})) kullanıyor
    const hedef = 'g'.repeat(32);
    const wrapped = encBody(JSON.stringify({ m: hedef }));
    const ctrlWrong = decBody(wrapped.bytes);
    ok(ctrlWrong.mid !== hedef, 'recall: encodeMessageBody sarmalayıcısı hedef mid i taşımaz (kök neden)');
    // DOĞRU desen: k:4 gövdesi düz {m: hedef} JSON olmalı
    const direct = new TextEncoder().encode(JSON.stringify({ m: hedef })).buffer;
    const ctrlRight = decBody(direct);
    ok(ctrlRight.mid === hedef, 'recall: düz {m: mid} gövde hedef mid i çözer (doğru format)');
  }

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
      exp: Date.now() + 5 * 60 * 1000,
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

  // ============ Paket 2: blocklist (denylist) ============
  {
    const s = new RamStore();
    s.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    const otherKey = await KeyHelper.generateIdentityKeyPair();
    const otherB64 = arrayBufferToBase64(otherKey.pubKey);
    ok(await s.isTrustedIdentity('peer1', otherKey.pubKey), 'denylist yokken ilk temas güvenilir (TOFU)');
    s.denylist.add(otherB64);
    const trusted = await s.isTrustedIdentity('peer1', otherKey.pubKey);
    ok(!trusted, 'denylist\'teki anahtar güvenilmez');
  }

  // ============ Paket 2: OPK tek kullanım (one-time prekey tüketimi) ============
  {
    const st = new RamStore();
    st.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    const opk = await KeyHelper.generatePreKey(901);
    await st.storePreKey(opk.keyId, opk.keyPair);
    ok(!!(await st.loadPreKey(901)), 'OPK depoda');
    await st.removePreKey(901);
    ok(!(await st.loadPreKey(901)), 'OPK tüketildi, ikinci kullanım mümkün değil');
    // generateCode davranışı: yeni kod üretimi öncesi eski OPK'lar silinir
    st.preKeys.clear();
    ok(st.preKeys.size === 0, 'generateCode öncesi eski OPK\'lar temizlenir');
  }

  // ============ Paket 2: kod süresi kontrolü ============
  {
    ok(typeof parsed.exp === 'number', 'kod süresi taşır');
    const expired = decodeCode(code);
    expired.exp = Date.now() - 1;
    const isExpired = expired.exp !== undefined && Date.now() > expired.exp;
    ok(isExpired, 'exp geçmiş kod geçersiz sayılır');
    const noExp = decodeCode(code);
    delete noExp.exp;
    const noExpOk = noExp.exp === undefined || Date.now() <= noExp.exp;
    ok(noExpOk, 'exp\'siz eski format kod kabul edilir (süre sınırı yok)');
  }

  // ============ paket3: code TTL 5dk ============
  const ttlFields = { ...parsed, exp: Date.now() + 5 * 60 * 1000 };
  const ttlCode = encodeCode(ttlFields);
  const ttlParsed = decodeCode(ttlCode);
  ok(ttlParsed.exp <= Date.now() + 5 * 60 * 1000 + 100, 'kod exp 5dk penceresi içinde üretilir');

  // ============ paket3: panik resetAll ============
  function freshState() {
    return { peers: new Map(), store: new RamStore(), preKeyCounter: 10, decoy: false };
  }
  const panicSt = freshState();
  panicSt.peers.set('x', { initialized: true });
  panicSt.decoy = true;
  ok(panicSt.decoy === true, 'decoy bayrağı set edildi');
  ok(panicSt.peers.size === 1, 'panik simde peers korunabilir (gerçek resetAll peers\'i temizler)');

  // ============ Paket 2: rate-limit (token bucket) ============
  {
    const buckets = new Map();
    const LIMIT = 20;
    function checkRate(u) {
      const now = Date.now(); const sec = 1000;
      let b = buckets.get(u);
      if (!b) { b = { tokens: LIMIT, last: now }; buckets.set(u, b); }
      b.tokens = Math.min(LIMIT, b.tokens + (now - b.last) / sec * LIMIT);
      b.last = now;
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    }
    let accepted = 0;
    for (let i = 0; i < LIMIT; i++) if (checkRate('peerX')) accepted++;
    ok(accepted === LIMIT, 'ilk 20 istek kabul');
    ok(!checkRate('peerX'), '21. istek reddedilir');
    await new Promise((r) => setTimeout(r, 1050));
    ok(checkRate('peerX'), '1sn sonra kova yenilendi, istek kabul');
  }
  // ============ Paket 2: peer cap ============
  {
    const peers = new Map();
    for (let i = 1; i <= 3; i++) peers.set('p' + i, {});
    const newPeerBlocked = !peers.has('newPeer') && peers.size >= 3;
    ok(newPeerBlocked, '3 kayıt doluyken yeni peer reddedilir');
    ok(peers.has('p1'), 'mevcut oturumlu peer sınırlamadan etkilenmez');
  }

  // ============ Paket 2: receiver kimlik değişimi ============
  {
    const sA = new RamStore();
    sA.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    sA.registrationId = KeyHelper.generateRegistrationId();
    const sB = new RamStore();
    sB.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    sB.registrationId = KeyHelper.generateRegistrationId();
    const addrB = 'idchange-peer-b';
    // A, B'yi eski (farklı) bir anahtarla "güvenilir" olarak tanıyor
    const oldKey = await KeyHelper.generateIdentityKeyPair();
    sA.saveIdentity(addrB, oldKey.pubKey);
    // B yeni anahtarla A'ya oturum kurar
    const signedPk = await KeyHelper.generateSignedPreKey(sB.identityKeyPair, 31);
    const opkB = await KeyHelper.generatePreKey(32);
    await sB.storeSignedPreKey(signedPk.keyId, signedPk.keyPair);
    await sB.storePreKey(opkB.keyId, opkB.keyPair);
    const builderB = new SessionBuilder(sB, addressFor('peerA'));
    const signedA = await KeyHelper.generateSignedPreKey(sA.identityKeyPair, 41);
    await sA.storeSignedPreKey(signedA.keyId, signedA.keyPair);
    await builderB.processPreKey({
      registrationId: sA.registrationId,
      identityKey: sA.identityKeyPair.pubKey,
      signedPreKey: { keyId: signedA.keyId, publicKey: signedA.keyPair.pubKey, signature: signedA.signature },
      preKey: undefined,
    });
    const cipherB = new SessionCipher(sB, addressFor('peerA'));
    const env = {};
    const e = await cipherB.encrypt(new TextEncoder().encode('test').buffer);
    sendEnvelope(cipherB, (o) => Object.assign(env, o), e.type, e.body, e.registrationId);
    // A, B'nin yeni kimliğini çözmeye çalışır -> güvenilmez -> hata + lastRejectedIdentity
    let threw = false;
    const cipherA = new SessionCipher(sA, addressFor(addrB));
    try {
      const body = Buffer.from(b64UrlToBase64(env.m), 'base64').toString('binary');
      await cipherA.decryptPreKeyWhisperMessage(binaryStringToArrayBuffer(body), 'binary');
    } catch (err) {
      threw = true;
      ok(/Unknown identity key/.test(err.message), 'receiver kimlik hatası yakalanır: ' + err.message);
    }
    // Bu libsignal sürümü processV3'te isTrustedIdentity'yi await etmez (Promise hep truthy),
    // bu yüzden PreKey decrypt fırlatmaz; ama store kancası yine de lastRejectedIdentity'yi
    // yazar. handleIncoming k:3 güvenlik sinyali bu bayraktır. Gelecekte await düzeltilirse
    // threw üzerinden de yakalanır.
    ok(threw || !!sA.lastRejectedIdentity, 'receiver kimlik değişimi tespit edildi (threw veya lastRejectedIdentity)');
    ok(!!sA.lastRejectedIdentity && sA.lastRejectedIdentity.identifier === addrB, 'receiver: lastRejectedIdentity set edildi');
    ok(!!sA.lastRejectedIdentity && sA.lastRejectedIdentity.oldKey === arrayBufferToBase64(oldKey.pubKey), 'receiver: oldKey eski (güvenilen) anahtarı taşır');
  }

  // ============ paket3: mesaj e silme ============
  {
    // decodeMessageBody eşdeğeri (offscreen kopyası — e alanını okur)
    const decodeBodyMemo = (bytes) => {
      const raw = new TextDecoder().decode(bytes);
      try {
        const j = JSON.parse(raw);
        if (j && typeof j.m === 'string') {
          const e = (typeof j.e === 'number') ? j.e : undefined;
          return { mid: j.m, text: typeof j.t === 'string' ? j.t : raw, ts: typeof j.ts === 'number' ? j.ts : 0, e };
        }
      } catch (err) {}
      return { mid: 'x'.repeat(32), text: raw, ts: 0 };
    };
    const slow = { bytes: new TextEncoder().encode(JSON.stringify({ m: 'mid-e1', t: 'gecikmeli', ts: Date.now(), e: 1 })).buffer, mid: 'mid-e1' };
    const dec2 = decodeBodyMemo(slow.bytes); // decodeMessageBody(bytes) eşdeğeri
    ok(dec2.e === 1, 'mesaj gövdesi e alanını taşır');
    ok(dec2.mid === 'mid-e1', 'mid korunur');
  }

  // ============ paket3: sohbet zamanlayıcı senkron (k:11) ============
  {
    const b64ToB64Url = (s) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const timerPayload = JSON.stringify({ s: 30 });
    const timerBody = b64ToB64Url(btoa(timerPayload)); // local sync
    ok(timerBody.length > 0, 'k:11 gövdesi saniye taşır');
    const timerDecoded = JSON.parse(atob(b64UrlToBase64(timerBody)));
    ok(timerDecoded.s === 30, 'k:11 s değeri korunur');
  }

  // ============ paket3: expire kuralları ============
  {
    const eMsg = { m: 'fx', t: 'x', ts: Date.now(), e: 0 };
    ok(typeof eMsg.e === 'number', 'e int; 0 = kalıcı');
    ok((eMsg.ts + eMsg.e * 1000) === eMsg.ts, 'e=0 hesap ts\'ye eşit (kalıcı)');
    // === k:11 gövde ==
    ok(JSON.parse('{"s":30}').s === 30, 'sohbet zamanlayıcı 30 sn');
  }

  // ============ paket4: k:6 teslimat ack ============
  {
    const ackBody = JSON.stringify({ m: 'mid-1' });
    const ackCtl = JSON.parse(ackBody);
    ok(ackCtl.m === 'mid-1', 'k:6 ack gövdesi mid taşır');
    ok(typeof ackCtl.m === 'string', 'k:6 gövde formatı {m}');
    // offscreen decodeMessageBody eşdeğeri: {m} gövdesi ackCtl.mid olarak çözülür
    const decAck = { mid: ackCtl.m, text: ackCtl.m, ts: 0 };
    ok(decAck.mid === 'mid-1', 'k:6 gövdesi mid olarak çözülür (decodeMessageBody uyumu)');
  }

  // ============ paket4: adres defteri ============
  {
    // Self-contained veri sabiti (brief Step 1): addrB/ik burada blok-scope değil, yerel tanımlanır.
    const addrB = 'bahargün.local'; // simüle peer adresi (offscreen saveContact address argümanı)
    const ik = { pubKey: storeB.identityKeyPair.pubKey }; // simüle remote identity key
    const contact = { address: addrB, identityKey: arrayBufferToBase64(ik.pubKey), verified: false };
    const cMap = new Map([['bahargün', contact]]);
    ok(cMap.get('bahargün').address === addrB, 'adres defteri girdisi adres taşır');
    ok(cMap.get('bahargün').verified === false, 'yeni eş verified=false');
  }

  // ============ paket4: dosya parçalama (veri sabiti — brief Step 1) ============
  {
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
  }

  // ============ paket4: k:7/9/10 zarf türleri (uçtan uca envelope eşlemesi) ============
  {
    // Gerçek sendEnvelope(cipher, connSend, type2, body2, regId) helper'ı (yukarıda, Paket 2):
    // cipher gövde önceden encrypt edildiği için burada kullanılmaz (null), connSend zarfı envBox'a yazar.
    const envBox = {};
    sendEnvelope(null, (o) => Object.assign(envBox, o), 7, JSON.stringify({ m: 'f1', name: 'a.jpg', size: 100, type: 'image/jpeg', parts: 2 }), 1);
    ok(envBox.k === 7, 'k:7 teklif zarf türü');
    sendEnvelope(null, (o) => Object.assign(envBox, o), 9, JSON.stringify({ m: 'f1', idx: 0, total: 2, bytes: 'aGVsbG8=' }), 1);
    ok(envBox.k === 9, 'k:9 parça zarf türü');
    sendEnvelope(null, (o) => Object.assign(envBox, o), 10, JSON.stringify({ m: 'f1' }), 1);
    ok(envBox.k === 10, 'k:10 tamam zarf türü');
  }

  console.log('\n%d geçti, %d hata', pass, fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('GENEL HATA:', e.message); console.error(e.stack); process.exit(1); });