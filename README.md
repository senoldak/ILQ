# ILQ — Sunucusuz P2P Güvenli Sohbet (Chrome Eklentisi)

Uçtan uca şifreli (Signal protokolü: X3DH + Double Ratchet), **sunucusuz** P2P mesajlaşma Chrome eklentisi. Mesajlar taraflar arasında doğrudan (WebRTC DataChannel) akar; **hiçbir mesaj diske yazılmaz**, her şey RAM'dedir.

## Güvenlik Modeli

| Özellik | Durum |
|---|---|
| Uçtan uca şifreleme | X3DH + Double Ratchet (libsignal protokolünün bakımlı TS portu) |
| İleri gizlilik (forward secrecy) | Evet — her mesajda anahtar döner |
| Canlı arama | DTLS-SRTP (WebRTC medyası) — uçtan uca; arama sinyali ratchet'li k:14; mesajlardaki Double Ratchet anahtar dönüşü medya için geçerli değildir |
| Sesli mesaj | Signal ratchet (k:13 parçalı akış), mesaj/sohbet yok etme kurallarına tabi, 60 saniye sınırı |
| Post-compromise onarımı | Evet — Double Ratchet |
| Kimlik doğrulama | Safety number (parmak izi) + bağlantı kodu; **doğrulanana kadar gönderim engellenir** |
| Bağlantı kodu görünümü | Taşıma kodu: **base64url(JSON)** — öneksiz, rastgele görünümlü dize. Prekey paketi sabit sıralı JSON dizi olarak taşınır (alan adları maskelidir). İçerik şifreli değildir, yalnızca taşıyıcıdır |
| Kalıcı saklama | **Yok** — `chrome.storage`, `localStorage`, `IndexedDB` kullanılmaz; diske hiçbir şey yazılmaz |
| Sunucu | Kendi sunucun yok; yalnızca PeerJS ücretsiz herkese açık sinyal + Google STUN (adres keşfi) — **kendi PeerJS + TURN sunucunu yapılandırabilirsin** |
| Kaynak | Açık, denetlenebilir; şifreleme elle yazılmadı, kanıtlanmış protokol kullanıldı |

## Kurulum

1. `npm install` (gerekli paketleri yükler)
2. `npm run build` (`dist/` klasörünü üretir)
3. Chrome'da `chrome://extensions` → sağ üstte **Geliştirici modu** aç
4. **Paketlenmemiş öğe yükle** → `dist/` klasörünü seç

## Kullanım (2 kişi gerekir)

1. **Kişi A:** Eklentiyi aç, "Sohbete başla" de → adresin otomatik üretilir
2. **Kişi A:** "Kod Üret" sekmesinde yeni kod üret → kodu güvenli bir kanaldan (ör. WhatsApp) **Kişi B'ye** gönder. Kod, rastgele görünümlü bir harf/rakam dizesidir
3. **Kişi B:** Eklentiyi aç → "Bağlan" sekmesinde **kodun tamamını** yapıştır → **Bağlantı kur**. Dikkat: arkadaşının **adresini** (20 haneli kısa kimlik) yapıştırmak olmaz; adres kodu değildir
4. **Güvenlik numarası (parmak izi)**: İki taraf da ekranda gördüğü numarayı bağımsız bir kanaldan karşılaştırsın. **Doğrulanana kadar hiçbir taraf mesaj gönderemez.** "Numaralar eşleşiyor" dedikten sonra sohbet açılır; "Eşleşmiyor" denirse bağlantı sonlandırılır.
5. **Sesli mesaj / çağrı:** kompozördeki mikrofon butonuyla sesli mesaj kaydet (60 sn); sohbet başlığındaki ses/görüntü butonlarıyla doğrulanmış eşe canlı arama başlat. Aramadaki medya DTLS-SRTP ile şifrelidir; arama için her iki eş de doğrulanmış olmalıdır.

> **Bağlantı kodu ne taşır?** Bağlantı kodu (`X3DH` prekey demetini) taşıyan bir dizedir: öneksiz base64url(JSON). Gövde sabit sıralı bir dizidir (alan adları maskeli): `[u, r, spkId, ik, spk, spkSig, opkId, opk]`.

## Özel Sinyal Sunucusu / TURN Yapılandırması

Gizlilik için varsayılan PeerJS genel bulutu (0.peerjs.com) ve Google STUN yerine kendi sunucularını kullanabilirsin. Giriş ekranındaki **"Ağ ayarları (gelişmiş)"** bölümünden:

- **Sinyal sunucusu:** `host` (örn. `peer.ornek.com`), `port`, `path`. PeerJS sunucusunu kendin barındırmak için `peerjs-server` paketini kullan.
- **ICE/TURN sunucuları:** JSON dizisi olarak TURN sunucusu eklersen simetrik NAT/toplu ağlarda bağlantı garanti edilir.

> Not: Özel bir sinyal sunucusu kullanırken `manifest.json` içindeki `host_permissions` listesine o sunucunun alan adını eklemeyi unutma. TURN sunucuları ayrı izin gerektirmez.

## Notlar / Sınırlar

- **Bağlantı kodu tek kullanımlıktır.** Her görüşme için yeni kod üretilir; her kod kendi benzersiz prekey'lerini kullanır (eski kodlar yeni kod üretilse bile geçersiz kalmaz).
- **Bağlantı kodu bir "koddur" — yalnızca tamamı çalışır.** Baştan/sondan karakter eksiltme, ekleme, değiştirme kodu bozar ve net hata verilir. Arkadaşına **tam kodu** kopyalayıp göndermesini söyle.
- **Adres ≠ kod.** 20 haneli kısa kimlik (örn. `4b2t7a6p7egzndfspeo2`) adrestir; bağlantı kurulmaz. Adres, karşı tarafın kodunda otomatik olarak bulunur.
- **Her iki taraf da eklentinin açık kalması gerekir** — mesajlar geçicidir, sunucuda saklanmaz, "çevrimdışı gelmemiş mesaj" yoktur. Bu, "asla saklanmasın" gereksiniminin doğal sonucudur.
- Uçtan uca şifreleme içerik garantisidir; **ancak sinyal/STUN sunucuları IP adresini ve bağlantı meta verisini görebilir** (mesajların içeriğini asla). Tam meta veri gizliliği istiyorsan kendi PeerJS sunucunu barındır ve TURN kullan.
- Ekstrem NAT/toplu ağlarda varsayılan STUN yetersiz kalırsa bağlantı kurulamayabilir — özel TURN sunucusu bu durumu çözer.
- **Güvenlik numarası doğrulanmadan mesaj gönderilemez** (gönderim, oturum düzeyinde de zorlanır; yalnızca arayüz değil).
- Alınan zarf boyutu ve mesaj uzunluğu sınırlandırılmıştır; bağlantı kapandığında oturum kayıtları RAM'den temizlenir.
- **Arama meta verisi:** çağrı sinyali (SDP/ICE) Signal-şifreli taşınır ancak sinyal sunucusu IP adresini görür; tam meta veri gizliliği için kendi PeerJS + TURN'unu barındır.
- **Zil yalnızca açık panelde:** gelen arama panel açıkken görünür; üçüncü taraf bildirim yoktur.
- **Kamera/mikro izni:** izin verilmezse sesli mesaj/çağrı başlatılamaz; videoda izin hatası otomatik sese düşmez.

## Proje Yapısı

```
src/
  manifest.json        MV3 manifest
  background.js        Service worker: offscreen doc yönetimi + mesaj köprüsü
  offscreen.js         P2P (PeerJS) + Signal protokolü + RAM-only store
  offscreen.html       Offscreen document (WebRTC'nin çalıştığı yer)
  codec.js             Bağlantı kodu: fields <-> base64url(JSON dizi) — öneksiz, maskeli
  popup.html/css/js    Kullanıcı arayüzü
build.js               esbuild ile dist/ üretir
```

## Güvenlik Doğrulaması

- `npm audit` → **0 güvenlik açığı** (eski `libsignal-protocol` + savunmasız `protobufjs@5` yerine bakımlı TS portu + güncel `protobufjs@8` kullanıldı)
- `dist/` içinde `chrome.storage` / `localStorage` / `IndexedDB` kullanımı **yok** (grep ile doğrulandı)
- X3DH + Double Ratchet uçtan uca simülasyonla doğrulandı (ilk PreKeyWhisperMessage → oturum → ratchet → fingerprint eşleşmesi)

## Lisans

Kod AGPL-3.0'a uygun kütüphanelere dayanır. Kendi kodunuzda kullanmadan önce bağımlılık lisanslarını inceleyin.
