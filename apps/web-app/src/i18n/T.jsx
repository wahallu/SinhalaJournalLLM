import { useLanguage } from './useLanguage.js';

/**
 * A translated string, rendered so a reader and a screen reader each get
 * something correct.
 *
 * In Sinhala the visible span carries the legacy encoding and the ubin16s
 * face and is hidden from assistive technology; a visually-hidden sibling
 * carries the real Unicode. Without that pair a screen reader would announce
 * the legacy glyph slots literally — "WmlrK mqjrej" — because that is
 * genuinely what the characters are.
 *
 * In English it renders the bare string with no wrapper, so nothing about
 * the markup changes for the default language.
 */
export function T({ k, className = '' }) {
  const { lang, t, tu } = useLanguage();

  if (lang !== 'si') return t(k);

  return (
    <>
      <span aria-hidden="true" className={`font-legacy-sinhala ${className}`}>
        {t(k)}
      </span>
      <span className="sr-only" lang="si">{tu(k)}</span>
    </>
  );
}
