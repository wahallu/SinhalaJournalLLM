import { useContext } from 'react';
import { LanguageContext } from './LanguageContext.js';

/**
 * The current language plus the two ways to read a string.
 *
 *   t(key)   what to DISPLAY — English, or Sinhala already in the legacy
 *            ubin16s encoding. Use for attributes (placeholder, value).
 *   tu(key)  the same string in UNICODE — for aria-label, title, and
 *            anywhere the text is read rather than drawn.
 *
 * For body text prefer the <T> component, which handles both at once.
 */
export function useLanguage() {
  return useContext(LanguageContext);
}
