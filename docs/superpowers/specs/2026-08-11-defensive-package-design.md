# Paket 3 Tasarımı: Düşman Ortam Savunması

Tarih: 2026-08-11
Durum: Onaylandı (kullanıcı)

## Bağlam

ILQ, sunucusuz P2P + Signal protokolü (X3DH) kullanan, RAM-only Chrome
extension'dır. Bu spec; panik modu, tuzak ekran, kod süre dolumu, otomatik
yok etme ve ekran koruması özelliklerini kapsar. Paket 4 (sohbet
deneyimi) ile paylaşılan zarf ailesi mimarisi [2026-08-11-experience-package-design.md]
içinde tanımlıdır; bu spec yalnızca savunma paketini detaylandırır.

## Kullanıcı kararları (özet)

- Panik modu: ekran butonu + klavye kısayolu; tüm RAM izlerini siler; masum ekrana döner
- Tuzak ekran: tek sabit görünüm
- Kod süre dolumu: varsayılan 5 dakika
- Otomatik yok etme: sohbet düzeyinde + mesaj düzeyinde; varsayılan kapalı
- Ekran koruması: azaltma (honest) — OS düzeyinde tam engelleme yapılamaz

## Mimari: A — tek zarf ailesi (onaylandı)

Mevcut `k` zarf sistemi genişler; tüm yeni özellikler şifreli gövdenin
içinde yeni k-türleriyle taşınır. Tek decrypt katmanı, geriye dönük uyumlu.
Ortak zarf türleri ve `state` yapısı Paket 4 spec'inde tanımlıdır.

Bu pakete özgü k-türü:

| k | Anlam |
|---|-------|
| 11 | zamanlayıcı senkronu (sohbet yok etme süresi değişikliği) |

## Bölüm 1 — Panik Modu

### 1.1 Tetikleyiciler

- Sohbet ekranı üst barında sabit "Panik" danger butonu.
- Klavye kısayolu (hedef: background.js global shortcut, MV3 kısıtlarına tabi;
  popup açıkken alternatif Ctrl+Shift+X dinleyicisi). Kısayol popup kapalıyken
  çalışması MV3'te netleştirilir; çalışmıyorsa yalnızca ekran butonu sunulur
  ve UI'da dürüstçe duyurulur.

### 1.2 Etki (geri alınamaz, iki adımlı onay yok — panik ani olmalı)

1. Tüm `state.peers` bağlantıları kapatılır (`destroy()`), peers temizlenir.
2. `state.store` = yeni `RamStore()` — anahtarlar, oturumlar, güven, denylist,
   adres defteri hepsi RAM'den düşer.
3. Alınmakta/gönderilmekte olan dosyalar (kısmi parçalar dahil) atılır.
4. `state.decoy = true`; popup tuzak ekrana geçer; kimlik çubuğu "yeni kimlik"
   durumuna döner.

### 1.3 Tuzak ekran

- Tek sabit görünüm: zararsız içerik (örn. hava durumu/haber görünümlü tabela),
  etkileşimsiz, sahte veri. Açıldığında gerçek uygulama verisi yoktur.
- Geri dönüş: yalnızca "Uygulamayı yeniden başlat" — yeni kimlik + temiz state
  (resetIdentity akışıyla aynı sonucu doğurur).

## Bölüm 2 — Kod Süre Dolumu

### 2.1 Üretim

- `bootstrapIdentity()` / kod üretiminde `state.codeExpiresAt = now + 5 * 60 * 1000` (5 dk).
  Sabit: `CODE_TTL_MS`.

### 2.2 Kabul

- Kod ekleme akışı `codeExpiresAt` kontrol edilir; geçmişse reddedilir:
  "Kod süresi doldu — yeni kod üret". Süresi geçmemiş kod normal işlenir.
- Kod gösteriminde mono geri sayım (kalan süre) görüntülenir; sıfırlanınca
  gösterim "süresi doldu" olur ve üretim butonu vurgulanır.

## Bölüm 3 — Otomatik Yok Etme

### 3.1 Sohbet düzeyi

- Seçili sohbet için sabit süre seçenekleri: yok / 30s / 5dk.
- Değişiklik k:11 ile karşıya bildirilir (şifreli); alıcı aynı süreyi ayarlar.
- Her iki uçta `ts + süre` erişildiğinde mesajlar RAM'den düşer;
  popup geçmişten kaldırılır. Teslimat doğrulaması (k:6) ayrı zarf türüyle
  işlenir (Paket 4); yok etme bu doğrulamadan bağımsızdır.
- Ağ kopukluğunda senkron: mevcut ayar korunur, bağlantı yeniden kurulunca k:11
  yeniden gönderilir (outbox benzeri).

### 3.2 Mesaj düzeyi

- Gönderim formunda tek mesaj için "şu kadar sonra yok ol" seçeneği.
- Gövdeye `"e": <saniye>` alanı eklenir; alıcı `ts + e*1000` dedikten sonra
  mesajı RAM'den siler ve popup'tan kaldırır.
- Varsayılan kapalı; ayar yapılmadıkça mesajlarda süre taşınmaz.

### 3.3 Zaman farkı notu

- Süre her zaman **gönderenin `ts`** üzerinden hesaplanır; alıcı cihaz
  saatindeki sapma hedefini değiştirmez (süre iki uçta mutlak bir andır).

## Bölüm 4 — Ekran Koruması (azaltma — honest)

- Popup odak kaybında (blur) içerik maskeleme: mesajlar "•••" kaplamasıyla
  gizlenir; geri odakta açılır.
- Mesaj seçimi/bağlam menüsü kısıtı (CSS `user-select` + `contextmenu` engeli).
- UI'da açık not: "İşletim sistemi düzeyinde ekran görüntüsü tamamen
  engellenemez; içerik yalnızca uygulama içinde maskelenir."

## Bölüm 5 — Hata Yönetimi ve Testler

### 5.1 Hata tablosu

| Senaryo | Davranış |
|---|---|
| Panik tetiklenir | Tüm state temizlenir + decoy ekran; geri alınamaz |
| Kod süresi dolmuş | Kabul reddedilir; "yeni kod üret" |
| Zamanlayıcı değişikliğinde ağ kopuk | Mevcut ayar korunur; bağlanınca k:11 yeniden |
| Mesaj düzeyi yok etme süresi geçmiş | Mesaj iki uçtan RAM'den düştü; yeniden görünmez |
| Ekran yakalama | Tam engellenemez; maske + seçim engeli, sınır UI'da |

### 5.2 Testler (session_sim.mjs genişletilir)

1. Panik: `resetAll` → tüm state boş + `decoy` doğru
2. Kod süresi dolmuş → kabul reddi; süresi geçmemiş → kabul
3. Zamanlayıcı senkronu k:11 → iki uçta aynı süre; kesinti sonrası yeniden senkron
4. Mesaj düzeyi `e` süresi → alıcıda RAM'den düşer
5. Sohbet düzeyi süresi → toplu düşüş
6. `node build.js` sonrası dist tutarlılığı
7. Ekran maskeleme: popup blur → içerik "•••" örtüsü; focus → açılır

## Bölüm 6 — Değişen Dosyalar

- `src/offscreen.js` — panik `resetAll`, `codeExpiresAt`, k:11, yok etme zamanlayıcıları, maskeleme hali
- `src/background.js` — (varsa) global kısayol
- `src/popup.js` / `src/popup.css` / `src/sidepanel.html` — Panik butonu, tuzak ekran, geri sayım, yok etme menüleri, maske
- `session_sim.mjs` — yukarıdaki testler
- `docs/superpowers/specs/` — bu spec