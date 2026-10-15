---
name: ILQ
description: Mühürlü Kargo — güvenli P2P sohbet için gizli kurye masası; sıcak kemik kağıt zemin, manila fişler, kayıt kaşeleri
colors:
  ground: "#F5F1E6"
  surface: "#FBF8EF"
  surface-2: "#EAE3D0"
  hairline: "#D9D2BE"
  hairline-strong: "#C4BBA2"
  ink: "#26241C"
  ink-soft: "#464238"
  ink-mute: "#6E695C"
  tab-inactive: "#615C4F"
  placeholder: "#726C5D"
  trust: "#246C43"
  trust-deep: "#16502F"
  trust-bg: "#E4F0E7"
  trust-line: "#B5D2BF"
  danger: "#A33B2C"
  danger-bg: "#F6E7E2"
  danger-line: "#E2C0B6"
  focus: "#7C8B73"
  msg-status: "rgba(255,255,255,0.72)"
typography:
  headline:
    fontFamily: "'InterVar', system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'InterVar', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'InterVar', system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.45
  input:
    fontFamily: "'InterVar', system-ui, sans-serif"
    fontSize: "13.5px"
  label:
    fontFamily: "'InterVar', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.08em"
  note:
    fontFamily: "'InterVar', system-ui, sans-serif"
    fontSize: "11.5px"
    lineHeight: 1.45
  micro:
    fontFamily: "'InterVar', system-ui, sans-serif"
    fontSize: "10px"
  wordmark:
    fontFamily: "'InterVar', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.14em"
  mono:
    fontFamily: "'JBMonoVar', Consolas, monospace"
    fontSize: "12px"
    lineHeight: 1.55
rounded:
  micro: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  pill: "999px"
  mark: "9px"
  mark-sm: "7px"
spacing:
  xs: "7px"
  sm: "10px"
  md: "14px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "6px"
    padding: "4px 9px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  message-in:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "12px"
    padding: "7px 11px"
  message-out:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "12px"
    padding: "7px 11px"
---

# Design System: ILQ

## Overview

**Creative North Star: "Mühürlü Kargo"**

ILQ bir sohbet uygulaması değil, iki el arasında gidip gelen mühürlü bir teslimattır; yüzey gizli bir kurye masasıdır. Tekerlek-ikon temiz sohbet iskelesi (balonlar, beyaz zemin, uygulama ızgarası) bilinçli olarak reddedilir: her ritüel kurye evrakı olarak kurulur — sıcak kemik kağıt zemin, manila fişler, kayıt kaşeleri ve mum mührün kendisi.

Sıcaklık bu dünyanın kimliğidir. Zemin ne grinin ne de saf beyazın rengidir: sıcak kemik kağıdı (#F5F1E6). Metin ne gri ne siyahtır: sıcak damga mürekkebi (#26241C). Tüm nötrler bir miktar toprak sıcaklığı taşır; soğuk CSS grisi burada yer almaz. Dünya dar (352px) ve yoğundur — üç görünüm (giriş / ana / sohbet), çok sayıda fiş, ama her biri tek bir iş yapar.

Güven yeşili (#246C43) bir mum mühürdür: yalnızca doğrulanmış anında görünür. Kıtlığı mesajıdır. Doğrulama öncesinde her güvenlik aracı "KAPALI · KAPALI" dikey tamper bandı taşır; mühür kırılıp parmak izi eşleşince bant "DOĞRULANDI · MÜHÜR KIRILDI"ya döner ve yeşil mum mühür belirir. Tek kırmızı ton (RET kaşesi) yalnızca hata/sonlandırma anındadır. Kod, kimlik ve parmak izi gibi güvenlik okumaları mono ölçüm dilidir — kopyalanabilir, karşılaştırılabilir malzeme. İkonlar tek çizgi ailesinde (1.6 stroke) elle çizilir; emoji ve ikon seti yok.

**Key Characteristics:**
- Sıcak kemik kağıt zemin; soğuk gri veya saf beyaz yok.
- Her güven aracında KAPALI tamper bandı; doğrulanınca yalnızca o an yeşil.
- Kayıt kaşesi estetiği: büyük harf, harf aralıklı, delikli kenarlar (durum hapı, alan etiketleri).
- Mono yalnızca ölçüm dili (kod, adres, parmak izi, gönderen adı); kostüm olarak değil.
- Panik çıkışı her şeyi yeniden mühürler ve geriye sadece sıradan bir resmi bülten kalır.

## Colors

Sıcak, toprak-ışıklı bir imza; tüm nötrler sıcak tonludur. Güven yeşili soğuk sinyal yeşili değil, derin bir orman tonudur; hata kırmızısı tek, alçak RET turuncu-kırmızısıdır.

### Primary
- **[Damga Mürekkebi]** (#26241C): Ana metin, birincil dolgu, giden fişler, marka rozeti. Sıfır siyah değil — sıcak koyu. İnterface'in kimlik rengi.
- **[Yumuşak Mürekkep]** (#464238): İkincil metin, ikincil buton metni.
- **[Sessiz Mürekkep]** (#6E695C): Yardım metni, altyazılar, alan etiketleri, durum barı.

### Secondary
- **[Mum Yeşili]** (#246C43): Yalnızca doğrulanmış mührün anında — parmak izi kartı ikonu, "doğrulanmış" durum kaşesi, doğrulanmış sohbet başlığı, unread rozeti. Koyu varyantı **Mum Yeşili Derin** (#16502F) açık yeşil zemin üzerinde metin olarak kullanılır (8.1:1). Zemin **Mum Zemini** (#E4F0E7), çizgi **Mum Çizgisi** (#B5D2BF).
- **[RET Kaşesi]** (#A33B2C): Tek kırmızı ton. Hata şeridi, "Eşleşmiyor" ve panik aksiyonu. Zemin **RET Zemini** (#F6E7E2), çizgi **RET Çizgisi** (#E2C0B6).

### Neutral
- **[Kemik Zemin]** (#F5F1E6): Ana yüzey. Sıcak ve mat; ekranın nefes aldığı yer.
- **[Manila Yüzey]** (#FBF8EF): Fişler, kartlar, girişler, aktif sekmeler. Zeminden bir adım daha sıcak/aydınlık.
- **[Manila İkinci]** (#EAE3D0): Gelen fişler, segment rayları, parmak izi rakam zemini. Bir adım daha koyu/kirli.
- **[İnce Çizgi]** (#D9D2BE) / **[Güçlü Çizgi]** (#C4BBA2): Delikli kenar fişleri ve hairline'lar.
- **[Yer Tutucu Mürekkep]** (#726C5D): Placeholder metni (4.9:1 — eşiği aşar).

### Dark & High-Contrast Temaları
Dark tema tüm token'ları tersine çevirir (karanlık zemin, açık mürekkep), hc teması saf siyah/beyaz + tam doygun güven ve RET tonlarıyla 21:1 zemin kontrastı sağlar. Koyu temada yeşil açılır (#6FBF8F), hc'de koyu yeşil (#005A2E) olur; her iki temada da yeşil yalnızca doğrulanmış anda kalır.

### Named Rules
**The Mum Mühür Kuralı.** Güven yeşili yalnızca doğrulanmış mührün anında görünür. Kıtlığı mesajıdır: bir doğrulama öncesi yeşil buton, tanık işareti yerine gürültü olur.
**The Sıcak Mürekkep Kuralı.** Nötrler asla saf gri değildir; her ton bir miktar sıcaklık taşır. Bu sistemde #808080, saf beyaz ve saf siyah yoktur (hc teması hariç).
**The Tek Kırmızı Kuralı.** RET kaşesi (#A33B2C) sistemin tek kırmızısıdır ve yalnızca hata/sonlandırma anları için reserve edilir.

## Typography

**Display/Headline Font:** Inter Variable ("InterVar", sistem-ui) — 650 ağırlık, -0.02em tracking
**Body Font:** Inter Variable — 13px/1.45
**Label Font:** Inter Variable — 11px, 600, +0.08em, uppercase (kayıt kaşesi sesi)
**Mono Font:** JetBrains Mono Variable ("JBMonoVar", Consolas) — kod, adres, parmak izi, gönderen adı

Arayüzün çalışma yüzü InterVar'dır; tıpkı kurye defteri gibi sessiz taşır. Başlık kalın ve kısadır; kaşe etiketleri büyük harf + harf aralıklıdır; güven okumaları monoyla ölçülür. Mono, "teknik" kostümü değil, ölçüm aletidir.

### Hierarchy
- **Wordmark** (700, 15px, +0.14em): Marka adı "ILQ", mühür rozeti yanında.
- **Headline** (650, 21px, -0.02em, 1.25): Giriş ekranı başlığı; tek hikaye cümlesi.
- **Panel Başlığı** (650, 16px, -0.01em): "Bağlan", "Bağlantı kodu" gibi evrak başlıkları.
- **Body** (400, 13px, 1.45): Arayüzün gövde metni.
- **Input** (400, 13.5px): Aksiyon alanları.
- **Label** (600, 11px, +0.08em, uppercase): Alan etiketleri ve kaşe başlıkları ("KODUN", "KİMLİĞİM"). Yalnızca alan/durum etiketi; asla başlık üstü kicker olarak değil.
- **Note** (400, 11.5px, 1.45): Dipnotlar, alan yardımları, güvenlik notları.
- **Micro** (400, 10px ve 8–9px): Tamper bandı metni (8px mono), mesaj durumu ✓, unread rozeti (9px). Yalnızca dar dekoratif şeritlerde.
- **Mono Measurement** (var, 12px, 1.55): Kimlik, bağlantı kodu, parmak izi, "ben" mesaj etiketi.

### Named Rules
**The Ölçüm Mono Kuralı.** Mono yalnızca kod, adres, parmak izi, gönderen adı gibi ölçülen veride kullanılır. Ekranın "teknik" olduğunu söylemek için mono giydirilmez.

## Layout

352px sabit dar yüzey; yatay marj 14px. Dikey ritim "başlık üstü > başlık altı" ilkesiyle kurulur: başlık öncesi ferahlık, başlık sonrası sıkılık. Segmentli yayın (Bağlan / Kod / Sohbet) 3 eşit sütun, raylı (ray: manila ikinci), aktif segment manila yüzey + ince gölge. Sohbet fişleri soldan gelen, sağdan giden; balon max genişliği %84 (geniş sağ panelde 460px). Parmak izi kartı sohbetin altına iner; 60 haneyi 2 sütunlu mono satırlarda sunar. Hata şeridi üst barda, sohbet/kod görünümünde sabit konumda.

Dolgu ölçeği: xs 7px (fiş/sekme aralığı), sm 10px, md 14px, lg 20px. İçerik genişliği ~42ch'yi aşmamak üzere sınırlandırılır. Sağ panelde (sidepanel.css) akışkan yükseklik: mesajlar kalan tüm alanı kaplar, giriş dikeyde ortalanır, okunabilir ölçü korunur.

## Elevation & Depth

Sessiz bir derinlik: düz yüzey, yumuşak gölgeyle yükselir. Yüzey levha gibi davranır; gölgeler küçük ofset ve yumuşak blur taşır, dekoratif halo değil. Gölgeler sıcak mürekkebin (rgba(38,36,28,…)) tonundadır, siyah değil.

### Shadow Vocabulary
- **shadow-sm** (`0 1px 2px rgba(38,36,28,0.06), 0 1px 3px rgba(38,36,28,0.05)`): Kimlik fişi, kod kartı, aktif sekme; yükseltilmiş levhaların sakince oturması.
- **shadow-md** (`0 2px 6px rgba(38,36,28,0.06), 0 8px 24px -12px rgba(38,36,28,0.18)`): Parmak izi kartı, hata şeridi, modal, mesaj menüsü; görünür ama alçak yükseklik.

### Named Rules
**The Sessiz Gölge Kuralı.** Kalın ofset blok gölgeler (4px 4px 0) ve sıfır ofsetli renkli halo yasaktır. Gölge her zaman ofset + blur taşır.

## Shapes

Form dili keskin ve kurumsaldır: keskin köşeler kaşeye, yuvarlaklık güven nesnelerine aittir. Küçük köşeler (6px) ikon butonları ve mini kontroller; temel köşeler (8px) girişler, kartlar ve raylar; orta köşeler (12px) ana butonlar, fişler ve modal; tam yuvarlak (999px) mühür rozeti, durum noktası ve parmak izi ikonu. Tamper detayları mikro köşeler taşır: kenar bandı 3px, durum kaşesi 4px, kod okuma 4px. Delikli kenar (dashed) fiş koparma hissini verir: kod kartı alt kenarı, KAPALI bandı dikey sınırı, hata şeridi. Marka rozeti 28px'de (küçük varyantta 22px) tam yuvarlak, iç içe çift halka + pusula iğnesi: bir mühür/matara. Tüm çizgiler 1.6 stroke tek çizgi ailesi.

### Named Rules
**The Delikli Kenar Kuralı.** Çizgi fişler (dashed) yalnızca kurye koparma hissinde kullanılır; derinlik gölgeden, kimlik çizgiden gelir.

## Components

### Buttons
- **Shape:** Orta köşeler (12px). Ana penyeler tam genişlik; ikon butonları kare.
- **Primary:** Damga mürekkebi dolgu (#26241C), kemik metin (#F5F1E6), 600 ağırlık. Hover: açık mürekkep (#34362F). Active: 1px aşağı baskı. Disabled: %55 opaklık. **Asla mum yeşili değil.**
- **Secondary:** Manila yüzey, yumuşak mürekkep metin, güçlü hairline kenar. Hover: manila ikinci + sessiz mürekkep kenar. "Yeni kod üret" gibi ikon+etiket satırı.
- **Ghost:** İnce hairline, küçük (6px) köşe; "Kopyala" gibi alan içi aksiyon. Kopyalandı: geçici mum zemin + mum derin metni.
- **Danger:** RET zemin dolgu, RET metin, RET çizgi kenar.

### Status Kaşesi (durum hapı)
Sağ üstte resmi damga: nokta + büyük harf harf aralıklı metin (`data-state`):
- **offline:** sessiz mürekkep, ince hairline ("ÇEVRİMDIŞI").
- **online:** yumuşak mürekkep, güçlü hairline ("YAYINDA").
- **chatting:** mürekkep, güçlü hairline ("BAĞLI · adres").
- **verified:** mum zemin, mum çizgi, mum derin metin, mum nokta ("DOĞRULANMIŞ"). Tek yeşil kaşe hali.
- **error:** RET zemin, RET çizgi, RET metin ("HATA").

### Segmented Control (Sekmeler)
Manila ikinci ray (#EAE3D0), 3px iç dolgu, hairline sandbox. Aktif segment manila yüzey + sehr-sm + mürekkep; inaktifler tab-inactive. Aktif kayma 0.18s ease; dolgu değişimi, hareketli indikatör değil.

### Inputs / Fields
- **Style:** Manila yüzey, güçlü hairline kenar (1px), 8px köşe, 10px 12px iç boşluk. Mono girişler (bağlantı kodu) mono aileye geçer.
- **Focus:** Kenar sessiz mürekkebe çevrilir + halka (`0 0 0 3px rgba(36,108,67,0.18)`), 0.14s ease.
- **Placeholder:** #726C5D (4.9:1).
- **Error:** RET zemin dolgu, RET çizgi kenar, ana view üstünde sabit konum, shadow-md, rise animasyonu.

### Security Taşıyıcıları (Signature Component: Tamper Bandı)
Güvenliğin görünür işareti bir şerittir. Güvenlik notu ve parmak izi kartı, doğrulama öncesi dikey (güvenlik notunda) veya yatay (fp kartında) "KAPALI · KAPALI" bant taşır — 8px mono, harf aralıklı, delikli kenarlı, hafif soluk. Doğrulandığında fp kartının bandı "DOĞRULANDI · MÜHÜR KIRILDI"ya döner: mum zemin + mum derin metin + mum çizgi. Bant, mühürlü zarftaki güvenlik şeridinin arayüzdeki karşılığıdır.

### Signature Component: Fingerprint Instrument (Güvenlik Numarası)
Güven ritüelinin taşıyıcısı. Bağlantı kurulunca sohbetin altında yükselir:
- **Başlık:** ikon rozeti (mum zemin + mum mühür), "Güvenlik numarası" + "bağımsız bir kanaldan karşılaştır" mikro altyazı.
- **Gerçek çizgili defter zemini:** rakamlar, satır çizgili manila defter kağıdı görünümünde mono satırlarda (60 hane / 2 sütun), seçilebilir (`user-select: text`).
- **Aksiyon iki uçlu:** "Numaralar eşleşiyor" (primary) → kart `.verified` olur, bant DOĞRULANDI olur, yeşil onay şeridi "Bağlantı doğrulandı" belirir; "Eşleşmiyor" (danger) → bağlantı sonlandırma uyarısı.

### Messages (Fişler)
Balonlar fiştir: manila ikinci zeminde gelen (sol-alt köşe kırılır), damga mürekkebi dolguda giden (sağ-alt köşe kırılır), 12px köşe, 7px 11px dolgu. Gönderen mono etiketi üstte; "ben" kimliğiyle damgalanır. Mesaj girişi tek anlatımlık animasyon: 0.22s rise (cubic-bezier 0.22/1/0.36/1). Dosya fişleri ikon + ad + aksiyon + ilerleme çubuğu; tamamlanan dosya "Görüntüle" linki alır. Otomatik yok etme sayaçları gerekli durumlarda.

### Panic / Decoy (Tuzak Ekran)
Panik butonunun (sağ üst, RET kaşesi) ardından her şey yeniden mühürlenir: ekran maskesi mühür rozetini gösterir, ardından geriye yalnızca "Hava Durumu — Bugün" resmi bülteni kalır — sıradan bir kırtasiye zarfı. Görünüşte zararsız, kimliği yok. Kullanıcı bir yeniden başlatma butonuyla geri döner.

### Okundu Kaşesi (read-receipt tick)
Teslimat rozeti çizim hali: `delivered` = mevcut çift tik; `read` = aynı geometri, ikinci tik mum yeşili derinde (--trust-deep). Yeşil yalnızca doğrulanmış an + okundu anında görünür (Mum Mühür Kuralı'nın türevi). Liç (per-şehis) kapatma: "OKUNDU" kaşe geçişi (dashed → solid, üstü çizili). --trust-deep sabittir: okundu tik rengi değiştirilmez, Mum Mühür Kuralına tabidir.

### QR Zarfı
Kod fişinin altında manila zarf: delikli üst kenar, `--ground` zeminde `--ink` QR, 6px köşe, shadow-sm. Not metni kaşe tipografisinde (10.5px, harf aralıklı). QR içerik = bağlantı kodunun ta kendisi; yeni ritüel değil.

### Kamera Çerçevesi
Modal kaplama (--shadow-md, kemik zemin). Android frame: 1:1 `--ink` zemin + `--ground` köşe braketleri. Üstte kaşe notu ("Kodu çerçeveye getir"). Kamera yalnızca taramada açık; iptalde kapanır.

## Do's and Don'ts

### Do:
- **Do** sıcak nötrleri kullan — saf gri, saf beyaz veya siyah-karanlık cam yerine; her ton bir sıcaklık taşımalı.
- **Do** yeşili yalnızca doğrulanmış mührün anına sakla (parmak izi onayı, DOĞRULANMIŞ kaşesi). Başka yerlerde yeşil olmaz.
- **Do** mono'yu ölçüm verisine (kod, adres, parmak izi, gönderen adı) sınırla.
- **Do** gölgeleri ofset + blur ile, kısa ve alçak tut.
- **Do** ikonları tek çizgi kalınlığında (1.6) aynı ailede çiz; mühür/pusula rozeti marka kimiliğidir.
- **Do** tamper bandı dilini koru: güvenlik nesnelerinde KAPALI → DOĞRULANDI geçişi.
- **Do** mesaj giriş animasyonunu tek beste (0.22s rise) tut.

### Don't:
- **Don't** emoji veya unicode ikon kullan — ikonlar SVG ve tek aileden çizilir.
- **Don't** gradient metin, cam/glass, glow veya neon vurgu kullan. Defter çizgisi gibi doku amaçlı tonal tekrar-gradient farklıdır; metni renklendiren gradient yasak.
- **Don't** 1px üzeri renkli border-left/right (yön oku) tasarımı yap.
- **Don't** kalın ofset blok gölge (4px 4px 0) veya sıfır ofset halo kullan.
- **Don't** birincil butonu mum yeşili yap — yeşil yalnızca durum anındadır.
- **Don't** güvenlik öğelerinde koyu/neon "cihaz" estetiğine kay — kemik zemin + mürekkep kimliği korunmalı.