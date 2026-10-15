# Paket 1 Tasarımı: Kimlik Sıfırlama + Mesaj Silme/Karşı Taraftan Silme

Tarih: 2026-08-10
Durum: Onaylandı (kullanıcı)

## Bağlam

ILQ, sunucusuz P2P + Signal protokolü (X3DH) kullanan, RAM-only
(hiçbir veri diske yazılmayan) bir Chrome extension'dir. Bu tasarım,
kullanıcının istediği özellik paketinin ilk aşamasıdır:

1. Kimlik sıfırlama (tam sıfırlama: yeni anahtarlar + yeni adres)
2. Yerel mesaj silme (sadece benim panelimden)
3. Karşı taraftan silme (geri çekme) — zaman sınırlı + onaylı

Paket sıralaması (kullanıcı onayı): temelden büyüğe. Bu spec yalnızca
Paket 1'i kapsar. Çoklu sohbet, grup, otomatik yok etme vb. sonraki
paketlerdir.

## Kullanıcı kararları (soru-cevap özeti)

- Geliştirme sırası: Temelden büyüğe (kimlik sıfırlama + mesaj silme önce)
- Karşı taraftan silme: Paket 1'e dahil (yalnızca çevrimiçiyken çalışır)
- Silme penceresi: Zaman sınırlı, varsayılan 5 dakika (kodda yapılandırılabilir sabit)
- Silme doğrulaması: Alıcı "silindi" onayı (ack) döner; gönderen panelde görür
- Kimlik sıfırlama kapsamı: Tam sıfırlama (anahtar + adres + oturumlar + geçmiş)

## Teknik yaklaşım: Yaklaşım A (onaylandı)

Şifrelenmiş mesaj gövdesinde mesaj kimliği (mid) taşınır ve silme
komutları zarfın yeni `k` türleriyle gönderilir. Envelope yapısı
değişmez; içerik formatı ve türler genişler. Trafik analizine kapalı
(mid şifreli), geriye dönük uyumlu, ileride çoklu sohbet/grup için temel.

## Bölüm 1 — Protokol

### 1.1 Mesaj gövdesi (şifreli, `k:1` ve `k:3`)

```
{ "m": "<16 byte rastgele hex kimlik>", "t": "<metin>", "ts": "<gönderim zamanı ms>" }
```

- Gönderen her mesaj için `mid` üretir (`crypto.getRandomValues`, 16 byte → 32 hex karakter)
- Eski düz-metin gövdeler hâlâ okunur: JSON parse edilemezse gövde `t` olarak
  kullanılır, yerel sahte `mid` üretilir (geriye dönük uyum).
- `ts`, gönderenin cihazında atanır; silme penceresi doğrulaması `ts`'e göre yapılır.

### 1.2 Yeni envelope türleri

| k | Anlam | Şifreli gövde |
|---|-------|---------------|
| 1 | WhisperMessage (normal mesaj) | `{m,t,ts}` veya düz metin (eski) |
| 3 | PreKeyWhisperMessage (oturum kurma) | `{m,t,ts}` veya düz metin (eski) |
| 4 | Sil komutu (recall) | `{ m: "<mid>" }` |
| 5 | Sil onayı (ack) | `{ m: "<mid>" }` |

### 1.3 Silme kuralları (offscreen'de zorlanır)

- Silme yalnızca **gönderen** tarafından yapılabilir; alıcı kendi aldığı
  mesajı k:4 ile iade edemez (k:4 gövdesinin `mid`'i gönderenin kendi
  outbox'ında olmalı).
- Pencere: `mid`'in `ts`'inden itibaren 5 dakika (sabit `RECALL_WINDOW_MS`).
  Pencere dışında `recallMessage` silme komutunu **göndermez**; yalnızca
  yerel silme yapılır (popup tarafında da menü kapanır).
- Gönderen çevrimdışıysa komut gönderilmez ve kuyruğa alınmaz
  (tek atımlık; yeniden bağlanınca yeniden gönderim yok). Popup'a
  hata/iletilemedi durumu bildirilir.
- Kanal kapalıysa (`!conn.open`) komut gönderilmez; popup hatayı gösterir.
- Kanal açıksa komut gönderilir, ancak alıcı taraf çevrimdışıysa/yanıt
  vermiyorsa ack gelmez; popup "İletilmedi (çevrimdışı)" gösterir.

### 1.4 RAM yapısı (offscreen `state`)

- `state.peers[username].outbox = Map<mid, {ts}>` — gönderilen mesajların kısa kaydı
  (yalnızca silme penceresi için; mesaj metinleri kaydedilmez).
- Alıcı tarafında silinen mid'ler anında RAM'den kaldırılır, geçmiş listesi
  tutulmaz (RAM-only ilkesi).

## Bölüm 2 — Kimlik Sıfırlama

### 2.1 UI

Ayarlar / başlık bölgesinde "Kimliği sıfırla" butonu (üst bar veya Kimliğim kartı).

### 2.2 Akış

1. Kullanıcı "Kimliği sıfırla" → onay modalı:
   "Yeni kimlik oluşturulacak. Tüm bağlantılar kapanacak, oturumlar ve
   sohbet geçmişi silinecek. Bu işlem geri alınamaz."
2. Onay → offscreen `resetIdentity` eylemi:
   - Tüm `state.peers` bağlantıları kapatılır, `state.peers.clear()`
   - `state.store` = yeni `RamStore()` (identityKeyPair, registrationId,
     preKeys, signedPreKeys, sessions, trusted — hepsi sıfırlanır)
   - `bootstrapIdentity()` → yeni anahtar çifti + registrationId
   - `initPeer()` → yeni `state.peerId` (yeni rastgele adres), eski peer `destroy()`
   - `state.preKeyCounter` sıfırlanır (yeni anahtar seti için sıfırdan)
3. Popup: `chatMessages` içeriği temizlenir, `currentPeer = null`,
   Kimliğim alanı yeni adresle güncellenir, paneller sıfırlanır,
   durum "yayında"a döner.
4. Kullanıcı yeni bağlantı kodu üretmek için "Kod" sekmesine geçer.

### 2.3 Güvenlik notları

- Onay iki adımlı; buton güvenlik çalıştırırken onay gerekir.
- Eski kodlar RAM'den düştüğü için artık kullanılamaz.
- Eski peer_obj `destroy()` edilir; eski adrese bağlanma denemeleri reddedilir.
- Sıfırlama sonrası mevcut sohbette "bağlantı koptu" durumu iletilir.

## Bölüm 3 — UI: Silme etkileşimi

### 3.1 Mesaj balonu

Her balonun köşesinde `⋮` menü butonu:
- **Yerel sil** — mesajı yalnızca panelden kaldırır (DOM'dan; offscreen eylemi yok).
- **Karşı taraftan da sil** — yalnızca gönderilen (sağa hizalı) mesajlarda;
  `off:recallMessage` eyleminden geçer.

Balonlara `data-mid` ve tür ayrımı için sınıf eklenir. `addMessage` artık
text node yerine yapılandırılmış balon DOM'u üretir.

### 3.2 Durum ve geri çekilme

- Karşı taraftan silme sonrası balon **ikame edilir**: metin kaldırılır,
  yerine gri italik "Bu mesaj geri çekildi" gelir.
- Ack (`k:5`) geldiğinde "Karşı tarafta da silindi" notu eklenir.
- Ack gelmezse "İletilmedi (çevrimdışı)" gösterilir.

Not: Gönderim durumu rozetleri (✓ / ✓✓) bu pakette **yok** — sonraki
paket. Yalnızca silme ile ilgili durumlar eklenir.

### 3.3 Silme akışı

```
popup: menü → recallMessage(mid, username)
offscreen: pencere (ts<=5dk) + gönderen doğrulaması → şifreli k:4 {m:mid} → conn.send
alıcı offscreen: k:4 → decrypt → mid'i RAM'den sil → panelden balonu kaldır
                  + "Bu mesaj geri çekildi" ikamesi → k:5 ack döner
gönderen offscreen: k:5 → popup "deleted" olayı → "Karşı tarafta da silindi"
```

## Bölüm 4 — Hata yönetimi ve testler

### 4.1 Hata tablosu

| Senaryo | Davranış |
|---|---|
| 5 dk dolmuş | Menüde "Karşı taraftan da sil" kapalı; yalnızca yerel silme |
| Karşı taraf çevrimdışı / yanıt yok | Kanal açıksa komut gönderilir, ack gelmez → "Geri çekildi" + "İletilmedi (çevrimdışı)". Kanal kapalıysa komut hiç gönderilmez, hata gösterilir |
| Kanal kapalı / !conn.open | `recallMessage` hata döner; popup gösterir |
| Alıcı decrypt başarısız (sil) | Silme komutu şifreli; hata sessiz loglanır, ack dönmez |
| Eski format mesaj | Parse fallback kabul eder, sahte mid; karşı taraftan silme kapalı |
| Alıcı recall meşru değil (mid gönderici outbox'ında değil) | Reddedilir, işlenmez |

### 4.2 Testler (session_sim.mjs genişletilir)

1. Yeni gövde `{m,t,ts}` iletimi → alıcı `mid`'i korur
2. Eski düz-metin gövde geriye dönük çözülür
3. Gönderen recall → alıcı mid'i siler, ack döner
4. Alıcının recall'u reddedilir
5. 5 dk dolmuş → recall gönderilmez; yerel silme çalışır
6. Çevrimdışı → ack yok, "İletilmedi"
7. `resetIdentity` → yeni keypair + peerId + boş peers; eski kod decrypt çalışmaz
8. `node build.js` sonrası dist uyumluluğu

UI akışları (menü, modal, ack görünümü) için extension'ı yeniden yükleyip
elle doğrulama gerekir; simülasyon şifreleme/offscreen mantığını test eder.

## Bölüm 5 — Değişen dosyalar ve kapsam

### Değişen dosyalar

- `src/offscreen.js` — gövde JSON, `k:4/k:5`, `recallMessage`, `resetIdentity`,
  `outbox`/pencereler
- `src/popup.js` — balon yapısı, menü, ack işleme, sıfırlama akışı
- `src/sidepanel.html` + `src/popup.css` — menü, modal, durum notları
- `session_sim.mjs` — yeni test senaryoları
- `docs/superpowers/specs/` — bu spec

### Kapsam dışı (sonraki paketler)

Çoklu sohbet, grup sohbeti, otomatik yok etme, mesaj alındı onayı (✓✓),
anahtar değişikliği uyarısı, kod süre dolumu, dosya paylaşımı.