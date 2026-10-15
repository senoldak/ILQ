# ILQ Medya Desteği — Tasarım Spesifikasyonu

Tarih: 2026-08-12
Durum: Onaylandı
Kapsam: Sesli mesaj + canlı sesli arama + canlı görüntülü arama (tek paket)

---

## 1. Amaç

ILQ sohbetine üç medya yeteneği eklenir:

1. **Sesli mesaj** — kayıt yapıp Signal-şifreli, parçalı gönderimle sohbette oynatılabilir biçimde paylaşmak.
2. **Canlı sesli arama** — iki eş arasında gerçek zamanlı ses (WebRTC MediaStream).
3. **Canlı görüntülü arama** — aynı arama içinde kamerayla video.

Ürün felsefesi korunur: sunucusuz, sıfır saklamalı (RAM-only), uçtan uca şifreli, "doğrulanana kadar gönderim yok" kuralı.

## 2. Güvenlik Modeli

| Taşıma | Şifreleme | Garanti |
|---|---|---|
| Sesli mesaj | X3DH + Double Ratchet (Signal, `entry.cipher.encrypt`) | Mesajlarla birebir aynı; forward secrecy korunur |
| Canlı arama medyası | DTLS-SRTP (WebRTC) | Uçtan uca; çağrı başına anahtar, mesaj başına dönüş yok |
| Arama sinyali (SDP/ICE) | Signal ratchet (k:14 envelope) | Sinyal içeriği broker'a düz metin gitmez; broker yine varlık bağlantısı / IP meta verisini görür (mevcut modelin uzantısı) |

**Doğrulanmış eş şartı (her iki uçta, offscreen'de zorlanır):**
- `entry.verified === false` ise arama başlatılamaz: `startCall` rölesi hiç başlatılmaz, hata döner.
- Gelen aramada (`k:14 c:'request'`) `entry.verified === false` ise otomatik `c:'reject'` gönderilir + bildirim; medya asla kurulmaz.
- Sesli mesaj gönderimi, mevcut `sendMessageTo` gibi `entry.verified` şartına tabidir.
- Bu kural yalnızca arayüzle değil, offscreen protokol seviyesinde uygulanır.

**Belgeleme:** `PRODUCT.md`'ye "açık kararlar" bölümüne şu not eklenir:
> Canlı arama medyası DTLS-SRTP ile uçtan uca şifrelidir; mesajlardaki Double Ratchet anahtar dönüşü medya için geçerli değildir. Arama sinyali meta verisi (IP adresi) mevcut sinyal sunucusu tarafından görülebilir.

**RAM-only:** Ses blob'ları, `URL.createObjectURL` oynatıcı kayıtları ve çağrı durumu RAM'de yaşar. `chrome.storage`/`localStorage`/`IndexedDB` kullanılmaz. Panik/sıfırlama tüm track'leri `stop()`, URL'leri `revokeObjectURL` eder, çağrıyı kapatır.

## 3. Mimari

### 3.1 Dosya değişiklikleri

- **`src/voice.js`** (yeni): panel (popup.js) tarafı yardımcıları — kayıt (MediaRecorder), çağrı RTCPeerConnection kurulumu (offer/answer/ICE, stream toplama), süre/format sınırları. UI olmayan, saf yardımcı modül; `popup.js`'e import edilir (build.cjs `popup.js`'i zaten bundle eder).
- **`src/offscreen.js`**:
  - k:13 sesli mesaj kanalı (parça akışı, yok etme zamanlayıcıları, RAM temizliği).
  - k:14 çağrı sinyal rölesi: envelope kabul listesine 13,14 eklenir (satır 661).
  - `state.call` çağrı kaydı + doğrulanmış eş zorlama (gelen k:14 'request'te `entry.verified` yoksa otomatik k:14 'reject' + `callBlocked` bildirimi).
  - panic/reset/cleanupConn çağrı temizliği.
- **`src/offscreen.html`**: değişmez — sıfır saklama ilkesi korunur; çağrı medyası panelde yaşar.
- **`src/sidepanel.html`**:
  - Composer'a sesli kayıt butonu (mikrofon ikonu).
  - Overlay bileşenleri: outbound zil, inbound zil, aktif çağrı (ses/video).
  - Video elementleri (`remoteVideo`, `localVideo`).
- **`src/sidepanel.css` / `src/popup.css`**: sesli mesaj fişi stili (oynat/duraklat, ilerleme çubuğu, süre), çağrı overlay stili. Mevcut DESIGN.md token'larına uyulur (sıcak kemik, manila, mum yeşili yalnızca doğrulanmış, tek kırmızı RET).
- **`src/i18n.js`**: yeni çeviri anahtarları (tr/en) — kayıt, oynatma, çağrı durumları, kabul/red, hatalar.
- **`src/manifest.json`**: `permissions` dizisine `"audioCapture"` eklenir (videoCapture zaten var).
- **`PRODUCT.md`**: güvenlik notu (Bölüm 2).
- **`README.md`**: yeni yetenekler + "özel sinyal/TURN" ve sınır notları.

### 3.2 Veri akışı — sesli mesaj

```
popup:  getUserMedia({audio}) → MediaRecorder → 60sn limit → blob(webm/opus)
        → sendToOffscreen('sendVoiceMessage', {username, bytes, mime, expSeconds})
                        ↓
offscreen: k:13 — Signal-şifreli parça akışı (64KB parça, 65ms pompa)
        → rate-limit kontrolü, doğrulanmış eş şartı
                        ↓
alıcı offscreen: parçaları state.voice[username] Map'inde birleştir
        → notify('voiceMessage', {from, mid, bytes, mime, ts})
                        ↓
alıcı popup: Blob(bytes, {type:mime}) → URL.createObjectURL → oynatıcı fişi (data-mid)
```

- Parça gövdesi JSON: `{m: mid, idx, total, bytes: base64url}` — opsiyonel `mime` yalnızca `idx === 0` parçasında taşınır.
- `VOICE_CHUNK_SIZE = 64 * 1024`, `VOICE_MAX_SECONDS = 60`.
- Parça pompası dosya transferiyle aynı desen (`sendFileChunks`'taki `setTimeout(pump, 65)`); token-bucket rate limit'ine takılmayı önlemek için dosya ile aynı ritim.
- Alıcı bütçesi: dosya için `filesBytesFor` benzeri peer başına ses tampon limiti (ör. 8 MB).
- Tekrar eden/üst üste gelen parça sessizce atılır (`idx` zaten dolduysa).
- Eksik parça toleransı: `received >= total` şartı aranır; tamamlanmayan kayıtlar RAM'de bekler, peer kapanınca temizlenir.

**Süre/yok etme:** Sesli mesajlar mesaj süresi (`expirySelect`) ve sohbet zamanlayıcısına (`chatTimer`) tabidir. Gönderen: `setRecallWindow` benzeri mid takibi; alıcı: `scheduleMessageExpiry` + `scheduleChatExpiryForMessage` — `expired` event'i balonu kaldırır. Popup tarafında `window.__voiceUrls[mid]` bloğu için `URL.revokeObjectURL` yok etmede çağrılır.

### 3.3 Veri akışı — canlı arama

**Mimari gerçek (doğrulandı):** PeerJS `peer.call()` offscreen'de yaşar; offscreen görünmez olduğundan videoyu gösteremezsin, `MediaStream` nesnesi de `chrome.runtime` mesajıyla kontekstler arası taşınamaz, ve aynı peer ID ile ikinci bir `Peer` örneği broker'da çakışır. `peer.call()` yaklaşımı **iptal edildi**.

**Benimsenen mimari:**
- **Medya + RTCPeerConnection side panel'de yaşar** (görünür kontekst). Her iki tarafta da kendi `RTCPeerConnection`'ı kurulur; `getUserMedia` ve video elementleri panelde.
- **Sinyalleme (SDP offer/answer + ICE candidate) mevcut Signal-ratchet'li DataChannel'dan geçer.** Yeni `k:14` kanalı. Offscreen yalnızca röledir: panele ait `startCall`/`callSignal` iletisini alır, `entry.cipher.encrypt` ile şifreler, karşı tarafa `k:14` envelope olarak gönderir; gelen `k:14`'ü deşifre edip `notify('callSignal', ...)` ile panele iletir.
- SDP/ICE meta verisi dahi broker'a düz metin gitmez (ratchet'li envelope içinde). Medya DTLS-SRTP ile uçtan uca.

**Akış:**

```
caller panel:  startCall({username, mode}) → offscreen kontrolleri → getUserMedia(mode)
        → RTCPeerConnection kur → addTrack → createOffer → callSignal({c:'request', mode, desc})
caller offscreen: startCall doğrulaması (verified + tek aktif) → k:14 şifrele → gönder
        ↓
callee offscreen: k:14 deşifre → entry.verified kontrolü:
        verified değilse → k:14 'reject' otomatik + notify('callBlocked', {from}) ; medya asla kurulmaz
        verified ise → notify('callSignal', {from, c:'request', mode, desc})
        ↓
callee panel:  zil overlay (gelen arama: kabul/red)
        kabul → getUserMedia(mode) → RTCPeerConnection → setRemoteDescription → createAnswer
                → callSignal({c:'answer', desc}) ; ekran lokal+uzak video
        red    → callSignal({c:'reject'})
        ↓
caller panel:  k:14 'answer' gelince setRemoteDescription(remote) → bağlantı aktif
        her iki taraf: onicecandidate → callSignal({c:'ice', candidate}) (iki yönlü)
        ↓
medya: DTLS-SRTP P2P akış; ontrack → remoteStream → remoteVideo.srcObject
        yerel stream muted önizleme (localVideo)
```

- **Röle komutları (offscreen):** `startCall({username, mode})` → kontroller → `cipher.encrypt({callId, c:'request', mode})`. Panel ayrıca `c:'ice'`, `c:'answer'`, `c:'reject'`, `c:'end'` gönderir — hepsi k:14 envelope. Gelen k:14 → deşifre → `notify('callSignal', {from, ...})`.
- **callId:** çağrı kimliği, arayan taraf üretir (randomMid); kabul eden aynı callId'yi taşır. `state.call = { callId, username, mode, phase }` — tek aktif aramanın taşıyıcısı.
- **Doğrulama zorlaması:** 
  - Arayan: offscreen `startCall`'da `entry.verified` yoksa hata döner, medya isteği hiç başlatılmaz.
  - Onaylayan: gelen `c:'request'` için offscreen `entry.verified` yoksa otomatik reject + bildirim; panel'e izleme dahi aktarılmaz.
- **İptal/sonuç:** her iki tarafta `RTCPeerConnection.close()`; caller `c:'end'` veya bağlantı (`k:14` data channel) kapanınca diğer taraf da kendi `pc.close()`, track'leri `stop()`, `state.call=null`, overlay kapanır. `cleanupConn`’da aynı eşte aktif çağrı varsa temizlenir.
- **Mute/video toggle:** panelde `localStream.getTracks()` `.enabled` ayarı — medya akışı durur, sinyal/meta bilgi gönderilmez.
- **Kamera/mikro izin reddi:** `getUserMedia` hatası → hata bildirimi; otomatik sese düşme yok. Kullanıcı sesli aramayı elle başlatır.

### 3.4 Çağrı durum makinesi (panelle eşgüdümlü)

Offscreen `state.call = null | { callId, username, mode, phase: 'outgoing'|'incoming'|'active'|'closed' }` — tek aktif çağrının kimlik/doğrulama hakemidir; RTCPeerConnection kendisi panelde yaşar.

- `startCall(username, mode)`: `entry.verified` kontrolü → `state.call` boş olmalı → `state.call = {callId, username, mode, phase:'outgoing'}` → panele k:14 'request' rölesi (`notify('callSignal', ...)`).
- Gelen k:14 'request': `entry.verified` yoksa otomatik k:14 'reject' + `notify('callBlocked', {from})`; varsa `state.call = {..., phase:'incoming'}` + `notify('callSignal', {from, c:'request', ...})`.
- Panel kabul: `c:'answer'` rölesi → `phase='active'`. Panel red/iptal: `c:'reject'` rölesi → `state.call=null`.
- `c:'ice'`: iki yönlü sıradan röle (durum değişmez).
- `c:'end'` / data channel kapanması / `cleanupConn`: `state.call=null` + panele `callEnded` bildirimi (pc.close + track stop panelde).
- Mute/video toggle: panelde local track `.enabled` — sinyal gönderilmez.
- `panic`/`resetIdentity`/`resetAll`: `state.call=null` + panele `callEnded` — panel pc.close + track stop + overlay kapanışı.

### 3.5 Popup/UI

- **Sesli mesaj fişi**: oynat/duraklat düğmesi, ilerleme çubuğu (audio timeupdate), süre, `data-mid`; gönderilen tarafta durum (✓ gibi) opsiyonel — yok etme süreleri `expired` akışıyla. `window.__voiceUrls[mid]` blob URL'si yok etmeye/paniğe revoke.
- **Composer**: mikrofon butonu — tıkla → kayıt başlar (buton kırmızı, geri sayım 60→0, dur/iptal), stop → kayıt gönderime hazır → "gönder" (mevcut send akışına bağlantı). Gönderim için `activePeer` gerekir; verified gereklidir (offscreen zorlar).
- **Çağrı overlay**: `overlay` katmanı (sohbetin üstünde, sohbet aktif). Durumlar: outgoing ("çağrılıyor… kişi" + iptal), ringing ("gelen arama kişi — kabul/red"), active (uzak video/avatar + yerel önizleme + mute + videoToggle + bitir + süre). `kamerasız` durumda avatar + ses dalgası gösterimi.
- **Entegrasyon i18n**: tüm yeni metinler `i18n.js` tr/en.
- Video render: medya ve `<video>` elementleri panelde yaşar; offscreen render gerekmez (mimari, bu kısıttan kaçınır).

## 4. Tutarlılık & YAGNI

Kapsam dışı:
- Cihaz/kamera seçici, kamera değiştirme (flip), ekran paylaşımı.
- Ses filtreleri/efektler.
- Aramada codec/kalite ayarı (WebRTC kendi seçer).
- Arama kaydı (recording) — görüşme asla saklanmaz.
- Bildirim sistemi (zil yalnızca panel açıkken görünür).
- Video izin hatasında otomatik sese düşme (net hata; kullanıcı sesli aramaya elle döner).

Ürün felsefesi korunur: RAM-only, verified şartı, tek aktif arama, arayüz dili.

## 5. Test Stratejisi

- `npm test` deseni (`node --test tests/**/*.test.mjs`), dosya transferi testleriyle aynı yaklaşım.
- `tests/voice.test.mjs` — k:13 parça akışı: parça sayısı, eksik parça, duplicate parça sessiz atma, alıcı bütçesi, tamamlama, boş/geçersiz parça.
- `tests/call.test.mjs` — state makinesi: verified şartı (başlat + kabul), tek aktif, ikinci çağrı reddi, close temizliği, panic/reset temizliği, temiz track stop.
- Manuel checklist: iki taraf — sesli mesaj al/gönder/oynat, sesli arama, görüntülü arama, kabul/red, yok etme süreleri, panik.
- **Ön koşul (P0):** panel (side panel) bağlamında `RTCPeerConnection` + `getUserMedia` doğal çalışmalıdır; k:14 rölesi offscreen'de Signal-şifreli olarak çalışmalıdır. Bu, gerçek iki-chrome-manuel testiyle doğrulanır.

## 6. Açık Riskler

1. **Panel bağlamında RTCPeerConnection** — side panel normal bir uzantı sayfasıdır; WebRTC + getUserMedia burada desteklenir (mimari bunu varsayar). P0 olarak doğrulanır; desteklenmiyorsa arama ertelenir, sesli mesaj yine de tamamlanır.
2. **Ses parça akışı bütçesi** — peer başına tampon limiti (8 MB) aşımında parçalar sessizce düşer.
3. **Zil yalnızca açık panelde** — kabul edildi (üçüncü taraf bildirim yok).
4. **k:14 sinyal eşleşmesi** — callId tabanlı eşleşme; eşleşemeyen sinyal sessizce atılır.