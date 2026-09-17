import { createContext } from 'react';
import { DEFAULT_LANGUAGE } from './strings.js';

export const LanguageContext = createContext({
  lang: DEFAULT_LANGUAGE,
  setLang: () => {},
  t: (key) => key,
  tu: (key) => key,
});
