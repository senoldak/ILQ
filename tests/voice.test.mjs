import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_CHUNK_SIZE, VOICE_MAX_BYTES, VOICE_MAX_SECONDS, VOICE_MAX_PARTS,
  bytesToB64Url, b64UrlToBytes, splitVoiceParts, parseVoicePart, VoiceAssembly,
} from '../src/voice.js';

test('sabitler: 64KB parça, 60sn kayıt, 8MB bütçe, 128 parça', () => {
  assert.equal(VOICE_CHUNK_SIZE, 65536);
  assert.equal(VOICE_MAX_SECONDS, 60);
  assert.equal(VOICE_MAX_BYTES, 8 * 1024 * 1024);
  assert.equal(VOICE_MAX_PARTS, 128);
});

test('b64url round-trip byte korunur', () => {
  const buf = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]).buffer;
  const back = b64UrlToBytes(bytesToB64Url(buf));
  assert.deepEqual(Array.from(back), Array.from(new Uint8Array(buf)));
});

test('splitVoiceParts: parça sayısı ve ilk parçada mime/ts/e', () => {
  const bytes = new Uint8Array(VOICE_CHUNK_SIZE * 3 + 10).fill(7).buffer;
  const parts = splitVoiceParts('mid1', bytes, { mime: 'audio/webm', ts: 1000, e: 30 });
  assert.equal(parts.length, 4);
  const p0 = JSON.parse(parts[0]);
  assert.equal(p0.m, 'mid1'); assert.equal(p0.idx, 0); assert.equal(p0.total, 4);
  assert.equal(p0.mime, 'audio/webm'); assert.equal(p0.ts, 1000); assert.equal(p0.e, 30);
  const p3 = JSON.parse(parts[3]);
  assert.equal(p3.idx, 3);
  assert.ok(!('mime' in p3)); assert.ok(!('ts' in p3)); assert.ok(!('e' in p3));
});

test('parseVoicePart round-trip doğru alanları döndürür', () => {
  const bytes = new Uint8Array([5, 6, 7]).buffer;
  const json = JSON.stringify({ m: 'x', idx: 0, total: 1, bytes: bytesToB64Url(bytes), mime: 'audio/webm', ts: 9, e: 0 });
  const part = parseVoicePart(json);
  assert.deepEqual(Array.from(part.bytes), [5, 6, 7]);
  assert.equal(part.m, 'x'); assert.equal(part.mime, 'audio/webm'); assert.equal(part.ts, 9); assert.equal(part.e, 0);
});

test('parseVoicePart: geçersiz/boş parçalar null döner', () => {
  assert.equal(parseVoicePart(''), null);
  assert.equal(parseVoicePart('{'), null);
  assert.equal(parseVoicePart('null'), null);
  assert.equal(parseVoicePart('{"m":""}'), null);
  assert.equal(parseVoicePart('{"m":"a"}'), null); // idx/total eksik
  assert.equal(parseVoicePart('{"m":"a","idx":-1,"total":1,"bytes":"AA=="}'), null);
  assert.equal(parseVoicePart('{"m":"a","idx":0,"total":0,"bytes":"AA=="}'), null);
  assert.equal(parseVoicePart('{"m":"a","idx":0,"total":1,"bytes":""}'), null);
  assert.equal(parseVoicePart('{"m":"a","idx":0,"total":1,"bytes":"!!!!"}'), null); // geçersiz b64
  const big = JSON.stringify({ m: 'a', idx: 0, total: VOICE_MAX_PARTS + 1, bytes: 'AA==' });
  assert.equal(parseVoicePart(big), null); // total sınırı
});

test('VoiceAssembly: sıralı parçalar tamamlar', () => {
  const asm = new VoiceAssembly();
  const bytes = new Uint8Array(VOICE_CHUNK_SIZE + 3).fill(9).buffer;
  const parts = splitVoiceParts('m1', bytes, { mime: 'audio/webm', ts: 5 });
  let done = null;
  parts.forEach((p) => { const r = asm.add('alice', parseVoicePart(p)); if (r) done = r; });
  assert.ok(done && done.complete);
  assert.equal(done.mid, 'm1');
  assert.deepEqual(Array.from(new Uint8Array(done.bytes)), Array.from(new Uint8Array(bytes)));
  assert.equal(done.mime, 'audio/webm'); assert.equal(done.ts, 5);
  assert.equal(asm.bytesFor('alice'), 0); // tamamlanan kayıt silinir
});

test('VoiceAssembly: sıra dışı parçalar eksiksizle tamamlar', () => {
  const asm = new VoiceAssembly();
  const bytes = new Uint8Array(VOICE_CHUNK_SIZE * 2).fill(1).buffer;
  const parts = splitVoiceParts('m2', bytes).map((p) => parseVoicePart(p));
  const r0 = asm.add('bob', parts[1]); // önce son parça
  assert.equal(r0, null); // eksik parça → tamamlanmaz
  const r1 = asm.add('bob', parts[0]);
  assert.ok(r1 && r1.complete);
  assert.equal(asm.bytesFor('bob'), 0);
});

test('VoiceAssembly: duplicate parça sessizce atılır, çift tamamlama olmaz', () => {
  const asm = new VoiceAssembly();
  const bytes = new Uint8Array(VOICE_CHUNK_SIZE + 3).fill(3).buffer;
  const parts = splitVoiceParts('m3', bytes).map((p) => parseVoicePart(p));
  const dup = { ...parts[0] }; // aynı idx
  asm.add('carol', parts[0]);
  assert.equal(asm.add('carol', dup), null);
  assert.equal(asm.bytesFor('carol'), VOICE_CHUNK_SIZE); // çift sayılmaz
});

test('VoiceAssembly: bütçe aşımı parçası sessizce düşer', () => {
  const asm = new VoiceAssembly();
  // İlk kayıt tamamlanmamış (total:2, sadece idx 0 geldi) → bütçenin yarısı dolu
  const half = new Uint8Array(VOICE_MAX_BYTES / 2).fill(0).buffer;
  assert.equal(asm.add('dave', parseVoicePart(JSON.stringify({ m: 'a', idx: 0, total: 2, bytes: bytesToB64Url(half) }))), null);
  // İkinci kayıt yarıdan büyük → bütçeyi aşar → sessizce düşer
  const over = new Uint8Array(VOICE_MAX_BYTES / 2 + 1).fill(0).buffer;
  assert.equal(asm.add('dave', parseVoicePart(JSON.stringify({ m: 'b', idx: 0, total: 1, bytes: bytesToB64Url(over) }))), null);
  assert.equal(asm.bytesFor('dave'), VOICE_MAX_BYTES / 2); // yalnızca ilk parça sayıldı
});

test('VoiceAssembly: total uyumsuzluğu sessizce atılır; clear/clearAll temizler', () => {
  const asm = new VoiceAssembly();
  const a = parseVoicePart(JSON.stringify({ m: 't', idx: 0, total: 2, bytes: 'AA==' }));
  const b = parseVoicePart(JSON.stringify({ m: 't', idx: 1, total: 3, bytes: 'AA==' }));
  asm.add('erin', a);
  assert.equal(asm.add('erin', b), null);
  asm.clear('erin');
  assert.equal(asm.bytesFor('erin'), 0);
  asm.add('erin', a);
  asm.clearAll();
  assert.equal(asm.bytesFor('erin'), 0);
});