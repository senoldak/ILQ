import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCode, decodeCode } from '../src/codec.js';

test('round-trip: tüm alanlar korunur', () => {
  const fields = {
    u: 'abcde234567abcdef234',
    r: 42,
    spkId: 12,
    ik: 'aGVsbG8=',
    spk: 'c3Vr',
    spkSig: 'c2lnbg==',
    opkId: 13,
    opk: 'b3Br',
    exp: Date.now() + 5000,
  };
  const code = encodeCode(fields);
  const back = decodeCode(code);
  assert.equal(back.u, fields.u);
  assert.equal(back.r, fields.r);
  assert.equal(back.spkId, fields.spkId);
  assert.equal(back.ik, fields.ik);
  assert.equal(back.spk, fields.spk);
  assert.equal(back.spkSig, fields.spkSig);
  assert.equal(back.opkId, fields.opkId);
  assert.equal(back.opk, fields.opk);
  assert.equal(back.exp, fields.exp);
});

test('legacy ILQ1. önekli kodlar da çözülür', () => {
  const fields = { u: 'abc', r: 1, spkId: 2, ik: 'a', spk: 'b', spkSig: 'c', opkId: 3, opk: 'd' };
  const back = decodeCode('ILQ1.' + encodeCode(fields));
  assert.equal(back.u, 'abc');
});

test('ad-resimli metin (20 haneli) reddedilir', () => {
  assert.throws(() => decodeCode('abcde234567abcdef234'), /error\.codeIsAddress/);
});

test('eksik alan reddedilir', () => {
  assert.throws(() => decodeCode(encodeCode({ u: 'abc' })), /error\.codeIncomplete/);
});

test('boş kod reddedilir', () => {
  assert.throws(() => decodeCode(''), /error\.codeEmpty/);
});