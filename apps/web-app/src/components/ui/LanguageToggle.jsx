import { Languages } from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage.js';
import { LANGUAGES } from '../../i18n/strings.js';

/**
 * English / Sinhala switch.
 *
 * A two-segment control rather than a single flip-icon: both languages are
 * named, so neither has to be guessed from an icon, and the Sinhala label is
 * itself in Sinhala — someone who reads only Sinhala can find it without
 * reading the English one first. That label is the ONE place the legacy
 * face is applied unconditionally, because it has to read as "සිං" whichever
 * language is currently active.
 */
export default function LanguageToggle({ className = '' }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label="Language — භාෂාව"
      className={`inline-flex items-center gap-1 rounded-lg border border-white/20
        bg-white/10 p-0.5 backdrop-blur-sm ${className}`}
    >
      <Languages size={13} className="ml-1.5 mr-0.5 shrink-0 text-white/60" aria-hidden="true" />
      {LANGUAGES.map(({ id, label, short }) => {
        const selected = lang === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            onClick={() => setLang(id)}
            className={`rounded-md px-2 py-[3px] text-[11.5px] font-semibold transition-colors
              cursor-pointer
              ${selected
                ? 'bg-white text-ink-900'
                : 'text-white/70 hover:text-white'}`}
          >
            <span aria-hidden="true" className={id === 'si' ? 'font-legacy-sinhala text-[13px]' : ''}>
              {id === 'si' ? 'isx' : short}
            </span>
          </button>
        );
      })}
    </div>
  );
}
