import { unicodeToLegacy } from '../lib/sinhalaLegacy.js';

/**
 * Render a Unicode string in the legacy ubin16s encoding, leaving Latin runs
 * alone.
 *
 * Legacy Sinhala stores its glyphs ON Latin code points, so a brand name or
 * an email inside an otherwise Sinhala sentence is ambiguous: "SinAi" is
 * both a word and a valid sequence of legacy glyph slots. Handing the whole
 * string to unicodeToLegacy converts it as if it were Sinhala and the round
 * trip comes back as "ීසබ්ස".
 *
 * So Latin runs are held out and everything else is converted. Digits are
 * deliberately NOT held out on their own — they pass through the converter
 * unchanged, and treating "2024" as Latin would split a Sinhala sentence
 * around it for no benefit. A digit attached to a Latin run ("SinAi2") stays
 * with it.
 *
 * lib/sinhalaLegacy.js is left alone on purpose: it is a general-purpose
 * converter with its own contract and round-trip tests, and this
 * "mostly Sinhala with some Latin in it" rule belongs to UI copy, not to the
 * encoding itself.
 */
const LATIN_RUN = /[A-Za-z][A-Za-z0-9._@'-]*/g;

export function toLegacyDisplay(text) {
  const input = String(text ?? '');
  let output = '';
  let cursor = 0;

  for (const match of input.matchAll(LATIN_RUN)) {
    output += unicodeToLegacy(input.slice(cursor, match.index));
    output += match[0];
    cursor = match.index + match[0].length;
  }

  return output + unicodeToLegacy(input.slice(cursor));
}
