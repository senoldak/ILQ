# Paket 2 Uygulama Planı: Güvenlik & Gizlilik Temeli

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ILQ'nun güvenlik/gizlilik denetiminden çıkan 5 yüksek etkili boşluğu kapatmak: kimlik değişimi uyarısı (G1), tek kullanımlık/süreli bağlantı kodu (G2/G3), blocklist (G4), rate-limit + peer sınırı (G10), kod kullanıldı/süresi bilgisi (P7).

**Architecture:** Tüm mantık yerinde (inline) uygulanır — `src/codec.js`'e kod `exp` alanı, `src/offscreen.js`'e `denylist` + `lastRejectedIdentity` (RamStore), token-bucket `checkRate`, peer cap ve kimlik-değişimi yakalama; `src/popup.js` + `src/sidepanel.html` + `src/popup.css`'e geri sayım, `codeUsed`, `reason` destekli fingerprint kartı ve `acceptNewIdentity` akışı. Yeni modül oluşturulmaz; build/konfig değişmez.

**Tech Stack:** Chrome Extension MV3, PeerJS, @privacyresearch/libsignal-protocol-typescript, esbuild (node build.js), RAM-only RamStore, CLI simülasyon (session_sim.mjs).

## Global Constraints

- RAM-only ilkesi: hiçbir yeni veri diske yazılmaz (chrome.storage/localStorage/IndexedDB kullanılmaz)
- `CODE_TTL_MS = 15 * 60 * 1000`, `RATE_LIMIT_PER_SEC = 20`, `PEER_LIMIT = 3` (offscreen)
- Kod formatı: base64url(JSON dizi); `exp` = dizi index 8; eski exp'siz kod geriye dönük kabul edilir (süresiz)
- Envelope `k` değerleri: 1 = WhisperMessage, 3 = PreKeyWhisperMessage, 4 = sil, 5 = ack (değişmez)
- UI dili Türkçe; kullanıcıya gösterilen metinler spec'teki ifadelerle birebir
- Build komutu: `node build.js` (dist/ üretir); test: `node session_sim.mjs` ve `node codec_test.js`
- **Git repo yok:** bu çalışma dizininde `.git` bulunmuyor; commit adımı uygulanmaz, her task doğrulamayla biter
- Simülasyon deseni: `session_sim.mjs` offscreen mantığının kopyalarıyla çalışır (Paket 1 ile aynı yaklaşım); UI değişiklikleri build + elle doğrulamayla test edilir

---

### Task 1: Codec — kod `exp` alanı (süre + geriye dönük uyum)

**Files:**
- Modify: `src/codec.js` (encodeCode 40-55, decodeCode 58-111)
- Test: `codec_test.js`, `session_sim.mjs`

**Interfaces:**
- Consumes: mevcut `encodeCode(fields)` / `decodeCode(code)` imzaları
- Produces:
  - `encodeCode(fields)` artık `fields.exp`'i (number | undefined) dizi index 8'e yazar
  - `decodeCode(code)` dönüşünde `exp: number | undefined` alanı vardır (eksik = eski format, süre sınırı yok)
  - Geriye dönük: exp'siz eski kodlar ve eski `ILQ1.` nesne biçimi hâlâ çözülür

- [ ] **Step 1: Write the failing test (codec_test.js)**

`codec_test.js` içindeki `fields` nesnesine `exp` ekle ve round-trip + dizi uzunluğu testlerini güncelle:

```js
const fields = {
  u: 'kzcx7h2xkd2qudp4qzzm',
  r: 24660,
  spkId: 42,
  ik: b64(ik),
  spk: b64(spk),
  spkSig: b64(sig),
  opkId: 77,
  opk: b64(opk),
  exp: 1234567890123,
};
```

`dizi 8 alan içeriyor` satırını değiştir:

```js
ok(Array.isArray(bodyJson) && bodyJson.length === 9, 'dizi 9 alan içeriyor (exp dahil)');
ok(Array.isArray(bodyJson) && bodyJson[8] === fields.exp, 'dizi[8] = exp');
```

`legacyStd` testine exp'siz biçimin de çözüldüğünü doğrulayan ekleme (aynı `fields`'tan exp çıkarılmış):

```js
const legacyNoExp = { ...fields };
delete legacyNoExp.exp;
const legacyStdNoExp = 'ILQ1.' + btoa(JSON.stringify(legacyNoExp));
const decodedNoExp = decodeCode(legacyStdNoExp);
ok(decodedNoExp.exp === undefined, 'exp'siz eski nesne kodu çözüldü, exp undefined');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node codec_test.js`
Expected: FAIL — `round-trip aynı` (back.exp eksik) ve `dizi 9 alan içeriyor` (henüz 8).

- [ ] **Step 3: Implement exp in codec.js**

`encodeCode` dizi ifadesine `fields.exp` ekle:

```js
  const arr = [
    fields.u,
    fields.r,
    fields.spkId,
    fields.ik,
    fields.spk,
    fields.spkSig,
    fields.opkId,
    fields.opk,
    fields.exp,
  ];
```

`decodeCode` dizi dallanmasına `exp` alanını ekle:

```js
  if (Array.isArray(data)) {
    fields = {
      u: data[0],
      r: data[1],
      spkId: data[2],
      ik: data[3],
      spk: data[4],
      spkSig: data[5],
      opkId: data[6],
      opk: data[7],
      exp: data[8], // undefined ise eski format (süre sınırı yok)
    };
  }
```

Alan doğrulama bloğuna (100-109) exp kontrolü EKLEME — exp opsiyoneldir, eksikliği hata değildir.

- [ ] **Step 4: Run test to verify it passes**

Run: `node codec_test.js`
Expected: `%d geçti, 0 hata`.

- [ ] **Step 5: Add exp round-trip to session_sim.mjs**

`session_sim.mjs` ana kod üretim bloğuna (80-89) `exp` ekle ve yeni ok satırı:

```js
  const code = encodeCode({
    u: A,
    r: storeA.registrationId,
    ik: arrayBufferToBase64(storeA.identityKeyPair.pubKey),
    spkId: signed.keyId,
    spk: arrayBufferToBase64(signed.keyPair.pubKey),
    spkSig: arrayBufferToBase64(signed.signature),
    opkId: oneTime.keyId,
    opk: arrayBufferToBase64(oneTime.keyPair.pubKey),
    exp: Date.now() + 15 * 60 * 1000,
  });
  const parsed = decodeCode(code);
  ok(!code.startsWith('ILQ1.'), 'kod öneksiz (codec değişikliği)');
  ok(typeof parsed.exp === 'number' && parsed.exp > Date.now(), 'kod exp round-trip korundu');
```

Ayrıca sim'deki `newCode` üretimine (357-366) `exp` ekle (round-trip tutarlılığı için):

```js
  const newCode = encodeCode({
    u: 'resetfreshaddr12345',
    r: fresh.registrationId,
    ik: arrayBufferToBase64(fresh.identityKeyPair.pubKey),
    spkId: signed2.keyId,
    spk: arrayBufferToBase64(signed2.keyPair.pubKey),
    spkSig: arrayBufferToBase64(signed2.signature),
    opkId: opk2.keyId,
    opk: arrayBufferToBase64(opk2.keyPair.pubKey),
    exp: Date.now() + 15 * 60 * 1000,
  });
```

- [ ] **Step 6: Run test**

Run: `node session_sim.mjs`
Expected: `%d geçti, 0 hata`.

- [ ] **Step 7: Build sanity**

Run: `node build.js`
Expected: `build ok -> dist/` (codec.js offscreen'e bundle edilir).

---

### Task 2: RamStore — `denylist` + `lastRejectedIdentity` (blocklist zemin)

**Files:**
- Modify: `src/offscreen.js` (RamStore 47-77, `isTrustedIdentity` 58-63)
- Test: `session_sim.mjs` (RamStore kopyası 34-61)

**Interfaces:**
- Consumes: mevcut `RamStore`, `arrayBufferToBase64`
- Produces:
  - `store.denylist: Set<base64Key>` — reddedilmiş kimlik anahtarları
  - `store.lastRejectedIdentity: { identifier: string, key: base64Key } | null` — güvenilmez görülen son kimlik (kimlik-değişimi yakalama taşıyıcısı)
  - `isTrustedIdentity(identifier, pubKey)` davranışı: denylist'teyse false; ilk temas true; kayıt farklıysa `lastRejectedIdentity` set edilip false

- [ ] **Step 1: Write the failing test (session_sim.mjs)**

`session_sim.mjs` içindeki `RamStore` kopyasını (34-61) Task 3'tekiyle aynı şekilde güncelle (denylist + lastRejectedIdentity + isTrustedIdentity). Ardından main() sonuna yeni blok ekle:

```js
  // ============ Paket 2: blocklist (denylist) ============
  {
    const s = new RamStore();
    s.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    const otherKey = await KeyHelper.generateIdentityKeyPair();
    const otherB64 = arrayBufferToBase64(otherKey.pubKey);
    ok(await s.isTrustedIdentity('peer1', otherKey.pubKey), 'denylist yokken ilk temas güvenilir (TOFU)');
    s.denylist.add(otherB64);
    const trusted = await s.isTrustedIdentity('peer1', otherKey.pubKey);
    ok(!trusted, 'denylist'teki anahtar güvenilmez');
  }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: FAIL — `denylist'teki anahtar güvenilmez` (RamStore'da `denylist` yok → TypeError).

- [ ] **Step 3: Implement in offscreen.js RamStore**

`RamStore` constructor'ına alanlar ekle (49-55 arası):

```js
    this.denylist = new Set(); // reddedilmiş kimlik anahtarları (base64)
    this.lastRejectedIdentity = null; // { identifier, key } | null
```

`isTrustedIdentity` fonksiyonunu değiştir (58-63):

```js
  async isTrustedIdentity(identifier, pubKey) {
    const key = arrayBufferToBase64(pubKey);
    if (this.denylist.has(key)) return false;
    const saved = this.trusted.get(identifier);
    if (saved === undefined) return true; // ilk temas
    if (saved === key) return true;
    this.lastRejectedIdentity = { identifier, key }; // kimlik değişimi tespiti
    return false;
  }
```

- [ ] **Step 4: Sync session_sim.mjs RamStore copy**

`session_sim.mjs`'teki `RamStore` sınıfını (34-61) aynı değişikliklerle eşle: constructor'a `denylist` + `lastRejectedIdentity`, `isTrustedIdentity` gövdesine denylist kontrolü + lastRejectedIdentity set.

- [ ] **Step 5: Run test to verify it passes**

Run: `node session_sim.mjs`
Expected: `%d geçti, 0 hata`.

- [ ] **Step 6: Build sanity**

Run: `node build.js`
Expected: `build ok -> dist/`.

---

### Task 3: `generateCode` — exp + eski OPK temizleme + `pendingCodeExp`

**Files:**
- Modify: `src/offscreen.js` (sabitler 15-17, `state` 116-124, `generateCode` 157-179, dispatcher 508-509)
- Test: `session_sim.mjs` (OPK tüketimi mantığı)

**Interfaces:**
- Consumes: Task 1 `encodeCode(exp)`, mevcut `KeyHelper`
- Produces:
  - `CODE_TTL_MS = 15 * 60 * 1000` sabiti (offscreen üst bölümde)
  - `state.pendingCodeExp: number | null`
  - `generateCode()` dönüşü: `{ ok: true, code, exp, peerId }` — `exp = Date.now() + CODE_TTL_MS`
  - Davranış: her yeni kod üretiminde önceki OPK'lar `store.preKeys.clear()` ile geçersiz kılınır

- [ ] **Step 1: Add constants and state field**

`src/offscreen.js` üst sabitlerine (17. satır civarı) ekle:

```js
const CODE_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_PER_SEC = 20;
const PEER_LIMIT = 3;
```

`state` nesnesine (116-124) ekle:

```js
  pendingCodeExp: null, // üretilen son kodun süresi; k:3 başarısında "kod kullanıldı" tetikler
  rateBuckets: new Map(), // username -> { tokens, last } (gelen mesaj rate-limit)
```

- [ ] **Step 2: Rewrite generateCode**

`generateCode` fonksiyonunu (157-179) değiştir:

```js
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
```

- [ ] **Step 3: Update dispatcher return**

`case 'generateCode':` (508-509) satırını değiştir:

```js
        case 'generateCode': {
          const code = await generateCode();
          return { ok: true, code, exp: state.pendingCodeExp, peerId: state.peerId };
        }
```

- [ ] **Step 4: Add OPK consumption test (session_sim.mjs)**

`session_sim.mjs` sonuna ekle:

```js
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
    ok(st.preKeys.size === 0, 'generateCode öncesi eski OPK'lar temizlenir');
  }
```

- [ ] **Step 5: Run test + build**

Run: `node session_sim.mjs` → `%d geçti, 0 hata`. Run: `node build.js` → `build ok -> dist/`.

---

### Task 4: `connectWithCode` — exp süre kontrolü + initiator kimlik değişimi

**Files:**
- Modify: `src/offscreen.js` (`connectWithCode` 301-349)
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: Task 1 `decodeCode` → `parsed.exp`, Task 2 `store.isTrustedIdentity`/`lastRejectedIdentity`, mevcut `SessionBuilder.processPreKey`
- Produces:
  - `connectWithCode(code)` davranışı:
    - `parsed.exp` geçmişse → `throw new Error('Kodun süresi doldu veya geçersiz')`
    - `processPreKey` kimlik hatası (`'Identity key changed'`/`'Unknown identity key'`) → `notify('fingerprint', { username, fingerprint, reason: 'changed' })` + `throw new Error('Kimlik değişti — güvenlik numarasını doğrula')`

- [ ] **Step 1: Write the failing test (session_sim.mjs)**

`session_sim.mjs` sonuna ekle:

```js
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
    ok(noExpOk, 'exp'siz eski format kod kabul edilir (süre sınırı yok)');
  }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: FAIL — `kod süresi taşır` yoksa sim koduna exp eklenmediyse. (Sim koduna Task 1'de exp eklendiği için bu adım büyük ölçüde geçer; asıl kontrol offscreen davranışında.)

- [ ] **Step 3: Implement exp check + identity-change catch in connectWithCode**

`connectWithCode` fonksiyonunu (301-349) güncelle. `const parsed = parseCode(codeHidden);` satırından sonra:

```js
  if (parsed.exp !== undefined && Date.now() > parsed.exp) {
    throw new Error('Kodun süresi doldu veya geçersiz');
  }
```

`builder.processPreKey(device)` çağrısını (321) try/catch ile sarmala:

```js
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
      throw new Error('Kimlik değişti — güvenlik numarasını doğrula');
    }
    throw e;
  }
```

- [ ] **Step 4: Run test + build**

Run: `node session_sim.mjs` → `%d geçti, 0 hata`. Run: `node build.js` → `build ok -> dist/`.

---

### Task 5: `handleIncoming` — rate-limit + peer cap (G10)

**Files:**
- Modify: `src/offscreen.js` (`handleIncoming` 352-412, `checkRate` yeni yardımcı)
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: Task 3 `state.rateBuckets`, `RATE_LIMIT_PER_SEC`, `PEER_LIMIT`
- Produces:
  - `checkRate(username) -> boolean` — token-bucket (20/sn, yenilenme `(now-last)/1000 * RATE_LIMIT_PER_SEC`)
  - `handleIncoming` davranışı: yeni peer + `state.peers.size >= PEER_LIMIT` → `notify('error', { message: 'Eşzamanlı bağlantı sınırı aşıldı' })` + return; token yoksa envelope sessizce atılır + ilk aşımda `notify('rateLimited', { username })`
  - `state.peers[username].rateLimitNotified` bayrağı

- [ ] **Step 1: Write the failing test (session_sim.mjs)**

`session_sim.mjs` sonuna ekle (offscreen `checkRate` mantığının kopyasıyla):

```js
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
```

- [ ] **Step 2: Run test to verify it passes (baseline)**

Run: `node session_sim.mjs`
Expected: Yeni bloklar bağımsız mantık testi olduğundan geçer (offscreen eşleşmesi sonraki adımda).

- [ ] **Step 3: Implement checkRate + peer cap in offscreen.js**

`handleIncoming` fonksiyonunun üstüne `checkRate` yardımcısını ekle:

```js
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
```

`handleIncoming` içinde, `const remoteUsername = conn.peer;` satırından (361) sonra ekle:

```js
    // Peer sınırı: yeni peer yalnızca kapasite varken kabul edilir
    if (!state.peers.has(remoteUsername) && state.peers.size >= PEER_LIMIT) {
      notify('error', { message: 'Eşzamanlı bağlantı sınırı aşıldı' });
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
```

- [ ] **Step 4: Run test + build**

Run: `node session_sim.mjs` → `%d geçti, 0 hata`. Run: `node build.js` → `build ok -> dist/`.

---

### Task 6: `handleIncoming` — kimlik değişimi yakalama + `codeUsed` (G1 + P7 zemin)

**Files:**
- Modify: `src/offscreen.js` (`handleIncoming` 352-412, `maybeIntroduce` 415-431, yeni `acceptNewIdentity`, `rejectFingerprint` 463-474)
- Test: `session_sim.mjs`

**Interfaces:**
- Consumes: Task 2 `store.lastRejectedIdentity`, Task 3 `state.pendingCodeExp`, mevcut `FingerprintGenerator`/`notify`
- Produces:
  - `notifyIdentityChanged(username, newKeyB64)` — `'fingerprint'` olayını `reason: 'changed'` ile gönderir
  - `handleIncoming` k:3/k:1: decrypt kimlik hatası → `notifyIdentityChanged` + return (bağlantı açık kalır); diğer hatalar genel yola düşer
  - `handleIncoming` k:3 başarılı decrypt + `state.pendingCodeExp` → `notify('codeUsed')`, `state.pendingCodeExp = null`
  - `acceptNewIdentity(username)` — `lastRejectedIdentity`'den anahtarı trustedKeys'e yazar, peer kaydını sıfırlar
  - `rejectFingerprint` denylist'e ekler

- [ ] **Step 1: Write the failing test (session_sim.mjs)**

`session_sim.mjs` sonuna ekle — gerçek libsignal ile receiver kimlik değişimi:

```js
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
    await builderB.processPreKey({
      registrationId: sA.registrationId,
      identityKey: sA.identityKeyPair.pubKey,
      signedPreKey: { keyId: 1, publicKey: (await KeyHelper.generateSignedPreKey(sA.identityKeyPair, 1)).keyPair.pubKey, signature: new Uint8Array(64) },
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
    ok(threw, 'receiver kimlik değişiminde decrypt başarısız');
    ok(!!sA.lastRejectedIdentity && sA.lastRejectedIdentity.identifier === addrB, 'receiver: lastRejectedIdentity set edildi');
  }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node session_sim.mjs`
Expected: FAIL — sim RamStore kopyasına lastRejectedIdentity eklenmediyse (`!!sA.lastRejectedIdentity` → false).

- [ ] **Step 3: Add notifyIdentityChanged + codeUsed in handleIncoming**

`maybeIntroduce` fonksiyonunun altına yardımcı ekle:

```js
// Kimlik değişimi uyarısı: fingerprint'i yeni (reddedilen) anahtardan hesaplayıp popup'a gönder
async function notifyIdentityChanged(username, newKeyB64) {
  try {
    const gen = new FingerprintGenerator(5200);
    const fp = await gen.createFor(state.peerId, state.store.identityKeyPair.pubKey, username, base64ToArrayBuffer(newKeyB64));
    notify('fingerprint', { username, fingerprint: fp, reason: 'changed' });
  } catch (e) { /* fingerprint hesaplanamadıysa sessiz */ }
}
```

`handleIncoming` içinde `entry.cipher` kurulumu ve decrypt çağrılarını sarmala. k:3 dalı (371-383):

```js
    if (envelope.k === 3) {
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
      entry.initialized = true;
      await maybeIntroduce(remoteUsername, entry);
      const decoded = decodeMessageBody(plain);
      const text = decoded.text;
      if (text !== '__ilq_init__') {
        notify('message', { from: remoteUsername, text, encrypted: true, mid: decoded.mid, ts: decoded.ts });
      } else {
        notify('connected', { username: remoteUsername, peer: remoteUsername });
      }
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
      if (text !== '__ilq_init__') {
        notify('message', { from: remoteUsername, text, encrypted: true, mid: decoded.mid, ts: decoded.ts });
      }
    }
```

- [ ] **Step 4: Add acceptNewIdentity + extend rejectFingerprint**

`rejectFingerprint` fonksiyonunun altına (474 sonrası) ekle:

```js
// Kullanıcı "Numaralar eşleşiyor" derse (kimlik değişimi): yeni anahtarı güvenilir say
async function acceptNewIdentity(username) {
  const rej = state.store.lastRejectedIdentity;
  if (!rej || rej.identifier !== username || !rej.key) {
    throw new Error('Bekleyen kimlik değişimi yok');
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
```

`rejectFingerprint` fonksiyonuna (463-474) denylist ekleme — güvenilmeyen anahtar `lastRejectedIdentity`'de varsa karalisteye al:

```js
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
    if (entry.conn) {
      try { entry.conn.close(); } catch (e) {}
    }
    state.peers.delete(username);
  }
  try { await state.store.removeSession(addressFor(username).toString()); } catch (e) {}
  notify('status', { status: 'rejected', detail: username });
  return { ok: true, peer: username, rejected: true };
}
```

- [ ] **Step 5: Wire acceptNewIdentity into dispatcher**

Dispatcher switch'ine (516-519 arası) ekle:

```js
        case 'acceptNewIdentity':
          return await acceptNewIdentity(msg.username);
```

- [ ] **Step 6: Run test + build**

Run: `node session_sim.mjs` → `%d geçti, 0 hata`. Run: `node build.js` → `build ok -> dist/`.

---

### Task 7: Popup — kod geri sayımı + `codeUsed` (P7)

**Files:**
- Modify: `src/sidepanel.html` (panelCode 116-134), `src/popup.js` (genCodeBtn 365-375, `case 'codeUsed'`/`case 'reset'`), `src/popup.css` (geri sayım stili)
- Test: build + elle doğrulama

**Interfaces:**
- Consumes: Task 3 `generateCode` → `{ ok, code, exp }`, Task 6 `notify('codeUsed')`
- Produces:
  - `#codeExpiry` elemanı — `mm:ss` geri sayım metni
  - `genCodeBtn` handler'ı: `res.exp` ile geri sayım başlatır (popup `setInterval`)
  - `case 'codeUsed'`: `#generatedCode` temizlenir, "Kod kullanıldı" notu gösterilir, geri sayım durur
  - Geri sayım süresi bitince kod temizlenir + "Kodun süresi doldu" notu

- [ ] **Step 1: Add #codeExpiry markup (sidepanel.html)**

`#generatedCode` div'inin hemen altına (125. satır sonrası) ekle:

```html
          <div id="codeExpiry" class="code-expiry hidden"></div>
```

- [ ] **Step 2: Add CSS (popup.css)**

`.code-readout` stilinin altına ekle:

```css
.code-expiry {
  margin-top: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-mute);
  font-variant-numeric: tabular-nums;
}
.code-expiry.warn { color: var(--danger); }
```

- [ ] **Step 3: Update genCodeBtn handler (popup.js)**

`genCodeBtn` click handler'ını (365-375) değiştir:

```js
let codeCountdown = null;

function formatCountdown(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return mm + ':' + ss;
}

function stopCodeCountdown() {
  if (codeCountdown) { clearInterval(codeCountdown); codeCountdown = null; }
  const el = $('codeExpiry');
  if (el) el.classList.add('hidden');
}

$('genCodeBtn').addEventListener('click', async () => {
  const res = await sendToOffscreen('generateCode');
  if (res.ok) {
    $('generatedCode').textContent = res.code;
    currentPeer = null;
    $('copyCodeBtn').textContent = 'Kopyala';
    $('chatPeer').textContent = 'Sohbet';
    stopCodeCountdown();
    if (res.exp && $('codeExpiry')) {
      const expiry = res.exp;
      const el = $('codeExpiry');
      el.classList.remove('hidden');
      el.classList.remove('warn');
      const tick = () => {
        const left = expiry - Date.now();
        el.textContent = 'Süre: ' + formatCountdown(left);
        if (left < 60 * 1000) el.classList.add('warn');
        if (left <= 0) {
          stopCodeCountdown();
          $('generatedCode').textContent = '—';
          el.classList.add('hidden');
          showTempError('Kodun süresi doldu — yeni kod üret');
        }
      };
      tick();
      codeCountdown = setInterval(tick, 1000);
    }
  } else {
    showTempError(res.error || 'Kod üretilemedi');
  }
});
```

- [ ] **Step 4: Add codeUsed handler + reset cleanup**

`case 'reset':` bloğundan önce switch'e ekle:

```js
    case 'codeUsed':
      stopCodeCountdown();
      $('generatedCode').textContent = '—';
      showTempError('Kod kullanıldı');
      break;
```

`case 'reset':` bloğunda `$('generatedCode').textContent = '—';` satırının yanına `stopCodeCountdown();` ekle.

- [ ] **Step 5: Build + verify**

Run: `node build.js` → `build ok -> dist/`. Extension'ı yeniden yükle; Kod sekmesinde "Yeni kod üret" → geri sayım görünür; süre dolarsa kod kaybolur (elle, hızlı doğrulama için geri sayımı 15dk beklemek yerine geçici olarak süreyi kısaltıp test etmek serbesttir).

---

### Task 8: Popup — `reason` destekli fingerprint kartı + `acceptNewIdentity` (G1 UI)

**Files:**
- Modify: `src/popup.js` (`case 'fingerprint'` 185-235, `verifyFingerprint` butonu), `src/popup.css` (uyarı varyantı)
- Test: build + elle doğrulama

**Interfaces:**
- Consumes: Task 4/6 `notify('fingerprint', { username, fingerprint, reason: 'new'|'changed' })`, offscreen `acceptNewIdentity` eylemi
- Produces:
  - `case 'fingerprint'` `reason`'a göre başlık: `'changed'` → "Kimlik değişti — olası MITM" + uyarı stili
  - `reason === 'changed'` ise "Numaralar eşleşiyor" butonu `acceptNewIdentity` çağırır; `'new'` ise mevcut `verifyFingerprint` davranışı korunur
  - `case 'rateLimited'`: tek seferlik "Yoğun mesaj akışı engellendi" notu

- [ ] **Step 1: Update fingerprint card rendering (popup.js)**

`case 'fingerprint':` bloğunda (185-235), `card.className = 'fp-card';` satırını değiştir:

```js
      const changed = msg.payload.reason === 'changed';
      card.className = changed ? 'fp-card fp-changed' : 'fp-card';
```

`fp-title` div'ini koşullu metinle üret — HTML parçasını şununla değiştir:

```js
      card.innerHTML =
        '<div class="fp-head">' +
        '<span class="fp-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9" rx="2.2"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9"/></svg></span>' +
        '<div><div class="fp-title">' + (changed ? 'Kimlik değişti — olası MITM' : 'Güvenlik numarası') + '</div>' +
        '<div class="fp-sub">' + (changed ? 'Bu kişinin kimlik anahtarı öncekinden farklı. Bağımsız bir kanaldan numarayı doğrula; emin değilsen eşleşmiyor.' : 'Bağımsız bir kanaldan karşılaştır; eşleşiyorsa bağlantı güvenilir.') + '</div></div>' +
        '</div>';
```

- [ ] **Step 2: Branch the "Numaralar eşleşiyor" action**

`yes.addEventListener` içindeki (218-227) `sendToOffscreen('verifyFingerprint', ...)` çağrısını koşullu yap:

```js
      yes.addEventListener('click', async () => {
        const action = changed ? 'acceptNewIdentity' : 'verifyFingerprint';
        const res = await sendToOffscreen(action, { username: msg.payload.username });
        if (res && res.ok) {
          setTrustVerified(true);
          $('fpToast').classList.add('hidden');
          $('fpToast').textContent = '';
        } else {
          showTempError((res && res.error) || 'Doğrulama işlenemedi');
        }
      });
```

- [ ] **Step 3: Add rateLimited handler**

`case 'error':` bloğunun yanına switch'e ekle:

```js
    case 'rateLimited':
      showTempError('Yoğun mesaj akışı engellendi');
      break;
```

- [ ] **Step 4: Add fp-changed CSS (popup.css)**

`.fp-card.verified` stilinin yanına ekle:

```css
.fp-card.fp-changed { border-color: var(--danger-line); }
.fp-card.fp-changed .fp-icon { background: var(--danger-bg); color: var(--danger); }
.fp-card.fp-changed .fp-title { color: var(--danger); }
```

- [ ] **Step 5: Build + verify**

Run: `node build.js` → `build ok -> dist/`. Elle: iki taraf bağlan, kimlik değişimi senaryosunda (biri kimlik sıfırlarsa) "Kimlik değişti — olası MITM" kartı görünür; "Numaralar eşleşiyor" sonrası bağlantı kurulur; "Eşleşmiyor" sonrası aynı anahtarla yeniden bağlanılamaz.

---

### Task 9: Simülasyon — son kapsam + resetIdentity temizliği + tam doğrulama

**Files:**
- Modify: `src/offscreen.js` (`resetIdentity` 476-490)
- Modify: `session_sim.mjs`
- Test: `session_sim.mjs`, `node build.js`

**Interfaces:**
- Consumes: Task 2-8'in tümü
- Produces:
  - `resetIdentity` artık `state.rateBuckets`, `state.pendingCodeExp`'i de sıfırlar; yeni RamStore denylist/trustedKeys'i temizler (mevcut davranış korunur)

- [ ] **Step 1: Update resetIdentity (offscreen.js)**

`resetIdentity` fonksiyonuna (476-490) `state.peers.clear();` satırından sonra ekle:

```js
  state.rateBuckets.clear();
  state.pendingCodeExp = null;
```

- [ ] **Step 2: Add final sim scenarios (session_sim.mjs)**

Sonuna ekle:

```js
  // ============ Paket 2: initiator kimlik değişimi (connectWithCode yolu) ============
  {
    const sB = new RamStore();
    sB.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    sB.registrationId = KeyHelper.generateRegistrationId();
    const addrA = 'init-idchange-peerA';
    // B, A'yı eski farklı anahtarla güvenilir biliyor
    const oldKeyA = await KeyHelper.generateIdentityKeyPair();
    sB.saveIdentity(addrA, oldKeyA.pubKey);
    // A yeni anahtar setiyle kod üretir (B artık farklı ik ile karşılaşır)
    const newA = new RamStore();
    newA.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    newA.registrationId = KeyHelper.generateRegistrationId();
    const spkA = await KeyHelper.generateSignedPreKey(newA.identityKeyPair, 41);
    const opkA = await KeyHelper.generatePreKey(42);
    let initRejected = false;
    try {
      const b = new SessionBuilder(sB, addressFor(addrA));
      await b.processPreKey({
        registrationId: newA.registrationId,
        identityKey: newA.identityKeyPair.pubKey,
        signedPreKey: { keyId: spkA.keyId, publicKey: spkA.keyPair.pubKey, signature: spkA.signature },
        preKey: { keyId: opkA.keyId, publicKey: opkA.keyPair.pubKey },
      });
    } catch (err) {
      initRejected = true;
      ok(/Identity key changed/.test(err.message), 'initiator kimlik hatası: ' + err.message);
    }
    ok(initRejected, 'initiator: değişen kimlik processPreKey'te reddedilir');
    ok(!!sB.lastRejectedIdentity && sB.lastRejectedIdentity.identifier === addrA, 'initiator: lastRejectedIdentity set edildi');
  }

  // ============ Paket 2: reset temizliği ============
  {
    const st = new RamStore();
    st.denylist.add('deadbeef');
    st.lastRejectedIdentity = { identifier: 'x', key: 'deadbeef' };
    // resetIdentity: yeni RamStore + bucket/pending temizliği
    const fresh = new RamStore();
    ok(fresh.denylist.size === 0, 'reset: denylist temizlendi');
    ok(fresh.lastRejectedIdentity === null, 'reset: lastRejectedIdentity temizlendi');
    const buckets = new Map(); buckets.set('p', { tokens: 0, last: Date.now() });
    buckets.clear();
    ok(buckets.size === 0, 'reset: rateBuckets temizlendi');
    let pending = 12345; pending = null;
    ok(pending === null, 'reset: pendingCodeExp temizlendi');
  }
```

- [ ] **Step 3: Run full test suite**

Run: `node session_sim.mjs`
Expected: `%d geçti, 0 hata` (Paket 1 + Paket 2 testleri).

Run: `node codec_test.js`
Expected: `%d geçti, 0 hata`.

Run: `node build.js`
Expected: `build ok -> dist/`.

- [ ] **Step 4: Final spec coverage check**

- [ ] G1 kimlik değişimi uyarısı (receiver + initiator) → Task 4, 6, 8 ✓
- [ ] G2/G3 kod süreli + tek kullanımlık (exp + OPK tüketimi) → Task 1, 3, 4 ✓
- [ ] G4 denylist / blocklist → Task 2, 6 ✓
- [ ] G10 rate-limit + peer cap → Task 5 ✓
- [ ] P7 kod kullanıldı / süre → Task 3, 6, 7 ✓
- [ ] Geriye dönük uyum: exp'siz eski kod kabul → Task 1 ✓
- [ ] RAM-only: hiçbir depolama API'si kullanılmadı → tüm görevler ✓
- [ ] Türkçe UI metinleri → Task 7-8 ✓

---

## Son elle doğrulama listesi (extension)

1. Kod üret → geri sayım (`mm:ss`) görünür; süre bitince kod kaybolur, "Kodun süresi doldu" notu gelir
2. Arkadaş kod girince, kod-üreten tarafta kod kaybolur + "Kod kullanıldı" notu gelir
3. Aynı kodla ikinci bağlantı denemesi başarısız olur (OPK tüketilmiş)
4. Kimlik değişimi: biri kimlik sıfırlarsa karşı tarafta "Kimlik değişti — olası MITM" kartı görünür
5. "Eşleşmiyor" seçilirse aynı kişi yeni kodla bile bağlanamaz (denylist)
6. Yoğun mesaj akışında "Yoğun mesaj akışı engellendi" notu görünür, bağlantı kopmaz
7. 3'ten fazla eşzamanlı peer bağlanamaz ("Eşzamanlı bağlantı sınırı aşıldı")
