import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCallId, beginCall, acceptIncoming, markActive, clearCall, callMatches } from '../src/call-state.js';

test('beginCall: verified yoksa başlatılamaz', () => {
  const r = beginCall(false, null, 'alice', 'audio');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'error.notVerified');
});

test('beginCall: aktif çağrı varken ikinci çağrı reddedilir', () => {
  const first = { callId: '1', username: 'alice', mode: 'audio', phase: 'active' };
  const r = beginCall(true, first, 'bob', 'video');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'error.callActive');
});

test('beginCall: geçerli başlatma outgoing kayıt üretir', () => {
  const r = beginCall(true, null, 'alice', 'video');
  assert.equal(r.ok, true);
  assert.equal(r.record.username, 'alice');
  assert.equal(r.record.mode, 'video');
  assert.equal(r.record.phase, 'outgoing');
  assert.ok(r.record.callId.length > 0);
});

test('beginCall: geçersiz mod reddedilir', () => {
  const r = beginCall(true, null, 'alice', 'screen');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'error.callBadSignal');
});

test('acceptIncoming: verified yoksa blocked (reject + bildirim, medya yok)', () => {
  const r = acceptIncoming(false, null, 'alice', 'audio', 'c1');
  assert.equal(r.blocked, true);
  assert.ok(!r.record);
});

test('acceptIncoming: mevcut çağrı varken busy', () => {
  const current = { callId: 'x', username: 'old', mode: 'audio', phase: 'active' };
  const r = acceptIncoming(true, current, 'new', 'audio', 'c2');
  assert.equal(r.busy, true);
});

test('acceptIncoming: geçerli kabul incoming kayıt üretir, callId korunur', () => {
  const r = acceptIncoming(true, null, 'bob', 'video', 'c3');
  assert.equal(r.record.username, 'bob');
  assert.equal(r.record.callId, 'c3');
  assert.equal(r.record.phase, 'incoming');
});

test('acceptIncoming: geçersiz mod sessiz düşer', () => {
  const r = acceptIncoming(true, null, 'bob', 'chat', 'c4');
  assert.equal(r.drop, true);
});

test("markActive phase'i active yapar; clearCall null döner", () => {
  const rec = { callId: 'c', username: 'u', mode: 'audio', phase: 'incoming' };
  assert.equal(markActive(rec).phase, 'active');
  assert.equal(clearCall(), null);
});

test('callMatches: callId ve username eşleşmesini doğrular', () => {
  const rec = { callId: 'c1', username: 'alice', mode: 'audio', phase: 'active' };
  assert.equal(callMatches(rec, 'c1', 'alice'), true);
  assert.equal(callMatches(rec, 'c1', 'bob'), false);
  assert.equal(callMatches(rec, 'c2', 'alice'), false);
  assert.equal(callMatches(null, 'c1', 'alice'), false);
});

test('newCallId: tahmin edilemez, tekil görünümlü', () => {
  const a = newCallId(); const b = newCallId();
  assert.notEqual(a, b);
  assert.equal(a.length, 32); // 16 bayt hex
});