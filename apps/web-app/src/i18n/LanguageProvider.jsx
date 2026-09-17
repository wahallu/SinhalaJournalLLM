import { useCallback, useMemo, useState } from 'react';
import { LanguageContext } from './LanguageContext.js';
import { DEFAULT_LANGUAGE, LANGUAGES, STRINGS } from './strings.js';
import { toLegacyDisplay } from './legacyDisplay.js';

const STORAGE_KEY = 'sinai_lang';

/**
 * Language choice, and the two ways to read a string out of the catalogue.
 *
 * Device-scoped, NOT account-scoped like the theme. That difference is
 * deliberate: almost every run of these tools is anonymous (the study
 * reaches journalism students through a WhatsApp group), so tying the
 * language to an account would mean the people most likely to want Sinhala
 * are the ones who cannot keep it.
 *
 *   t(key)   the string to DISPLAY — English, or Sinhala already converted
 *            to the legacy ubin16s encoding the newsroom font renders.
 *   tu(key)  the same string in UNICODE — what assistive technology, the
 *            page's own lang attributes, and anything copied out should get.
 *            Legacy is glyph slots on Latin code points; a screen reader
 *            given it reads nonsense.
 */
function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.id === stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    // Private browsing, or storage disabled entirely.
    return DEFAULT_LANGUAGE;
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStored);

  const setLang = useCallback((next) => {
    const resolved = LANGUAGES.some((l) => l.id === next) ? next : DEFAULT_LANGUAGE;
    setLangState(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, resolved);
    } catch {
      // Not fatal — the choice simply does not outlive the tab.
    }
  }, []);

  const value = useMemo(() => {
    const unicode = (key) => {
      const entry = STRINGS[key];
      if (!entry) return key;
      return lang === 'si' ? entry[1] : entry[0];
    };

    return {
      lang,
      setLang,
      tu: unicode,
      t: (key) => (lang === 'si' ? toLegacyDisplay(unicode(key)) : unicode(key)),
    };
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}
