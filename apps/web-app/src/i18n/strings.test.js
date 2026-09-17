/**
 * The catalogue's own guarantees.
 *
 * The important one is the round trip: Sinhala is authored in Unicode and
 * DISPLAYED as legacy ubin16s, so a string that does not survive
 * unicodeToLegacy -> legacyToUnicode is one that will render as the wrong
 * glyphs on screen. Catching that here is the difference between a reviewer
 * reading correct Sinhala and a journalist seeing mojibake.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyToUnicode } from '../lib/sinhalaLegacy.js';
import { toLegacyDisplay } from './legacyDisplay.js';
import { DEFAULT_LANGUAGE, LANGUAGES, STRINGS, STRING_KEYS } from './strings.js';

test('every key has both an English and a Sinhala form', () => {
  for (const key of STRING_KEYS) {
    const entry = STRINGS[key];
    assert.ok(Array.isArray(entry), `${key} must be a [en, si] pair`);
    assert.equal(entry.length, 2, `${key} must have exactly two forms`);
    for (const [index, form] of entry.entries()) {
      assert.equal(typeof form, 'string', `${key}[${index}] must be a string`);
      assert.ok(form.trim().length > 0, `${key}[${index}] must not be blank`);
    }
  }
});

test('the catalogue is not empty', () => {
  assert.ok(STRING_KEYS.length > 50, 'expected a real catalogue, not a stub');
});

test('every Sinhala string round-trips through the legacy encoding', () => {
  // Checked per Sinhala SEGMENT, matching exactly what toLegacyDisplay
  // converts. Round-tripping the whole string would fail on its own terms:
  // a held-out Latin run like "SinAi" is a valid legacy glyph sequence, so
  // reverse-converting it yields Sinhala ("ීසබ්ස") even though the forward
  // conversion was correct and left it untouched.
  const LATIN_RUN = /[A-Za-z][A-Za-z0-9._@'-]*/g;
  const broken = [];

  for (const key of STRING_KEYS) {
    const [, sinhala] = STRINGS[key];
    for (const segment of sinhala.split(LATIN_RUN)) {
      const expected = segment.normalize('NFC');
      if (!expected.trim()) continue;
      const legacy = toLegacyDisplay(segment);
      const back = legacyToUnicode(legacy);
      if (back !== expected) broken.push({ key, segment: expected, legacy, back });
    }
  }

  assert.deepEqual(
    broken,
    [],
    `these would render as the wrong glyphs:\n${broken
      .map((b) => `  ${b.key}: ${b.segment} -> ${b.legacy} -> ${b.back}`)
      .join('\n')}`,
  );
});

test('Latin runs survive legacy conversion untouched', () => {
  // The regression that made this necessary: "SinAi" inside a Sinhala
  // sentence was being converted as if it were legacy glyph slots.
  assert.match(toLegacyDisplay('ඔබේ SinAi ක්‍රියාවලිය'), /SinAi/);
  assert.equal(toLegacyDisplay('SinAi'), 'SinAi');
  assert.equal(toLegacyDisplay('hello@sin-ai.app'), 'hello@sin-ai.app');
});

test('no Sinhala string is left as English', () => {
  const untranslated = STRING_KEYS.filter((key) => {
    const [en, si] = STRINGS[key];
    return en === si;
  });
  assert.deepEqual(untranslated, [], 'these keys were never translated');
});

test('the default language is one of the offered languages', () => {
  assert.ok(LANGUAGES.some((l) => l.id === DEFAULT_LANGUAGE));
  assert.deepEqual(LANGUAGES.map((l) => l.id), ['en', 'si']);
});


test('no Sinhala string uses a character the legacy font cannot draw', () => {
  // These have no ubin16s glyph slot and silently render as something else:
  // the em-dash comes back as a left double quote, the ellipsis as ත්‍ව.
  // Spell them with the forms that do round-trip -- en-dash, three periods.
  const UNSUPPORTED = [
    ['\u2014', 'em-dash — (use an en-dash –)'],
    ['\u2026', 'ellipsis … (use three periods ...)'],
  ];
  const offences = [];
  for (const key of STRING_KEYS) {
    const [, sinhala] = STRINGS[key];
    for (const [char, why] of UNSUPPORTED) {
      if (sinhala.includes(char)) offences.push(`${key}: ${why}`);
    }
  }
  assert.deepEqual(offences, []);
});
