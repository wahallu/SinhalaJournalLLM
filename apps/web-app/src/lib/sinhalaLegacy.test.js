import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertSinhalaEncoding,
  hasSinhalaUnicode,
  legacyToUnicode,
  unicodeToLegacy,
} from './sinhalaLegacy.js';

test('converts the existing Su-Nirmala/FM placeholder text to Unicode', () => {
  assert.equal(
    legacyToUnicode("fuys Tnf.a isxy, jdlHh we;=<;a lrkak'''"),
    'මෙහි ඔබගේ සිංහල වාක්‍යය ඇතුළත් කරන්න...',
  );
});

test('reorders visual legacy vowel signs into Unicode logical order', () => {
  assert.equal(legacyToUnicode('fl fld flda fl! ffl'), 'කෙ කො කෝ කෞ කෛ');
});

test('emits the expected FM/DL visual-order sequences', () => {
  assert.equal(unicodeToLegacy('ලංකා'), ',xld');
  assert.equal(unicodeToLegacy('ශ්‍රී ලංකා'), 'Y%S ,xld');
  assert.equal(unicodeToLegacy('කෙ කො කෝ කෞ කෛ'), 'fl fld flda fl! ffl');
});

test('uses Unicode-standard virama + ZWJ order for reduced consonant forms', () => {
  const unicode = legacyToUnicode('Y%S lH');
  assert.equal(unicode, 'ශ්‍රී ක්‍ය');
  assert.deepEqual(
    Array.from(unicode, (char) => char.codePointAt(0)),
    [0x0dc1, 0x0dca, 0x200d, 0x0dbb, 0x0dd3, 0x20, 0x0d9a, 0x0dca, 0x200d, 0x0dba],
  );
});

test('round-trips newsroom text through the canonical legacy form', () => {
  const samples = [
    'ආණ්ඩුක්‍රම ව්‍යවස්ථාව',
    'ප්‍රජාතන්ත්‍රවාදී',
    'ක්‍ෂේත්‍රය',
    'මෙම පවත්වන පුවත් 2026.',
  ];

  for (const sample of samples) {
    assert.equal(legacyToUnicode(unicodeToLegacy(sample)), sample);
  }
});

test('preserves line breaks, digits, and exposes a strict direction API', () => {
  const input = 'සිංහල 2026\nපවතී.';
  const legacy = convertSinhalaEncoding(input, 'unicode-to-legacy');
  assert.equal(convertSinhalaEncoding(legacy, 'legacy-to-unicode'), input);
  assert.equal(hasSinhalaUnicode(input), true);
  assert.equal(hasSinhalaUnicode(legacy), false);
  assert.throws(() => convertSinhalaEncoding(input, 'unknown'), /Unsupported/);
});

test('round-trips legacy-safe western punctuation and kunddaliya', () => {
  const input = ',.()%/?!+=:÷;–“”෴';
  assert.equal(legacyToUnicode(unicodeToLegacy(input)), input);
});

test('uses fitted glyph slots instead of overlapping generic vowel marks', () => {
  const fittedPairs = [
    ['රැ', '/'], ['රෑ', '?'], ['රු', 're'], ['රූ', 'rE'],
    ['ඳි', '¢'], ['ඳී', '£'], ['දූ', '¥'], ['දී', '§'],
    ['ලූ', '¨'], ['ඳූ', 'ª'], ['ඨි', 'À'], ['ඨී', 'Á'],
    ['ඡී', 'Â'], ['ඛි', 'Å'], ['ලු', 'Æ'], ['ඛී', 'Ç'],
    ['දි', 'È'], ['රී', 'Í'], ['ඪී', 'Î'], ['චි', 'Ñ'],
    ['ථී', 'Ò'], ['ජී', 'Ô'], ['චී', 'Ö'], ['ඵී', 'Ú'],
    ['ඵි', 'Ý'], ['රි', 'ß'], ['ටී', 'à'], ['ටි', 'á'],
    ['ඩී', 'ã'], ['ඩි', 'ä'], ['ඬි', 'ç'], ['ඬී', 'é'],
    ['ධි', 'ê'], ['ධී', 'ë'], ['බි', 'ì'], ['බී', 'î'],
    ['ජි', 'ð'], ['මි', 'ñ'], ['මී', 'ó'], ['ඹි', 'ô'],
    ['ඹී', 'ö'], ['ඳු', '÷'], ['වී', 'ù'], ['වි', 'ú'],
    ['ඞී', 'ü'], ['ඡි', 'ý'], ['දු', 'ÿ'], ['ඤු', '™'],
    ['ළු', '¿'], ['ණී', '”'],
    ['දා', 'Þ'], ['දැ', '±'],
    ['ඛ්', 'Ä'], ['ඞ්', 'Ù'], ['ච්', 'É'], ['ඡ්', 'þ'],
    ['ජ්', 'Ê'], ['ට්', 'Ü'], ['ඩ්', 'â'], ['ඬ්', 'å'],
    ['ධ්', 'è'], ['බ්', 'í'], ['ම්', 'ï'], ['ඹ්', 'ò'],
    ['ර්', '¾'], ['ව්', 'õ'],
    ['ඛේ', 'fÄ'], ['ඞේ', 'fÙ'], ['චේ', 'fÉ'], ['ඡේ', 'fþ'],
    ['ජේ', 'fÊ'], ['ටේ', 'fÜ'], ['ඩේ', 'fâ'], ['ඬේ', 'få'],
    ['ධේ', 'fè'], ['බේ', 'fí'], ['මේ', 'fï'], ['ඹේ', 'fò'],
    ['රේ', 'f¾'], ['වේ', 'fõ'],
  ];

  for (const [unicode, legacy] of fittedPairs) {
    assert.equal(unicodeToLegacy(unicode), legacy, `encode ${unicode}`);
    assert.equal(legacyToUnicode(legacy), unicode, `decode ${unicode}`);
  }
});

test('uses fitted virama forms in the reported newsroom combinations', () => {
  const unicode = 'මර්දන විමර්ශන ග්‍රෑම් මේ බේ';
  const legacy = 'u¾ok úu¾Yk .%Eï fï fí';

  assert.equal(unicodeToLegacy(unicode), legacy);
  assert.equal(legacyToUnicode(legacy), unicode);
});
