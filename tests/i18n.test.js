// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/locales/en.js';
import {
  LANGUAGES, matchLanguageTag, detectLanguage, loadLanguage,
  getLanguage, isRtl, t, localizedExperiment,
} from '../src/i18n/index.js';
import { experiments } from '../src/lib/catalog.js';
import { picture } from '../src/ui/pictures.js';
import { renderExperiment } from '../src/audio/dsp.js';
import { signalScope, spectrumView } from '../src/ui/visuals.js';

const EXPECTED_CODES = [
  'en', 'es', 'ar', 'fr', 'pt', 'id', 'hi', 'ur',
  'ru', 'de', 'zh', 'bg', 'hu', 'ro', 'it', 'hr',
];

function extractPlaceholders(str) {
  return [...str.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
}

function compareStructure(ref, target, localeCode, path = '') {
  assert.equal(typeof target, typeof ref, `[${localeCode}] Type mismatch at "${path}"`);
  if (Array.isArray(ref)) {
    assert.ok(Array.isArray(target), `[${localeCode}] Expected array at "${path}"`);
    assert.equal(target.length, ref.length, `[${localeCode}] Array length mismatch at "${path}"`);
    for (let i = 0; i < ref.length; i += 1) {
      compareStructure(ref[i], target[i], localeCode, `${path}[${i}]`);
    }
    return;
  }
  if (ref && typeof ref === 'object') {
    const refKeys = Object.keys(ref).sort();
    const targetKeys = Object.keys(target).sort();
    assert.deepEqual(targetKeys, refKeys, `[${localeCode}] Key mismatch at "${path || '<root>'}"`);
    for (const k of refKeys) {
      compareStructure(ref[k], target[k], localeCode, path ? `${path}.${k}` : k);
    }
    return;
  }
  if (typeof ref === 'string') {
    assert.ok(target.trim().length > 0, `[${localeCode}] Empty translation at "${path}"`);
    assert.deepEqual(
      extractPlaceholders(target),
      extractPlaceholders(ref),
      `[${localeCode}] Placeholder mismatch at "${path}": got "${target}"`,
    );
  }
}

test('language registry covers all 16 requested languages with RTL metadata', () => {
  assert.deepEqual(LANGUAGES.map(l => l.code), EXPECTED_CODES);
  assert.equal(isRtl('ar'), true);
  assert.equal(isRtl('ur'), true);
  for (const code of EXPECTED_CODES.filter(c => c !== 'ar' && c !== 'ur')) {
    assert.equal(isRtl(code), false, `Expected ${code} to be LTR`);
  }
});

test('detectLanguage resolves URL override, saved preference, browser languages, and regional tags', () => {
  assert.equal(matchLanguageTag('pt-BR'), 'pt');
  assert.equal(matchLanguageTag('es-419'), 'es');
  assert.equal(matchLanguageTag('zh-Hans-CN'), 'zh');
  assert.equal(matchLanguageTag('cmn-CN'), 'zh');
  assert.equal(matchLanguageTag('in-ID'), 'id');
  assert.equal(matchLanguageTag('ar_EG'), 'ar');
  assert.equal(matchLanguageTag('tlh'), null);

  assert.equal(detectLanguage({ browserLanguages: ['nl-NL', 'hr-HR', 'en-US'] }), 'hr');
  assert.equal(detectLanguage({ saved: 'hu', browserLanguages: ['fr-FR'] }), 'hu');
  assert.equal(detectLanguage({ urlLang: 'bg', saved: 'hu', browserLanguages: ['fr-FR'] }), 'bg');
  assert.equal(detectLanguage({ browserLanguages: ['sv-SE', 'fi-FI'] }), 'en');
});

test('all 16 locale dictionaries load cleanly and match canonical keys and placeholders', async () => {
  for (const code of EXPECTED_CODES) {
    const dict = await loadLanguage(code);
    assert.equal(getLanguage(), code);
    compareStructure(en, dict, code);
  }
  await loadLanguage('en');
});

test('localized experiments, pictures, and scopes render cleanly across scripts', async () => {
  for (const code of ['ar', 'ur', 'zh', 'hi', 'ru', 'es', 'en']) {
    await loadLanguage(code);
    assert.ok(t('home.heading1').length > 0);
    for (const exp of experiments) {
      const loc = localizedExperiment(exp);
      assert.ok(loc.title.length > 0);
      assert.equal(loc.steps.length, exp.steps.length);
      const pic = picture(exp.id, exp.defaults);
      assert.ok(pic.svg.startsWith('<svg'));
      assert.ok(pic.title.length > 0);
      assert.ok(pic.caption.length > 0);
    }
    const rendered = renderExperiment('phase', { source: 'sine', frequency: 440, phase: 180, routing: 'stereo', duration: 0.2 }, 48000, 1);
    assert.ok(signalScope(rendered, 'phase').includes('<svg'));
    assert.ok(spectrumView(rendered).includes('<svg'));
  }
  await loadLanguage('en');
});
