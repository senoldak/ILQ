# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (Chrome Extension — Manifest V3)

## Stack

Chrome eklentisi: vanilla JS + esbuild bundle. Yapı: `background.js` (service worker köprüsü) + `offscreen.html/js` (WebRTC + Signal protokolü) + `popup.html/css/js` (arayüz). Bağımlılıklar: `peerjs`, `@privacyresearch/libsignal-protocol-typescript`, `protobufjs` (güncel), `esbuild`.

## Users

Gazeteci, aktivist veya muhalif — yüksek riskli ortamda çalışan tek kullanıcı. Konuşmalar hayati gizlilik taşır; cihaz ve ağ düşmanca olabilir. Kullanıcı, mesajların yalnızca iki uç tarafından okunabilmesini ve hiçbir iz bırakmamasını talep eder. Üründe kalma kararı, gizliliğin görünür dürüstlüğüne bağlıdır.

## Product Purpose

Sunucusuz, sıfır saklamalı, uçtan uca şifreli (Signal protokolü: X3DH + Double Ratchet) P2P doğrudan mesajlaşma. Başarı: iki taraf yalnızca kendi cihazlarında yaşayan bir konuşmayı, araya hiçbir sunucu girmeden ve geride disk izi bırakmadan değiş tokuş eder.

## Positioning

Mesajların tek kopyası yalnızca iki konuşan cihazın RAM'inde var olan mesajlaşma. Kullanıcı adı ile buluşma ücretsiz herkese açık sinyal üzerinden; mesajlar hiçbir sunucuya değmez. "Hiçbir yerde saklanmıyor" iddiası teknik olarak gerçek ve doğrulanabilir.

## Operating Context

- İki taraf da aynı anda çevrimiçi olmalıdır — çevrimdışı kuyruk yoktur (sıfır saklama tasarımının doğal sonucu).
- Bağlantı kodu, güvenilir ikinci bir kanaldan (WhatsApp, yüz yüze) paylaşılır; kod tek kullanımlıktır.
- Kullanıcı adı önceden tanıtılmış olmalıdır.
- MITM'i elemek için güvenlik numarası (parmak izi) bağımsız bir kanaldan karşılaştırılır.
- Ortam potansiyel olarak düşmancadır: cihaz incelenebilir, ağ izlenebilir.

## Capabilities and Constraints

- Şifreleme: X3DH + Double Ratchet, `@privacyresearch/libsignal-protocol-typescript` (bakımlı port). İleri gizlilik + kimlik doğrulama.
- P2P: PeerJS + WebRTC DataChannel. Mesajlar iki cihaz arasında doğrudan akar.
- Sıfır kalıcılık: `chrome.storage`, `localStorage`, `IndexedDB` hiçbirinde kullanılmaz; tüm anahtar/oturum/mesajlar RAM'de, tarayıcı kapanınca yok olur.
- MV3 kısıtı: service worker'da WebRTC olmadığından P2P, offscreen document'da çalışır.
- Bağlantı kodu = prekey paketi; her görüşme için yeniden üretilir.
- NAT aşımı için ücretsiz STUN (Google); TURN bilinçli olarak eklenmez (o bir sunucu olurdu).
- Arayüz Türkçe. Tek cihaz; anahtarlar belleği asla terk etmez.
- Uçtan uca sesli arama: WebRTC medyası DTLS-SRTP ile şifrelidir; arama sinyali (SDP/ICE) Signal ratchet (k:14) ile taşınır ve sunucuya düz metin gitmez. Arama sinyali meta verisi (IP adresi) mevcut sinyal sunucusu tarafından görülebilir — mesajlardaki Double Ratchet anahtar dönüşü medya için geçerli değildir.
- Sesli mesajlar (k:13) mesaj ve sohbet yok etme kurallarına tabidir; kayıtlar 60 saniye ile sınırlıdır.
- Açık kararlar: çoklu cihaz, teslimat göstergeleri, kendi sinyal sunucusu, i18n, medya çağrısı (opsiyonel, DTLS-SRTP).

## Brand Commitments

- Ad: ILQ.
- Kullanıcı onayı: aydınlık, temiz, Signal benzeri; dürüst, sakin, güvenilir teknik ürün; yeşil vurgular; okunabilirlik önceliği. Riskli ortamda dikkat çekmemek, ürünün sakinliğiyle desteklenir.

## Evidence on Hand

- Kaynak kod; Signal protokolü akışı uçtan uca simülasyonla doğrulandı (kod üretimi → oturum → ratchet → parmak izi eşleşmesi).
- `npm audit` → 0 güvenlik açığı; `dist/` içinde kalıcı depolama API'si yok (grep ile doğrulandı).
- Mevcut incumbent UI (`src/popup.html/css`) — yeniden tasarımda yalnızca karşıt referanstır.
- Gerçek müşteri/başarı hikayesi/medya/testimonial yok; bunlar uydurulmamalıdır.

## Product Principles

1. **İz, düşmandır** — hiçbir şey hiçbir yere yazılamaz; kalıcılık teknik ihlaldir.
2. **Karanlıkta değil, doğrulamayla korun** — kanıtlanmış protokol + kullanıcının kendisinin karşılaştırdığı parmak izleri.
3. **Görünmez olmak kullanımın parçası** — sakin, ölçülü, güven veren bir yüz; gösteriş yok.
4. **Kullanıcıya dürüst kal** — çevrimdışı mesaj yokluğu ve kod tek kullanımı gibi sınırlar açıkça ifade edilir.
5. **Odaklı ve yalın** — tek konuşma, şişmeyen arayüz.

## Accessibility & Inclusion

Yüksek riskli ve değişken ortamlarda okunabilirlik önceliklidir: yüksek kontrast, net tipografi hiyerarşisi, büyük dokunma hedefleri. (Tasarım yönü kullanıcı tarafından onaylandı.)