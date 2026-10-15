/*
 * ILQ kodcuk — bağlantı kodu taşıma katmanı.
 * Format: base64url(JSON.stringify(fieldsArray)) — öneksiz, düz rastgele dize.
 *
 * Alanlar, içerik maskelenmesi için NESNE yerine SABİT SIRALI DİZİ olarak
 * taşınır: { u, r, spkId, ik, spk, spkSig, opkId, opk }
 *   index 0: u       (kullanıcı adı / adres)
 *   index 1: r       (registrationId)
 *   index 2: spkId   (signed prekey ID)
 *   index 3: ik      (identity key, base64)
 *   index 4: spk     (signed prekey public key, base64)
 *   index 5: spkSig  (signed prekey imzası, base64)
 *   index 6: opkId   (one-time prekey ID)
 *   index 7: opk     (one-time prekey public key, base64)
 *
 * Böylece kod çözülse bile alan adları (spkId, spkSig…) görünmez; yalnızca
 * değerler taşınır. base64url, WhatsApp gibi kanallarda "+/=" karakterleri
 * ve padding sorunları çıkmaması için kullanılır.
 *
 * Geriye dönük uyumluluk: eski "ILQ1." önekli kodlar (nesne JSON) da çözülür;
 * üretilen yeni kodlar öneksizdir.
 *
 * Bu KRİPTOGRAFİK katman değildir: içerik şifrelemez, yalnızca taşır.
 * Oturum güvenliği X3DH + fingerprint doğrulamadan gelir.
 */

// base64url -> standart base64 (padding geri eklenir)
function b64UrlToBase64(s) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return b64;
}

// standart base64 -> base64url (padding atılır)
function base64ToB64Url(s) {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------- fields -> kod ----------
export function encodeCode(fields) {
  if (!fields || typeof fields !== 'object') {
    throw new Error('error.codecInvalid');
  }
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
  return base64ToB64Url(btoa(JSON.stringify(arr)));
}

// ---------- kod -> fields ----------
export function decodeCode(code) {
  if (!code || !code.trim()) throw new Error('error.codeEmpty');
  const trimmed = code.trim();
  if (/^[a-z2-7]{20}$/.test(trimmed)) {
    throw new Error('error.codeIsAddress');
  }
  // Eski ILQ1. önekli kodları da kabul et; yeni kodlar öneksizdir.
  const body = /^ILQ1\./.test(trimmed) ? trimmed.slice(5) : trimmed;

  const b64 = b64UrlToBase64(body);
  let json;
  try {
    json = atob(b64);
  } catch (e) {
    throw new Error('error.codeInvalid');
  }

  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error('error.codeInvalid');
  }

  let fields;
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
  } else if (data && typeof data === 'object') {
    fields = data; // eski ILQ1. nesne biçimi
  } else {
    throw new Error('error.codeInvalid');
  }

  if (!fields || typeof fields.u !== 'string' || !fields.u) {
    throw new Error('error.codeIncomplete');
  }
  if (typeof fields.r !== 'number' || typeof fields.spkId !== 'number' || typeof fields.opkId !== 'number') {
    throw new Error('error.codeIncomplete');
  }
  if (typeof fields.ik !== 'string' || typeof fields.spk !== 'string' ||
      typeof fields.spkSig !== 'string' || typeof fields.opk !== 'string') {
    throw new Error('error.codeIncomplete');
  }
  return fields;
}
