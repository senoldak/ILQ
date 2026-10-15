# Güvenlik & Gizlilik Paketi — Tasarım Spec'i

**Tarih:** 2026-08-10
**Proje:** ILQ (sunucusuz P2P, Signal protokollü, RAM-only uçtan uca şifreli Chrome eklentisi)

## Amaç

Mevcut güvenlik/gizlilik denetiminden çıkan 5 yüksek etkili boşluğu kapatmak:
- **G1:** Tanıdık peer kimlik anahtarını değiştirdiğinde kullanıcıya uyarı verilmiyor (sessiz MITM riski).
- **G2/G3:** Bağlantı kodu tek kullanımlık/süreli değil; kod kimlik + imzalı prekey + regId içeriyor ve uzun süre geçerli kalıyor.
- **G4:** Reddedilen kimlikler hatırlanmıyor (blocklist yok).
- **G10:** Gelen mesajlar için rate-limit ve eşzamanlı peer sınırı yok (flooding/DoS).
- **P7:** Kod kullanılınca ekrandan silinmiyor; 15 dk geri sayım gösterilmiyor.

## Yaklaşım

Yerinde (inline) uygulama: tüm mantık mevcut `src/offscreen.js`, `src/popup.js`, `src/sidepanel.html`, `src/popup.css` dosyalarında yeni fonksiyon/veri alanı olarak eklenir. Yeni modül oluşturulmaz (build/config değişmez, CommonJS/ESM kopyalama zahmeti doğmaz).

## 1. Veri Modeli

### `RamStore` (offscreen.js:47-77) genişletmeleri
- `denylist: Set<base64Key>` — "Eşleşmiyor" denen kimlik anahtarları. `isTrustedIdentity` denylist'teki anahtar için `false` döner.
- `trustedKeys: Map<username, base64Key>` — "Numaralar eşleşiyor" denen güncellenmiş kimlikler. Mevcut `trusted` alanı (identifier -> pubKey) bunun yerini alır (aynı Map tipi, davranış korunur).
- `lastRejectedIdentityKey: base64Key | null` — `isTrustedIdentity` `false` döndüğünde reddedilen **yeni** kimlik anahtarı buraya yazılır (RAM'de, tek giriş). Kimlik değişimi yakalamasının taşıyıcısıdır.

> **Önemli nesnel gerçek:** libsignal-ts kütüphanesinde `UntrustedIdentityError` sınıfı YOKTUR. Güvenilmez kimlik üç yerde de genel `Error` olarak atılır (`session-builder.js:45` `'Identity key changed'`, `session-builder.js:232` `'Unknown identity key: ...'`, `session-cipher.js:293` `'Identity key changed'`) ve **yeni anahtarı taşımaz**. Yeni anahtar, bu hataların her öncesinde `store.isTrustedIdentity(identifier, pubKey)` çağrısına parametre olarak zaten gider; bu yüzden reddedilen anahtar store içinde saklanır. Tüm kimlik-değişimi tespiti bu ortak noktadan yapılır.

### `state` (offscreen.js:88-97) eklemeleri
- `rateBuckets: Map<username, { tokens, last }>` — token-bucket state'i (gelen mesajlar).
- `pendingCodeExp: number | null` — üretilen son kodun `exp`'i; k:3 başarılı decrypt'te "kod kullanıldı" (`notify('codeUsed')`) tetiklemesi için.
- `peers` içindeki her entry'ye `rateLimitNotified` bayrağı.

### Kod süresi mekanizması (codec.js değişikliği)
- `encodeCode`: üretilen koda `exp` (expiry, epoch-ms) alanı eklenir: `Code = { u, r, ik, spkId, spk, spkSig, opkId, opk, exp }`.
- `decodeCode` / `connectWithCode`: `exp`'i okur; **yoksa** (eski kodlarla geriye dönük uyum) kod yine de kabul edilir (exp yok = süre sınırı yok). `exp` geçmişse → kod geçersiz.
- OPK (one-time prekey) zaten libsignal tarafından `store.removePreKey` ile tüketilir → bir OPK yalnızca bir kez kullanılabilir; bu, kodun "tek kullanımlık" garantisini sağlar.

## 2. Kod Yaşam Döngüsü (G2/G3 + P7)

### Sabit
`CODE_TTL_MS = 15 * 60 * 1000`

### `generateCode` (offscreen.js:160-178)
- `encodeCode`'a `exp: Date.now() + CODE_TTL_MS` eklenerek yeni kod üretilir.
- **Önceki kodlar geçersiz kılınır:** `generateCode` çağrıldığında, store'daki **eski one-time prekey'ler** silinir (RAM-only store; tüm OPK id'leri temizlenir). Böylece önceki koddaki OPK tüketilemez olur ve eski kod artık çalışmaz. Kullanıcı yeni kod ürettiğinde sızan eski kodun ömrü biter.
- SPK'lar oturum devamı için saklanır (silinmez); ancak `exp` süresi, kodun çok uzun süre geçerli kalmasını önleyen ana mekanizmadır.

### `connectWithCode` (offscreen.js:278-325)
- `parseCode` sonrası: `exp` varsa ve `Date.now() > exp` ise → `throw new Error('Kodun süresi doldu veya geçersiz')`.
- OPK tüketimi (libsignal `processPreKey` içinde) zaten tek kullanımı garantiler; aynı kodla ikinci giriş, store'da OPK bulunamadığı için başarısız olur.
- **Initiator tarafı kimlik değişimi:** `builder.processPreKey(device)` de `store.isTrustedIdentity` çağırır (`session-builder.js:43`); kayıtlı anahtar farklıysa `'Identity key changed'` atar ve `store.lastRejectedIdentityKey` set edilir. Bu hata yakalanır: `notify('fingerprint', { username: remoteUsername, fingerprint, reason: 'changed' })` gönderilir (fingerprint yeni anahtardan hesaplanır — `parsed.ik` zaten elde), bağlantı kurulmaz, hata "Kimlik değişti — güvenlik numarasını doğrula" mesajıyla popup'a yansır. Kullanıcı "Numaralar eşleşiyor" derse `acceptNewIdentity` çağrılır, ardından bağlantı yeniden denenebilir.

### Popup: geri sayım (P7)
- `case 'code'` → `sendToOffscreen('generateCode')` dönüşü artık `{ ok, code, exp }`.
- `#generatedCode` gösterilir; `exp`'ye göre 15 dk geri sayım metni (örn. `14:32`) her saniye güncellenir (popup tarafında `setInterval`; `exp` bilgisi kod-üreten A'nın ekranındadır).
- **Kodun kullanıldığını A nasıl öğrenir:** B (kodu giren) tarafında `connectWithCode` başarısında B'nin ekranında bir "kod gösterimi" yoktur (B'de giriş alanı vardır). A, kendi kodunun kullanıldığını B'den gelen **yeni oturum kurulum mesajıyla** (k:3 PreKeyWhisperMessage, `handleIncoming` başarılı decrypt) öğrenir. Bu noktada A:
  - `notify('codeUsed')` → popup `#generatedCode` temizler, "Kod kullanıldı" notu gösterir, geri sayım durur.
- Süre bitince popup `#generatedCode` temizler, "Kodun süresi doldu" notu gösterir; geri sayım durur. (Süre bitiminde popup kendi `setInterval` callback'inden `Date.now() > exp` kontrolü yapar.)

## 3. Kimlik Değişimi Uyarısı (G1) + Blocklist (G4)

### `isTrustedIdentity` (offscreen.js:58-63)
- Denylist kontrolü eklenir: anahtar `store.denylist`'teyse `false` döner.
- İlk temas (kayıt yok) TOFU dür: `true` döner.
- Kayıtlı anahtar farklıysa: `store.lastRejectedIdentityKey = key` yazılır, `false` döner.

### `handleIncoming` (offscreen.js:329-374)
- k:3 ve k:1 dalları: `decryptPreKeyWhisperMessage`/`decryptWhisperMessage` çağrıları `try/catch` içinde; **kimlik hatası ayrı** yakalanır (`e.message === 'Identity key changed' || /Unknown identity key/.test(e.message) || store.lastRejectedIdentityKey`).
- Yakalanınca: mesaj işlenmez, `notify('fingerprint', { username: remoteUsername, fingerprint, reason: 'changed' })` gönderilir (fingerprint, `store.lastRejectedIdentityKey`'den `FingerprintGenerator` ile hesaplanır; `maybeIntroduce` ile aynı kod). Bağlantı açık kalır; kullanıcı karar versin.
- Diğer hatalar (bozuk mesaj vb.) mevcut genel "Mesaj çözülemedi" yoluna düşer.

### Yeni offscreen eylemleri
- `acceptNewIdentity(username)` — yeni anahtar `store.lastRejectedIdentityKey`'den alınır; `store.trustedKeys`'e (`store.saveIdentity` aracılığıyla, aynı identifier) yazılır, `store.lastRejectedIdentityKey = null` yapılır, `state.peers` girişi sıfırlanır (cipher/verified temizlenir), `notify('accepted')` döner. Sonraki gelen/giden mesaj normal akışla oturumu yeniden kurar.
- `rejectFingerprint` (offscreen.js:463-474) — mevcut davranışa ek: ilgili anahtarı `store.denylist`'e ekler.

### Popup tarafı (G1)
- `case 'fingerprint'` notify'ına `reason` alanı eklenir: `'new'` (ilk temas / kod bağlantısı) veya `'changed'` (kimlik değişimi).
  - `reason === 'new'` → panel normal "güvenlik numarası" başlığıyla gösterilir (`#fpToast` yeniden kullanılır, `case 'fingerprint'` ile aynı render).
  - `reason === 'changed'` → panel "Kimlik değişti — olası MITM" başlığıyla gösterilir.
- Butonlar:
  - **"Numaralar eşleşiyor"** → `sendToOffscreen('acceptNewIdentity', { username })`; başarıdaysa `setTrustVerified(true)` + `#fpToast` gizlenir.
  - **"Eşleşmiyor"** → `sendToOffscreen('rejectFingerprint', { username })` → denylist'e eklenir; `#fpToast` gizlenir, "Kimlik engellendi" hatası gösterilir.

### `resetIdentity` (offscreen.js:476-490)
- `store.denylist`, `store.trustedKeys`, `state.rateBuckets`, `state.pendingCodeExp` temizlenir (yeni `RamStore`; ayrıca generateCode'un sildiği eski OPK'lar da zaten yeni store'da yoktur).

## 4. Rate-Limit + Peer Cap (G10)

### Sabitler
`RATE_LIMIT_PER_SEC = 20`, `PEER_LIMIT = 3`

### `checkRate(username)` — yeni token-bucket
```
const now = Date.now(); const sec = 1000;
let b = state.rateBuckets.get(username);
if (!b) { b = { tokens: RATE_LIMIT_PER_SEC, last: now }; state.rateBuckets.set(username, b); }
b.tokens = Math.min(RATE_LIMIT_PER_SEC, b.tokens + (now - b.last) / sec * RATE_LIMIT_PER_SEC);
b.last = now;
if (b.tokens < 1) return false;
b.tokens -= 1;
return true;
```

### `handleIncoming` (offscreen.js:355, envelope tipi doğrulamalarından sonra)
- `if (!checkRate(remoteUsername)) return;` — token yoksa envelope sessizce atılır; bağlantı kapatılmaz.
- İlk aşımda bir kez (entry.`rateLimitNotified` değilse) `notify('rateLimited', { username: remoteUsername })`; bayrak set edilir.

### Peer cap
- `handleIncoming` en başında (peer `state.peers`'a eklenmeden önce): gelen peer `state.peers`'da **kayıtlı değilse** ve `state.peers.size >= PEER_LIMIT` ise → envelope işlenmez, `notify('error', { message: 'Eşzamanlı bağlantı sınırı aşıldı' })`.
- Yani mevcut oturumlu peer'lar sınırlamadan etkilenmez; yalnızca **yeni** peer bağlantıları kapıdan geçer.
- Not: `connectWithCode` initiator tarafı da yeni kayıt açarken aynı limiti kontrol eder (kendi `state.peers` boyutu için), tutarlı davranış sağlanır.

### Popup (rateLimited)
- `case 'rateLimited'` → tek seferlik not: "Yoğun mesaj akışı engellendi".

## 5. Test Stratejisi

`session_sim.mjs`'e yeni bloklar (mevcut 30 testin üzerine):
1. **Kod yaşam döngüsü:** `encodeCode`/`decodeCode` ile `exp` alanı round-trip; `exp` geçmiş kod → geçersiz; `exp`'siz eski format kod → hâlâ kabul.
2. **OPK tüketimi:** aynı one-time prekey id'si ikinci kez kullanılınca `store.removePreKey` sonrası bulunamaz → tek kullanım garantisi.
3. **Blocklist:** denylist'teki anahtar için `isTrustedIdentity` → false.
4. **Kimlik değişimi (receiver):** farklı anahtar + mevcut trusted kaydı → decrypt `'Unknown identity key'` hatası + `lastRejectedIdentityKey` set edildi (sim'de gerçek libsignal decrypt ile).
5. **Kimlik değişimi (initiator):** farklı anahtar + mevcut trusted kaydı → `processPreKey` `'Identity key changed'` hatası + `lastRejectedIdentityKey` set edildi.
6. **Rate-limit:** 20 token dolu → 21. istek reddedilir; kova yenilenmesi 1 sn bekleme ile doğrulanır.
7. **Peer cap:** 3 kayıt doluyken yeni peer → reddedilir.

**Elle doğrulama (UI):**
- Kod üret → geri sayım görünür; 15 dk sonra kaybolur.
- Arkadaş kodu kullanınca kendi panelinde kod kaybolur + "kullanıldı" notu.
- Kimlik değişiminde panel "Kimlik değişti — olası MITM" gösterir; "Eşleşmiyor" → sonraki bağlantı engellenir.
- Yoğun mesaj akışında not görünür, bağlantı kopmaz.

## Kapsam Dışı
- `sender.id` savunma-derinliği (G5), açık CSP bildirimi (G13) — ayrı küçük iyileştirmeler.
- Self-hosted signaling sunucusu (P10) — operasyon işi.
- TURN/metadata dokümantasyon notu (P8), `__ilq_init__` rezervi (P9).

## Kısıtlar (Global)
- RAM-only: hiçbir depolama API'si kullanılmaz; tüm yeni durum RAM'dedir.
- UI dili Türkçe.
- Build: `node build.js`. Test: `node session_sim.mjs`.
- Mevcut güvenlik numarası doğrulama kapısı (popup.js:148, offscreen.js:265/288) değişmeden korunur.