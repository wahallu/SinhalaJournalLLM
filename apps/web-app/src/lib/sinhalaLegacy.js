import dlManelConverter from 'sinhala-unicode-coverter/lib/cjs/translators/dl_manel_to_unicode.js';

/*
 * Sinhala legacy-font conversion for the FM Abhaya / DL-Manel / Su-Nirmala
 * character layout used by the bundled ubin16s.ttf face.
 *
 * Legacy fonts store glyph slots in visual order. Unicode stores Sinhala in
 * logical order, so this is not a one-character-for-one-character operation:
 * kombuva-family signs move around the consonant cluster and yansaya /
 * rakaaraansaya become explicit virama + ZWJ sequences.
 *
 * The compact scanner below owns the canonical output emitted by this app.
 * The MIT-licensed Open-SL/LTRL converter remains as a fallback for old files
 * that use precomposed Windows-1252 glyph slots (for example § for දී).
 */

const { dlManelToUnicode } = dlManelConverter;

const VIRAMA = '්';
const ZWJ = '\u200D';
const YANSAYA = `${VIRAMA}${ZWJ}ය`;
const RAKAARAANSAYA = `${VIRAMA}${ZWJ}ර`;

const BASE_TO_LEGACY = new Map([
  ['ක', 'l'], ['ඛ', 'L'], ['ග', '.'], ['ඝ', '>'], ['ඞ', 'X'],
  ['ඟ', 'Õ'], ['ච', 'p'], ['ඡ', 'P'], ['ජ', 'c'], ['ඣ', 'CO'],
  ['ඤ', '['], ['ඥ', '{'], ['ට', 'g'], ['ඨ', 'G'], ['ඩ', 'v'],
  ['ඪ', 'V'], ['ණ', 'K'], ['ඬ', '~'], ['ත', ';'], ['ථ', ':'],
  ['ද', 'o'], ['ධ', 'O'], ['න', 'k'], ['ඳ', '|'], ['ප', 'm'],
  ['ඵ', 'M'], ['බ', 'n'], ['භ', 'N'], ['ම', 'u'], ['ඹ', 'U'],
  ['ය', 'h'], ['ර', 'r'], ['ල', ','], ['ව', 'j'], ['ශ', 'Y'],
  ['ෂ', 'I'], ['ස', 'i'], ['හ', 'y'], ['ළ', '<'], ['ෆ', '*'],
]);

const LEGACY_TO_BASE = new Map(
  Array.from(BASE_TO_LEGACY, ([unicode, legacy]) => [legacy, unicode]),
);

// Alternate slots encountered in FM/DL documents. Canonical output uses the
// values in BASE_TO_LEGACY, but accepting these makes migration less brittle.
LEGACY_TO_BASE.set('Û', 'ඟ');

const LEGACY_BASE_TOKENS = Array.from(LEGACY_TO_BASE.keys())
  .sort((a, b) => b.length - a.length);

const VOWEL_TO_LEGACY = new Map([
  ['අ', 'w'], ['ආ', 'wd'], ['ඇ', 'we'], ['ඈ', 'wE'],
  ['ඉ', 'b'], ['ඊ', 'B'], ['උ', 'W'], ['ඌ', 'W!'],
  ['ඍ', 'R'], ['ඐ', 'Ï'], ['එ', 't'],
  ['ඒ', 'ta'], ['ඓ', 'ft'], ['ඔ', 'T'], ['ඕ', '´'], ['ඖ', 'T!'],
]);

const LEGACY_TO_VOWEL = new Map(
  Array.from(VOWEL_TO_LEGACY, ([unicode, legacy]) => [legacy, unicode]),
);

const LEGACY_VOWEL_TOKENS = Array.from(LEGACY_TO_VOWEL.keys())
  .sort((a, b) => b.length - a.length);

const POSTBASE_SIGNS = new Map([
  ['්', 'a'], ['ා', 'd'], ['ැ', 'e'], ['ෑ', 'E'],
  ['ි', 's'], ['ී', 'S'], ['ු', 'q'], ['ූ', 'Q'],
  ['ෘ', 'D'], ['ෲ', 'DD'],
]);

const LEGACY_POSTBASE_SIGNS = new Map([
  ['DD', 'ෲ'], ['a', '්'], ['A', '්'], ['d', 'ා'],
  ['e', 'ැ'], ['E', 'ෑ'], ['s', 'ි'], ['S', 'ී'],
  ['q', 'ු'], ['=', 'ු'], ['Q', 'ූ'], ['+', 'ූ'],
  ['D', 'ෘ'],
]);

const PREFIX_SIGNS = new Map([
  ['ෙ', ['f', '']],
  ['ේ', ['f', 'a']],
  ['ෛ', ['ff', '']],
  ['ො', ['f', 'd']],
  ['ෝ', ['f', 'da']],
  ['ෞ', ['f', '!']],
]);

const UNICODE_PUNCTUATION = new Map([
  [',', '"'], ['.', "'"], ['(', '^'], [')', '&'], ['%', ']'], ['/', '$'],
  ['?', '@'], ['!', 'æ'], ['=', '}'], ['+', '¬'], [':', '('], ['÷', '­'],
  [';', '¦'], ['–', '¤'], ['“', '—'], ['”', '˜'],
]);

const LEGACY_PUNCTUATION = new Map(
  Array.from(UNICODE_PUNCTUATION, ([unicode, legacy]) => [legacy, unicode]),
);

/*
 * Su_Nirmala includes precomposed slots for base/sign combinations whose
 * generic zero-advance marks would sit too far left on a narrow consonant.
 * Emitting (for example) `rs` for රි makes the `s` ink extend beyond the
 * left edge of `r` and collide with the previous glyph. The dedicated `ß`
 * slot has the same meaning with self-contained bearings and advance width.
 *
 * These values follow the verified DL-Manel/Su-Nirmala extended-slot table.
 * Keep this map bidirectional: it defines canonical output and lets text
 * produced by this app round-trip without relying on the fallback converter.
 */
const PRECOMPOSED_CLUSTER_TO_LEGACY = new Map([
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
  ['ළු', '¿'],
]);

const SPECIAL_LEGACY_SEQUENCES = new Map([
  ...Array.from(
    PRECOMPOSED_CLUSTER_TO_LEGACY,
    ([unicode, legacy]) => [legacy, unicode],
  ),
  ['KUN', '෴'],
  ['›', 'ශ්‍රී'],
  ['ø', 'ද්‍ර'],
  ['µ', 'ද්‍ය'],
  ['…', 'ත්‍ව'],
  ['‡', 'න්‍ද'],
  ['†', 'ත්‍ථ'],
  ['Þ', 'දා'],
  ['±', 'දැ'],
  ['ˆ', 'න්‍දා'],
]);

const SPECIAL_LEGACY_TOKENS = Array.from(SPECIAL_LEGACY_SEQUENCES.keys())
  .sort((a, b) => b.length - a.length);

const SINHALA_RE = /[\u0D80-\u0DFF]/u;

function startsWithAt(text, token, index) {
  return text.startsWith(token, index);
}

function readLegacyBase(text, index) {
  for (const token of LEGACY_BASE_TOKENS) {
    if (startsWithAt(text, token, index)) {
      return { text: LEGACY_TO_BASE.get(token), next: index + token.length };
    }
  }
  return null;
}

function readLegacyCore(text, index) {
  // Common conjunct-prefix slots. C + I is the traditional ksha sequence;
  // the same prefix mechanism also preserves the other joined consonants.
  if (startsWithAt(text, 'CI', index)) {
    return { text: `ක${VIRAMA}${ZWJ}ෂ`, next: index + 2 };
  }
  if (startsWithAt(text, 'CO', index)) {
    return { text: 'ඣ', next: index + 2 };
  }

  const joinedPrefix = { C: 'ක', F: 'ත', J: 'න' }[text[index]];
  if (joinedPrefix) {
    const following = readLegacyBase(text, index + 1);
    if (following) {
      return {
        text: `${joinedPrefix}${VIRAMA}${ZWJ}${following.text}`,
        next: following.next,
      };
    }
    return { text: `${joinedPrefix}${VIRAMA}${ZWJ}`, next: index + 1 };
  }

  const base = readLegacyBase(text, index);
  if (!base) return null;

  if (text[base.next] === 'H') {
    return { text: `${base.text}${YANSAYA}`, next: base.next + 1 };
  }
  if (text[base.next] === '%') {
    return { text: `${base.text}${RAKAARAANSAYA}`, next: base.next + 1 };
  }
  return base;
}

function readLegacyPrefixCluster(text, index) {
  const isAi = startsWithAt(text, 'ff', index);
  if (!isAi && text[index] !== 'f') return null;

  const prefixLength = isAi ? 2 : 1;
  let core = readLegacyCore(text, index + prefixLength);
  if (!core) return null;

  // Some older converters store long-e before rakaaransaya as f + base + a%,
  // while this app emits the less ambiguous f + base + % + a. Accept both.
  if (!isAi && text[core.next] === 'a' && text[core.next + 1] === '%') {
    core = {
      text: `${core.text}${RAKAARAANSAYA}`,
      next: core.next + 2,
    };
    return { text: `${core.text}ේ`, next: core.next };
  }

  if (isAi) return { text: `${core.text}ෛ`, next: core.next };
  if (startsWithAt(text, 'da', core.next)) {
    return { text: `${core.text}ෝ`, next: core.next + 2 };
  }
  if (text[core.next] === 'd') {
    return { text: `${core.text}ො`, next: core.next + 1 };
  }
  if (text[core.next] === 'a') {
    return { text: `${core.text}ේ`, next: core.next + 1 };
  }
  if (text[core.next] === '!') {
    return { text: `${core.text}ෞ`, next: core.next + 1 };
  }
  return { text: `${core.text}ෙ`, next: core.next };
}

function readLegacyCluster(text, index) {
  const prefixed = readLegacyPrefixCluster(text, index);
  if (prefixed) return prefixed;

  const core = readLegacyCore(text, index);
  if (!core) return null;

  for (const token of ['DD', 'a', 'A', 'd', 'e', 'E', 's', 'S', 'q', '=', 'Q', '+', 'D']) {
    if (startsWithAt(text, token, core.next)) {
      return {
        text: `${core.text}${LEGACY_POSTBASE_SIGNS.get(token)}`,
        next: core.next + token.length,
      };
    }
  }
  return core;
}

function normalizeSinhalaUnicode(text) {
  return text
    // The historical LTRL table emits an extra leading ZWJ for rakaaransaya.
    // Unicode requires consonant + virama + ZWJ + ra/ya.
    .replace(/\u200D\u0DCA\u200D(?=[\u0DBA\u0DBB])/gu, `${VIRAMA}${ZWJ}`)
    .normalize('NFC');
}

export function legacyToUnicode(input) {
  const text = String(input ?? '');
  let output = '';
  let fallback = '';

  const flushFallback = () => {
    if (!fallback) return;
    output += normalizeSinhalaUnicode(dlManelToUnicode(fallback));
    fallback = '';
  };

  for (let index = 0; index < text.length;) {
    let match = null;

    for (const token of SPECIAL_LEGACY_TOKENS) {
      if (startsWithAt(text, token, index)) {
        match = { text: SPECIAL_LEGACY_SEQUENCES.get(token), next: index + token.length };
        break;
      }
    }

    if (!match) {
      for (const token of LEGACY_VOWEL_TOKENS) {
        if (startsWithAt(text, token, index)) {
          match = { text: LEGACY_TO_VOWEL.get(token), next: index + token.length };
          break;
        }
      }
    }

    if (!match && LEGACY_PUNCTUATION.has(text[index])) {
      match = { text: LEGACY_PUNCTUATION.get(text[index]), next: index + 1 };
    }

    if (!match) match = readLegacyCluster(text, index);

    if (match) {
      flushFallback();
      output += match.text;
      index = match.next;
    } else {
      // Keep unrecognised spans together so the source converter can still
      // match old precomposed multi-glyph forms such as fí ("be").
      fallback += text[index];
      index += 1;
    }
  }

  flushFallback();
  return normalizeSinhalaUnicode(output);
}

function readUnicodeCore(characters, index) {
  const base = characters[index];
  const legacyBase = BASE_TO_LEGACY.get(base);
  if (!legacyBase) return null;

  if (characters[index + 1] === VIRAMA && characters[index + 2] === ZWJ) {
    const joined = characters[index + 3];
    if (base === 'ක' && joined === 'ෂ') {
      return { text: 'CI', next: index + 4, base };
    }
    if (joined === 'ය') {
      return { text: `${legacyBase}H`, next: index + 4, base };
    }
    if (joined === 'ර') {
      return { text: `${legacyBase}%`, next: index + 4, base };
    }
    const prefix = { 'ක': 'C', 'ත': 'F', 'න': 'J' }[base];
    const joinedLegacy = BASE_TO_LEGACY.get(joined);
    if (prefix && joinedLegacy) {
      return { text: `${prefix}${joinedLegacy}`, next: index + 4, base };
    }
    // There is no safe glyph slot for every possible touching/conjunct form.
    // Preserve unsupported Unicode instead of silently changing the letters.
    return {
      text: `${base}${VIRAMA}${ZWJ}${joined ?? ''}`,
      next: index + (joined ? 4 : 3),
      base,
      passthrough: true,
    };
  }

  if (characters[index + 1] === VIRAMA) {
    return { text: `${legacyBase}a`, next: index + 2, base, hasVirama: true };
  }
  return { text: legacyBase, next: index + 1, base };
}

export function unicodeToLegacy(input) {
  const characters = Array.from(normalizeSinhalaUnicode(String(input ?? '')));
  let output = '';

  for (let index = 0; index < characters.length;) {
    const char = characters[index];

    const precomposed = PRECOMPOSED_CLUSTER_TO_LEGACY.get(
      `${char}${characters[index + 1] ?? ''}`,
    );
    if (precomposed) {
      output += precomposed;
      index += 2;
      continue;
    }

    if (VOWEL_TO_LEGACY.has(char)) {
      output += VOWEL_TO_LEGACY.get(char);
      index += 1;
      continue;
    }

    if (char === 'ං') {
      output += 'x';
      index += 1;
      continue;
    }
    if (char === 'ඃ') {
      output += '#';
      index += 1;
      continue;
    }
    if (char === '෴') {
      output += 'KUN';
      index += 1;
      continue;
    }

    const core = readUnicodeCore(characters, index);
    if (core) {
      index = core.next;
      if (core.passthrough || core.hasVirama) {
        output += core.text;
        continue;
      }

      const sign = characters[index];
      if (PREFIX_SIGNS.has(sign)) {
        const [prefix, suffix] = PREFIX_SIGNS.get(sign);
        output += `${prefix}${core.text}${suffix}`;
        index += 1;
        continue;
      }
      if (POSTBASE_SIGNS.has(sign)) {
        const useAlternateU = (sign === 'ු' || sign === 'ූ')
          && 'කගඟතභශ'.includes(core.base);
        const legacySign = useAlternateU
          ? (sign === 'ු' ? '=' : '+')
          : POSTBASE_SIGNS.get(sign);
        output += `${core.text}${legacySign}`;
        index += 1;
        continue;
      }

      output += core.text;
      continue;
    }

    output += UNICODE_PUNCTUATION.get(char) ?? char;
    index += 1;
  }

  return output;
}

export function hasSinhalaUnicode(text) {
  return SINHALA_RE.test(String(text ?? ''));
}

export function convertSinhalaEncoding(text, direction) {
  if (direction === 'legacy-to-unicode') return legacyToUnicode(text);
  if (direction === 'unicode-to-legacy') return unicodeToLegacy(text);
  throw new TypeError(`Unsupported Sinhala conversion direction: ${direction}`);
}
