# Sinhala legacy-font and Unicode conversion

## Decision

The web app supports bidirectional conversion for the legacy character layout
used by its bundled `apps/web-app/public/ubin16s.ttf` font. The font identifies
itself as **Su_Nirmala** and uses the same core glyph slots found in the common
FM Abhaya / DL-Manel converter tables.

This is deliberately not advertised as a converter for every Sinhala legacy
font. “Legacy” is a category, not a standard encoding: Kaputa, Thibus, Bamini,
Amalee, FM/DL families, and other fonts can assign different Sinhala glyphs to
the same Latin byte. A converter must know the source font's mapping.

## Why substitution alone is insufficient

Legacy Sinhala fonts store Latin/Windows-1252 code points and make the font
draw Sinhala glyphs for them. For example, the bytes `,xld` display as
`ලංකා` only while a compatible legacy font is selected. Without that font,
the stored text is still the literal Latin-looking string `,xld`.

Unicode stores characters from the Sinhala block, U+0D80–U+0DFF, and a shaping
engine draws the correct glyph form. This is logical character order rather
than the visual glyph order used by the legacy font.

The important reordering cases are:

| Case | Legacy visual sequence | Unicode logical sequence |
| --- | --- | --- |
| `කෙ` | `f` + `l` (`fl`) | `ක` U+0D9A + `ෙ` U+0DD9 |
| `කේ` | `f` + `l` + `a` (`fla`) | `ක` + `ේ` U+0DDA |
| `කෛ` | `f` + `f` + `l` (`ffl`) | `ක` + `ෛ` U+0DDB |
| `කො` | `f` + `l` + `d` (`fld`) | `ක` + `ො` U+0DDC |
| `කෝ` | `f` + `l` + `d` + `a` (`flda`) | `ක` + `ෝ` U+0DDD |
| `කෞ` | `f` + `l` + `!` (`fl!`) | `ක` + `ෞ` U+0DDE |

Unicode 17 describes U+0DDC, U+0DDD, and U+0DDE as two-part dependent vowel
signs: their glyph pieces may appear on both sides of the consonant, but the
single Unicode sign follows the consonant in logical order. It also records
the canonical decompositions of these signs; conversion emits the atomic NFC
forms.

Reduced consonant forms must preserve invisible structure as well as visible
shape:

| Form | Required Unicode sequence |
| --- | --- |
| Repaya | `ර` + U+0DCA al-lakuna + U+200D ZWJ |
| Yansaya | U+0DCA al-lakuna + U+200D ZWJ + `ය` |
| Rakaaraansaya | U+0DCA al-lakuna + U+200D ZWJ + `ර` |

The legacy `%` slot represents rakaaraansaya and `H` represents yansaya. The
decoder canonicalizes an older converter-table anomaly that placed an extra
ZWJ before the al-lakuna.

## Conversion pipeline

### Legacy to Unicode

1. Scan longest tokens first so `CO` (ඣ), `CI` (ක්‍ෂ), independent-vowel
   sequences, and known conjunct slots are not split into single characters.
2. Read visual prefix signs (`f` or `ff`), the consonant/conjunct core, and any
   visual suffix.
3. Emit the corresponding logical Unicode cluster.
4. Use the UCSC-LTRL-derived, MIT-licensed Open-SL table only as a fallback for
   old precomposed Windows-1252 glyph slots not produced by this app.
5. Repair the historical extra-ZWJ sequence and normalize the result to NFC.

### Unicode to legacy

1. Normalize Unicode input to NFC.
2. Read a base consonant plus al-lakuna/joiner structure and its dependent
   vowel sign as one cluster.
3. Emit the verified Su-Nirmala/FM-compatible base slot.
4. Move kombuva-family signs to their legacy visual position.
5. Use fitted precomposed slots for narrow-base combinations such as `රි`,
   `දී`, `මි`, and `වී`, plus fitted al-lakuna forms such as `ම්`, `ර්`, and
   `ව්`. Generic zero-advance mark glyphs can extend past those bases and
   visibly collide with adjacent characters. Long-e forms reuse the fitted
   al-lakuna slot after kombuva, and the traditional alternate `=` / `+`
   slots are used for short/long `u` where required.
6. Resolve virama + ZWJ conjuncts before fitted two-character forms. Dedicated
   `ද්‍ර` / `ද්‍ය` slots are used where available; otherwise yansaya and
   rakaaraansaya remain a single legacy cluster. This prevents a fitted
   al-lakuna from consuming the start of `ව්‍ය`, `ධ්‍ය`, or similar forms.
7. Preserve an unsupported Unicode conjunct verbatim instead of silently
   replacing it with different letters.

The transformation runs entirely in the browser. No conversion request or
converted text is sent to the backend.

## Product behavior

The shared `EditorToolbar` renders one compact **Encoding** dropdown on Grammar
Checker, Headline Generator, Style Rewriter, News Summarizer, and Optimize
Article. It contains only **Unicode** and **Legacy**. The selected item shows the
editor's current encoding; choosing the other item converts the value in place.
Legacy output is rendered with the bundled font so it is readable before
copying.

Native browser spellcheck, autocorrect, and third-party grammar overlays are
disabled while the editor is in Legacy mode. Those tools inspect the stored
Latin/Windows-1252 slots rather than the Sinhala glyphs and otherwise draw
misleading red underlines across correctly converted words.

When pasted text has no Sinhala Unicode characters and has not yet been
classified, choosing **Unicode** treats it as legacy input and decodes it;
choosing **Legacy** marks it for legacy-font preview without changing its bytes.

AI endpoints continue to accept Unicode only. When an editor contains legacy
output, its Run button and Ctrl/Cmd+Enter shortcut are disabled; Copy and Clear
remain available. This prevents Latin legacy slots from being submitted to a
model as if they were normal text.

## Inherent limitations

- Source-font identity cannot be inferred reliably from plain text. ASCII such
  as `fl` may be the legacy word `කෙ` or literal Latin text.
- Mixed English and Sinhala cannot be represented reliably in one legacy-font
  run because the same Latin code points are also Sinhala glyph slots. Target
  applications need separate font runs for English.
- Formatting, font names, tables, and layout are not present when users paste
  plain text; only the character stream is converted.
- This implementation does not claim Kaputa, Thibus, Bamini, or every FM/DL
  variant. Additional fonts require separately verified mapping profiles and
  fixtures.
- Unsupported or rare historical conjuncts are preserved rather than guessed.

## Verification

- Unit fixtures cover the app's existing legacy placeholder, visual/logical
  vowel reordering, fitted non-overlapping compound slots,
  yansaya/rakaaraansaya code-point order, punctuation, line breaks, digits,
  and newsroom phrases.
- All 286 Stage 6 grammar inputs round-trip after canonicalizing four inputs
  that already contained the historical non-standard ZWJ-before-al-lakuna
  sequence. No letters change under the canonical comparison.
- Targeted ESLint, the Node unit suite, the Vite production build, and
  `git diff --check` pass.

## Sources

- [The Unicode Standard 17.0 Sinhala code chart](https://www.unicode.org/charts/PDF/U0D80.pdf)
- [The Unicode Standard, Sinhala script behavior](https://www.unicode.org/versions/Unicode16.0.0/core-spec/chapter-13/#G55292) (the cited Sinhala shaping model and named sequences remain applicable in Unicode 17)
- [SLS 1134:2004 draft, Sinhala Character Code for Information Interchange](https://www.unicode.org/L2/L2004/04131-sls1134.pdf)
- [Open-SL Sinhala Unicode converter](https://github.com/Open-SL/sinhala-unicode-converter), which credits the University of Colombo School of Computing Language Technology Research Laboratory's 2011 conversion tables
