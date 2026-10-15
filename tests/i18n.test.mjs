import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { dict, t, getLang, setLang } from '../src/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('tr ve en sözlükleri aynı anahtar kümesini taşır', () => {
  const tr = Object.keys(dict.tr).sort();
  const en = Object.keys(dict.en).sort();
  assert.deepEqual(tr, en);
});

test('hiçbir anahtar boş değil, hiçbiri kendisine çevrilmiyor', () => {
  for (const k of Object.keys(dict.tr)) {
    assert.ok(dict.tr[k].length > 0, 'tr.' + k + ' boş');
    assert.ok(dict.en[k].length > 0, 'en.' + k + ' boş');
    assert.notEqual(dict.tr[k], k);
    assert.notEqual(dict.en[k], k);
  }
});

test('t() vars interpolasyonunu destekler', () => {
  setLang('tr');
  assert.equal(t('x.timeout', { seconds: 5 }), '5 saniye içinde dene');
  setLang('en');
  assert.equal(t('x.timeout', { seconds: 5 }), 'try again in 5 seconds');
});

test('bilinmeyen anahtar için anahtarın kendisi döner', () => {
  assert.equal(t('there.is.no.such.key'), 'there.is.no.such.key');
});

test('HTML data-i18n niteliklerinin tümü her iki dilde de var', () => {
  const html = readFileSync(path.join(__dirname, '..', 'src', 'sidepanel.html'), 'utf8');
  const re = /data-i18n(?:-placeholder|-title|-aria)?="([^"]+)"/g;
  const keys = new Set();
  let m;
  while ((m = re.exec(html))) keys.add(m[1]);
  for (const k of keys) {
    assert.ok(k in dict.tr, 'tr eksik: ' + k);
    assert.ok(k in dict.en, 'en eksik: ' + k);
  }
});
