/* ILQ call-state — çağrı durum makinesi (saf, node:test tarafından da import edilir).
 * state.call = null | { callId, username, mode, phase } — tek aktif aramanın hakemi.
 * `entry.verified` zorlaması ve tek-aktif kuralı burada; medya RTCPeerConnection
 * side panelde yaşar ve bu dosyada YOKTUR. RAM-only: diske hiçbir şey yazılmaz. */

export const CALL_MODES = ['audio', 'video'];

export function newCallId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Arayan: startCall doğrulaması. Verified yoksa başlatılmaz; aktif çağrı varken reddeder.
export function beginCall(verified, current, username, mode) {
  if (!CALL_MODES.includes(mode)) return { ok: false, error: 'error.callBadSignal' };
  if (!verified) return { ok: false, error: 'error.notVerified' };
  if (current) return { ok: false, error: 'error.callActive' };
  return { ok: true, record: { callId: newCallId(), username, mode, phase: 'outgoing' } };
}

// Alıcı: gelen k:14 'request' kararı.
// blocked → otomatik reject + callBlocked (medya asla kurulmaz). busy → otomatik reject.
export function acceptIncoming(verified, current, from, mode, callId) {
  if (!CALL_MODES.includes(mode)) return { drop: true };
  if (!verified) return { blocked: true };
  if (current) return { busy: true };
  return { record: { callId, username: from, mode, phase: 'incoming' } };
}

export function markActive(record) {
  return record ? { ...record, phase: 'active' } : null;
}

export function clearCall() { return null; }

export function callMatches(record, callId, username) {
  return !!(record && record.callId === callId && (!username || record.username === username));
}