/* codec test: round-trip, öneksiz format, maskeleme, bozuk kod tespiti */
import { encodeCode, decodeCode } from './src/codec.js';

function b64(bytes) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)));
}

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok:', msg); }
  else { fail++; console.error('  FAIL:', msg); }
}

const ik = new Uint8Array(33).fill(7);
const spk = new Uint8Array(33).fill(9);
const sig = new Uint8Array(64).fill(13);
const opk = new Uint8Array(33).fill(15);

const fields = {
  u: 'kzcx7h2xkd2qudp4qzzm',
  r: 24660,
  spkId: 42,
  ik: b64(ik),
  spk: b64(spk),
  spkSig: b64(sig),
  opkId: 77,
  opk: b64(opk),
  exp: 1234567890123,
};

// encode -> decode round trip
const code = encodeCode(fields);
console.log('kod örneği (' + code.length + ' karakter):', code);
ok(!code.startsWith('ILQ1.'), 'kod öneksiz, ILQ1. içermiyor');
const back = decodeCode(code);
ok(JSON.stringify(back) === JSON.stringify(fields), 'round-trip aynı');
ok(back.u === fields.u, 'u eşleşti: ' + back.u);
ok(back.r === fields.r, 'r eşleşti: ' + back.r);
ok(back.spkId === fields.spkId, 'spkId eşleşti');
ok(back.opkId === fields.opkId, 'opkId eşleşti');
ok(back.ik === fields.ik, 'ik eşleşti');
ok(back.spk === fields.spk, 'spk eşleşti');
ok(back.spkSig === fields.spkSig, 'spkSig eşleşti');
ok(back.opk === fields.opk, 'opk eşleşti');

// maskeleme: çözülen gövde NESNE değil, sabit sıralı DİZİ olmalı
let bodyJson;
try { bodyJson = JSON.parse(atob(code)); } catch (e) { bodyJson = null; }
ok(Array.isArray(bodyJson), 'gövde dizi (alan adları maskeli)');
ok(Array.isArray(bodyJson) && bodyJson.length === 9, 'dizi 9 alan içeriyor (exp dahil)');
ok(Array.isArray(bodyJson) && bodyJson[8] === fields.exp, 'dizi[8] = exp');
ok(Array.isArray(bodyJson) && bodyJson[0] === fields.u, 'dizi[0] = u');

// base64url yazım tüm platformlarda geçerli
const b64urlCode = code.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
ok(JSON.stringify(decodeCode(b64urlCode)) === JSON.stringify(fields), 'base64url yazım çözüldü');

// premium: eski ILQ1. önekli nesne kodu da çözülmeli (geriye dönük uyumluluk)
const legacyStd = 'ILQ1.' + btoa(JSON.stringify(fields));
ok(JSON.stringify(decodeCode(legacyStd)) === JSON.stringify(fields), 'eski ILQ1. nesne kodu çözüldü');

// exp'siz eski nesne kodu (exp çıkarılmış) hâlâ çözülür, exp undefined olmalı
const legacyNoExp = { ...fields };
delete legacyNoExp.exp;
const legacyStdNoExp = 'ILQ1.' + btoa(JSON.stringify(legacyNoExp));
const decodedNoExp = decodeCode(legacyStdNoExp);
ok(decodedNoExp.exp === undefined, "exp'siz eski nesne kodu çözüldü, exp undefined");

// adres tespiti (20 haneli a-z2-7) -> açıklayıcı uyarı
try {
  decodeCode('4b2t7a6p7egzndfspeo2');
  ok(false, 'adres reddedilmedi');
} catch (e) {
  ok(/adres/i.test(e.message), 'adres uyarısı: ' + e.message);
}

// rastgele 48 karakterlik bozuk dize (base64 çözülür ama JSON değil)
try {
  decodeCode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  ok(false, 'bozuk dize reddedilmedi');
} catch (e) {
  ok(/geçersiz/i.test(e.message), 'bozuk dize uyarısı: ' + e.message);
}

// bozulmuş base64 gövdesi (geçersiz karakter)
try {
  decodeCode('ILQ1.!#!gecersizz');
  ok(false, 'bozuk base64 reddedilmedi');
} catch (e) {
  ok(true, 'bozuk base64 uyarısı: ' + e.message);
}

// boş
try { decodeCode(''); ok(false, 'boş reddedildi'); } catch (e) { ok(true, 'boş uyarı'); }

// eksik alan (dizi biçiminde eksik)
try {
  decodeCode(btoa(JSON.stringify(['x'])));
  ok(false, 'eksik alan reddedilmedi');
} catch (e) {
  ok(/eksik/i.test(e.message), 'eksik alan uyarısı: ' + e.message);
}

// eksik alan (eski nesne biçiminde eksik)
try {
  decodeCode('ILQ1.' + btoa(JSON.stringify({ u: 'x' })));
  ok(false, 'eksik alan (nesne) reddedilmedi');
} catch (e) {
  ok(/eksik/i.test(e.message), 'eksik alan (nesne) uyarısı: ' + e.message);
}

console.log('\n%d geçti, %d hata', pass, fail);
process.exit(fail ? 1 : 0);