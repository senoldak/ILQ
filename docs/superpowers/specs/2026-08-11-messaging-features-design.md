# ILQ — Okundu Kaşesi, QR Kod, i18n ve Görsel İşleme

Tarih: 2026-08-11
Durum: Tasarım onaylandı (4 bölüm, kullanıcı onayı alındı)

## Amaç

Mühürlü Kargo dünyasındaki ILQ P2P mesajlaşma eklentisine dört yetenek ekler:
1. **Okundu kaşesi (read receipt)** — karşı tarafın mesajı gördüğünü gösteren ikinci mühür/tik.
2. **QR bağlantı kodu** — bağlantı kodunun yüz yüze aktarımı (üretim + kamera ile okuma).
3. **i18n** — Türkçe + İngilizce; tüm arayüz metinleri çeviri katmanına taşınır.
4. **Görsel işleme** — yukarıdaki mekanikler mevcut Mühürlü Kargo dünyasına işlenir; yeni ritüel/damga envanteri yok.

## Kapsam Dışı

- Çoklu cihaz desteği ve anahtar yedeği (PRODUCT.md "tek cihaz" ilkesine ters, plan dışı).
- Yeni görsel ritüeller, mühür koleksiyonu, kaşe geçmişi/zaman çizelgesi.
- Mesaj içeriklerinin çevirisi (konuşma metinleri asla çevrilmez).
- Teslimat göstergeleri üzerinde kapsamlı yeniden tasarım (mevcut tek tik korunur).

## Bölüm 1 — Okundu Kaşesi (Read Receipt)

### Protokol (k:12)

- Mevcut **k:6 delivered** onayı dokunulmaz; tek tik çizimi aynen kalır.
- Yeni kontrol kodu **k:12 read-receipt**: alıcı mesajı *görünür kılınca* gönderen kişiye şifreli okundu sinyali döner.
- Gövde: `{ m: <mid> }` — tek alan, tek seferlik, talep akışı yok.
- Mevcut `sendEnvelope(conn, type, body, regId)` altyapısıyla taşınır; kontrol kodları k:4/k:5/k:6/k:11 desenini izler.

### Gönderen tarafı (offscreen.js)

- `setRecallWindow` içindeki outbox kaydına `read: false` eklenir.
- k:12 alınınca: `outbox.set(mid, {..., read: true})` + `notify('read', { mid, username })`.
- Recall penceresi/outbox temizliği mevcut mantıkla birlikte çalışır.

### Alıcı tarafı (offscreen.js)

- Mesaj balonu gerçekten render edildiği ve sohbet penceresi görünür olduğu anda k:12 ateşlenir.
- Otomatik; kullanıcı eylemi yok.
- **Sohbet düzeyi okundu kapatma (per-sohbet):** kullanıcı bir sohbet için okundu kaşesi göndermeyi kapatabilir — k:12 gönderme durur ama okuma devam eder (alıcı tarafı her zaman kabul eder).

### Arayüz (popup.js / popup.css)

- `.msg-status`: `delivered` = tek tik (mevcut SVG aynen kalır).
- `read` = çift tik; ikinci tik mühür kabartması tonunda (`--trust-deep`), parmak izi kartı doğrulama diliyle uyumlu.
- `notify('read', ...)` case'i: balonun `.msg-status` öğesine çift tik SVG render eder.
- Kaşe metni yok; yalnızca çizim durumu. (i18n kapsamında tooltip opsiyonel — asgari tutulur.)
- Ayrım: okundu **göstergesi** çizimdir; mevcut **metin kaşeleri** (KAPALI tamper bandı, DOĞRULANDI · MÜHÜR KIRILDI, durum kaşeleri) i18n sözlüğüne girer ve dil değişince yeniden çizilir.

### Güvenlik / "iz düşmandır" dengesi

- Okundu kaşesi sessizce reddedilmez — ürün dürüstlüğü gereği gönderilir; ancak kullanıcı isterse sohbet başına kapabilir.
- k:12 yalnızca mevcut şifreli oturum üzerinden gider; yeni yüzey yok.

## Bölüm 2 — QR Bağlantı Kodu

### Üretim

- `generateCode` akışına QR eklenir: mevcut `code-readout` fişinin altında manila kartı.
- QR içeriği mevcut bağlantı kodunun ta kendisi — içerik formatı değişmez, tek kullanımlık prekey paketi ve 5 dk TTL korunur.
- Bağımlılık: saf-JS `qrcode` paketi (küçük, build'e esbuild ile girer).

### Okuma

- "Bağlan" sekmesinde **"Kodu tara"** butonu.
- `getUserMedia` kamera erişimi yalnızca tarama sırasında açılır; çözüm normal kod-girme akışına döner (aynı doğrulama, aynı mühür ritüeli).
- QR çözme: tarayıcının yerleşik **`BarcodeDetector`**'ı — yeni bağımlılık yok.
- `BarcodeDetector` yoksa (eski Chrome): buton gizlenir; manuel giriş hâlâ çalışır (dürüst gerileme).

### Kamera güvenliği

- Tarama yalnızca aktifken açık; iptal/sohbet dışına çıkışta `stream.getTracks().stop()` ile hemen kapanır.
- Ekran görüntüsü riskine karşı uyarı: "Bu kodu yalnızca güvendiğin kişiye göster."

### Görsel (Bölüm 4 ile birlikte)

- QR: `--ink` mürekkep üzerinde `--ground` zemin, delikli-kenar köşe detayı (mevcut kaşe/kesik kenar dili).
- Başlık/notlar mevcut kaşe tipografisi (10.5–11.5px, harf aralıklı).

## Bölüm 3 — i18n (TR + EN)

### Katman (src/i18n.js)

- Saf JS modülü; bağımlılık yok.
- Sözlük: `{ tr: {...}, en: {...} }` — tüm arayüz metinleri anahtar kümeleri (butonlar, kaşeler, hata mesajları, uzun açıklamalar).
- Dil seçimi: varsayılan `navigator.language` (tr→TR, diğer→EN); kullanıcı ayarlarda TR/EN seçebilir; seçim oturum boyu RAM'de tutulur (disk yok — chrome.storage kullanılmaz).
- API: `t(key, vars?)` — `t('error.timeout', { seconds: 5 })`.
- Dil değişince DOM yeniden süpürülür (anahtarlar yeniden çözülür).

### Yayılım

- **Statik HTML:** `data-i18n="key"`, `data-i18n-placeholder="key"`; başlangıçta ve dil değişiminde tüm DOM süpürülür.
- **Dinamik JS:** `textContent = '...'`, `placeholder='...'`, `title='...'` sabit metinleri `t()` ile; `innerHTML` yalnızca SVG ikonlar için korunur (çevrilmez).
- **Offscreen.js:** kullanıcıya gösterilmez — hata mesajları `error.*` anahtarı olarak döner, arayüz çevirir.

### Kapsam sınırı

- Mesaj içerikleri çevrilmez.
- Dosya kartları: sistem başlıkları/metinleri çevrilir; kullanıcının gönderdiği dosya adı çevrilmez.

## Bölüm 4 — Görsel İşleme (mevcut dünyaya)

Hiçbir yeni sembol/damga/ritüel eklenmez; her şey mevcut Mühürlü Kargo dilinin türevidir.

1. **Okundu kaşesi:** çift tik, ikinci tik `--trust-deep` kabartma tonunda (parmak izi kartı doğrulama diliyle aynı aile).
2. **QR zarfı:** manila kartı `--surface`/`--surface-2`, kesik köşe (mevcut delikli-kenar), QR mürekkep/zeminde; kaşe tipografisi.
3. **i18n uyumu:** İngilizce uzun metinlerin döküldüğü yerlerde mevcut yerleşim ölçüleri korunur (topbar, kaşeler, buton genişlikleri).
4. **Kamera çerçevesi:** mevcut modal kaplama dili (`--shadow-md`, kemik zemin); video köşe çerçevesi içinde, üstte kaşe notu ("Kodu çerçeveye getir").

## Mimari / Veri Akışı

```
popup.js (UI)  ←→  offscreen.js (P2P + Signal)   ←→  uzak cihaz
   │                        │
   └─ t()/i18n.js           └─ k:6 delivered, k:12 read, k:11 chatTimer
        (RAM seçim)             (outbox.read flag)
   QR üretim (qrcode)      ←─ generateCode
   QR okuma (BarcodeDetector + getUserMedia)
```

- Devlet değişikliği sıfır kalıcılık ilkesini bozmaz: dil seçimi, outbox, okundu bayrakları — hepsi RAM.
- QR bir sunucu değildir; STUN/TURN politikası değişmez.

## Hata Durumları

- **k:12 alınamazsa:** tek tik kalır; okundu bilinmiyorsa gösterilmez (yalnızca delivered). Dürüst gerileme.
- **Kamera izni reddi:** "Kodu tara" iptal edilir, manuel giriş kalır; hata mesajı `error.cameraDenied` anahtarıyla çevrilir.
- **`BarcodeDetector` yok:** tarama butonu gizlenir; manuel giriş çalışır.
- **QR içeriği bozuk/süresi dolmuş:** normal kod-girme hata akışı (mevcut `parseCode` TTL kontrolü).

## Test Yaklaşımı

- Mevcut uçtan uca Signal simülasyonu desenine uygun: kod üretimi → oturum → ratchet → mesaj → k:6 → k:12.
- i18n: tüm `data-i18n` anahtarlarının her iki dilde de var olduğu sözlük tutarlılık kontrolü (boş/eksik anahtar hatası).
- Detector (impeccable) UI değişikliklerinden sonra koşulur; görsel işleme mevcut token/ritim setinden sapmaz.
- Build: `node build.js` her aşamada.

## Uygulama Sırası

1. Okundu kaşesi (k:12, outbox.read, UI çift tik).
2. QR kod (üretim + tarama + kamera güvenliği).
3. i18n (sözlük, data-i18n, dinamik t(), dil seçimi).
4. Görsel işleme (her yeni mekaniğin dünyaya işlenmesi + detektör turu).
