# Paket 4 Tasarımı: Sohbet Deneyimi

Tarih: 2026-08-11
Durum: Onaylandı (kullanıcı)

## Bağlam

ILQ, sunucusuz P2P + Signal protokolü (X3DH) kullanan, RAM-only Chrome
extension'dır. Bu spec; çoklu sohbet, teslimat ✓/✓✓, dosya paylaşımı,
adres defteri, tema sistemi ve küçük deneyim iyileştirmelerini kapsar.
Savunma paketi (panik modu, tuzak ekran, kod süre dolumu, otomatik yok etme,
ekran koruması) ayrı spec'tir: [2026-08-11-defensive-package-design.md].

## Kullanıcı kararları (özet)

- Çoklu sohbet: sekme çubuğu (352px popup için yatay kaydırmalı)
- Teslimat: yalnızca ✓ (gönderildi) + ✓✓ (alındı); "okundu" ayrımı yok (gizlilik)
- Dosya paylaşımı: alıcı onayı + tür/boyut sınırı (≤8MB) + ilerleme + kayıpsız HD
- Adres defteri: RAM-only; otomatik kayıt + listeden yeniden bağlanma
- Tema: kemik-beyazı (varsayılan), karanlık, yüksek kontrast, sistem-izle
- Küçük iyileştirmeler: zaman damgası, okunmamış rozeti, "yazıyor…" ipucu, maskeleme

## Mimari: A — tek zarf ailesi (onaylandı)

Mevcut `k` zarfı korunur; yeni özellikler aynı şifreli gövdede yeni k-türleriyle
taşınır. Tek decrypt katmanı — geriye dönük uyumlu, sim ile test edilebilir.

### Eklenen k-türleri

| k | Anlam |
|---|-------|
| 6 | teslimat ✓✓ ack (alıcı cihazı mesajı alıp çözdü) |
| 7 | dosya teklifi → alıcı onayı bekler |
| 8 | dosya onayı: al / reddet |
| 9 | dosya parçaları (chunk: `mid`, `idx`, `toplam`, `bytes`) |
| 10 | dosya tamam ack |
| 11 | (Paket 3'te) zamanlayıcı senkronu — deneyim spec'inde kullanılmaz |

### Şifreli gövde formatı genişler

```
– k:1/k:3  { "m": mid, "t": metin, "ts": ms }  (+ opsiyonel "e": saniye, Paket 3)
– k:6      { "m": mid }
– k:7      { "m": mid, "name": dosyaAdı, "size": bytes, "type": mime, "parts": N }
– k:8      { "m": mid, "accept": bool }
– k:9      { "m": mid, "idx": n, "total": N, "bytes": base64 }
– k:10     { "m": mid }
```

## Bölüm 1 — Çoklu Sohbet

### 1.1 Durum

- `state.peers` → `Map<kullanıcıAdı, PeerEntry>` (zorunlu hale gelir; tek eş
  özel durumu yoktur). Her giriş: `conn`, `cipher`, `session` (store içinde),
  `outbox: Map<mid,{ts, sent, delivered}>`, `history`, `verified`, `timer` (Paket 3).

### 1.2 Arayüz

- Sekme çubuğu üstte: her sekme bir peer; okunmamış sayacı küçük rozet.
- Yatay kaydırma (352px sınırı); aktif sekme vurgulu.
- "Yeni sohbet": adres defterinden seç veya kod gir → yeni sekme.
- Aktif sekme değişince altsıralı sohbet/güvenlik kartı o sekmenin verisiyle
  yüklenir; diğer sekmeler "arka planda" kalır (bağlantı açık ama UI gizli).
- Sekmeler arası geçiş: bağlantı durumları bağımsız kalır; biri kopunca yalnızca
  ilgili sekme hata/çevrimdışı durumuna geçer (temiz yok etme Paket 3'ün kapsamıdır).

## Bölüm 2 — Teslimat ✓/✓✓

### 2.1 Akış

1. Gönderen: mesaj `conn.send` sonrası `outbox[mid] = {ts, sent:true, delivered:false}`;
   UI rozeti "✓".
2. Alıcı: `k:1/k:3` decrypt başarılı → `k:6 {m:mid}` döner; mesaj RAM'e alınır.
3. Gönderen: `k:6` alınca `delivered:true` → rozet "✓✓".

- "Okundu" (görüntüleme) ayrımı yoktur.
- Çevrimdışı/ağ kesintisinde k:6 gelmezse rozet "✓"da kalır; kullanıcı
  "iletilmedi" sinyali görür (item "İletilmedi (çevrimdışı)").
- `mid` eşleşmesi: gönderen yalnızca kendi outbox'ındaki mid'i işler;
  bilinmeyen mid'ler sessizce atlanır.

## Bölüm 3 — Dosya Paylaşımı

### 3.1 Kurallar

- Boyut: ≤8MB (sabit `FILE_MAX_BYTES`); tür beyaz listesi: görsel, PDF/doc,
  ses/video küçük (sabit `FILE_ALLOWED_MIME`).
- Kayıpsız HD: dosya baytları **sıkıştırılmadan**, orijinal haliyle kanaldan gider
  (görsel yeniden kodlanmaz). Chrome'un `File`/DataChannel binary desteği kullanılır.
- Veri diske yazılmaz; parçalar ve birleşik dosya RAM'de tutulur.
  (Panik modu/sıfırlama bunu da temizler — Paket 3.)

### 3.2 Akış

```
gönderen: tür/boyut kontrolü → k:7 teklif → bekler
alıcı   : k:7 → kart "X MB · dosya — Al / Reddet" → k:8
alıcı al:  k:8(accept) → gönderen k:9 parçaları basar (64KB parça, ilerleme iki tarafta)
          → k:10 tamam → gönderen "teslim" rozeti; alıcı dosyayı RAM'de görüntüler/önizler
alıcı red: k:8(false) → gönderen taraf "reddetti" notu; hiçbir şey tutulmaz
```

- Kesinti: k:9 dizisi eksikse kısmi dosya RAM'den atılır; iki tarafa
  "transfer yarıda kaldı" bildirilir.
- Alıcı onayı zorunludur — rastgele iz düşmesin.

### 3.3 UI

- Teklif kartı (balonun dışında alt etkileşim alanı), "Al/Görüntüle" aksiyonu,
- İlerleme çubuğu (parça sayacı) gönderenin outbox'a eklediği durum çubuğunda,
  alıcının kabul kartında.
- Dosya önizleme: görsel için img (RAM blob), diğer türler için ad+boyut bilgisi.

## Bölüm 4 — Adres Defteri

### 4.1 Yapı

- `state.contacts = Map<kullanıcıAdı, { address, identityKey, verified }>` — tamamen RAM;
  paket dışı hiçbir disk deposunda tutulmaz.
- Kodla bağlanan eş otomatik kaydedilir; "adres defterine kaydet" ek butonu da olur.

### 4.2 Yeniden bağlanma

- Listeden seç → bağlantı: adres bilinir, kod üretmeye gerek yok; session
  (store.) ve parmak izi korunur.
- `verified` flag'i parmak izi onayından beslenir; yeni eşte false.
- Sıfırlama/panik (Paket 3) contacts'i tamamen temizler.

## Bölüm 5 — Tema Sistemi

### 5.1 Yapı

- `data-theme` attr + CSS custom property'ler; DESIGN.md token'ları temel alınır.
- Temalar: `bone` (mevcut kemik-beyazı, varsayılan), `dark` (karanlık), `hc`
  (yüksek kontrast), `system` (prefers-color-scheme izlenir; kullanıcı seçimi öncelikli).
- Seçim RAM'de tutulur (`state.theme`); popup/cosmetic paneller okur.
- Yüksek kontrast: tüm ana renk çiftleri WCAG AA/AAA hedeflenir; tasarım
  tokenları (DESIGN.md) her temayı kapsayacak şekilde genişletilir veya overlay
  token seti eklenir.

### 5.2 Geçiş

- Sekme çubuğu üstünde (veya ayarlar bölümünde) tema seçici; anında uygulanır,
- Sistem teması değişirse `matchMedia` dinleyicisi uygular (yalnızca `system`).

## Bölüm 6 — Küçük İyileştirmeler

- Mesaj zaman damgaları (gönderim `ts`, mono, muted).
- Sekme başına okunmamış sayacı rozeti.
- "yazıyor…" ipucu: yalnızca aktif sohbet için, yalnızca yazma durumunda,
  mevcut kanalda düşük hacimli sinyal (k-endeksi yok; uygulama detayı).
- Odak/kayıp maskelemesi (Paket 3'teki ekran korumasıyla ortak).

## Bölüm 7 — Hata Yönetimi ve Testler

### 7.1 Hata tablosu

| Senaryo | Davranış |
|---|---|
| Dosya boyut/tür uymaz | Teklif gönderilmez; gönderen hata şeridi |
| Alıcı dosyayı reddeder | Gönderene "reddetti"; RAM'de hiçbir şey tutulmaz |
| Transfer kesilir | Kısmi dosya atılır; iki uca "yarıda kaldı" |
| ✓✓ gelmez / çevrimdışı | Rozet "✓"; "İletilmedi (çevrimdışı)" |
| Bilinmeyen mid (k:6/k:10) | Sessizce atlanır |
| Adres defterinden bağlantı başarısız | O sekmeye "bağlanılamadı"; defter girdisi korunur |
| Tema değişimi | Anında; `system`'de media değişimi takip edilir |

### 7.2 Testler (session_sim.mjs genişletilir)

1. Yeni k-türleri (6,7,8,9,10) kodlama/çözme
2. ✓✓ akışı: gönder → alıcı k:6 → gönderen ✓✓
3. Dosya: teklif→onay→parçalar→tamam; iki uçta ilerleme
4. Boyut/tür reddi; alıcı reddi; kesik k:9 → kısmi dosya atılır
5. Bilinmeyen mid sessiz atlama
6. Çoklu sohbet: iki eşle iki oturum; birinin kopması diğerini etkilemez
7. Adres defteri: kayıt, yeniden bağlanma, sıfırlama temizliği
8. Temalar: `data-theme` token doğrulama (statik check) tüm temalarda
9. `node build.js` sonrası dist tutarlılığı

UI akışları (sekme çubuğu, dosya kartı, tema seçici) extension elle doğrulaması
gerektirir; sim şifreleme/logic test eder.

## Bölüm 8 — Değişen Dosyalar

- `src/offscreen.js` — `state.peers` Map, k:6-10, `state.contacts`, dosya transferi, ✓✓
- `src/popup.js` / `src/popup.css` / `src/sidepanel.html` — sekme çubuğu, dosya kartları,
  ilerleme, adres defteri görünümü, tema seçici, rozetler
- `src/background.js` — (sistem teması bridge gerekirse)
- `session_sim.mjs` — yukarıdaki testler
- `docs/superpowers/specs/` — bu spec