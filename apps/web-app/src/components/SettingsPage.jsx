import { useState } from 'react';
import { ArrowLeft, Globe, Sliders, RotateCcw, CheckCircle2, Info, Settings as SettingsIcon } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import { Card } from './ui/Card';
import { DEFAULT_API_BASE } from '../services/api';

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('sinai_settings') || '{}');
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  localStorage.setItem('sinai_settings', JSON.stringify(settings));
}

const DEFAULT_SETTINGS = {
  apiBaseUrl: '',
  defaultTone: 'formal',
  defaultLength: 'short',
  headlineCount: 5,
};

const LABEL_CLASS = 'block text-[12.5px] font-semibold text-ink-700 mb-1.5';
const INPUT_CLASS = `w-full px-3.5 py-2.5 text-[14px] text-ink-800 border border-ink-200 rounded-xl bg-white
  placeholder:text-ink-400 transition-all duration-150
  focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]`;
const SELECT_CLASS = `${INPUT_CLASS} cursor-pointer`;

function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-8.5 h-8.5 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <Icon size={15} className="text-brand-600" strokeWidth={2.25} />
        </div>
        <div>
          <h2 className="text-[13.5px] font-bold text-ink-900">{title}</h2>
          {description && <p className="text-[11.5px] text-ink-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function SettingsPage({ onBack, onDefaultsChange }) {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...getSettings(),
  }));
  const [saved, setSaved] = useState(false);
  // Which fields the user actually edited this visit. Saving everything on
  // screen would convert the displayed fallbacks into explicit choices,
  // permanently overriding the admin's global defaults even for someone who
  // only came here to change the API URL.
  const [touched, setTouched] = useState(() => new Set());

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => new Set(prev).add(key));
    setSaved(false);
  };

  const handleSave = () => {
    const stored = getSettings();
    const next = { ...stored };
    for (const key of touched) next[key] = settings[key];

    saveSettings(next);
    onDefaultsChange?.(next);
    setTouched(new Set());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    // Clear the stored overrides entirely rather than writing the fallbacks
    // back — that is what lets the admin's global defaults apply again.
    saveSettings({});
    setSettings({ ...DEFAULT_SETTINGS });
    setTouched(new Set());
    onDefaultsChange?.({});
    setSaved(false);
  };

  return (
    <div>
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        description="Tool defaults and API connection."
        actions={
          <ActionButton id="settings-back" size="sm" variant="ghost" icon={ArrowLeft} onClick={onBack}>
            Dashboard
          </ActionButton>
        }
      />

      <div className="space-y-4">
        {/* API configuration */}
        <SettingsSection
          icon={Globe}
          title="API configuration"
          description="Where SinAi sends grammar, headline, rewrite, and summary requests."
        >
          <label htmlFor="api-url" className={LABEL_CLASS}>API base URL</label>
          <input
            id="api-url"
            type="url"
            value={settings.apiBaseUrl}
            onChange={(e) => update('apiBaseUrl', e.target.value)}
            placeholder={DEFAULT_API_BASE}
            className={INPUT_CLASS}
          />
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-500 mt-2">
            <Info size={11} className="shrink-0" />
            Leave empty to use the default hosted endpoint.
          </p>
        </SettingsSection>

        {/* Tool defaults */}
        <SettingsSection
          icon={Sliders}
          title="Tool defaults"
          description="Starting values used when you open each writing tool."
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="default-tone" className={LABEL_CLASS}>Default tone — Style Rewriter</label>
              <select
                id="default-tone"
                value={settings.defaultTone}
                onChange={(e) => update('defaultTone', e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="formal">Formal</option>
                <option value="editorial">Editorial</option>
                <option value="youth">Youth</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="default-length" className={LABEL_CLASS}>Default summary length</label>
                <select
                  id="default-length"
                  value={settings.defaultLength}
                  onChange={(e) => update('defaultLength', e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                </select>
              </div>

              <div>
                <label htmlFor="headline-count" className={LABEL_CLASS}>Default headline count</label>
                <select
                  id="headline-count"
                  value={settings.headlineCount}
                  onChange={(e) => update('headlineCount', Number(e.target.value))}
                  className={SELECT_CLASS}
                >
                  <option value={3}>3 headlines</option>
                  <option value={5}>5 headlines</option>
                  <option value={7}>7 headlines</option>
                </select>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Actions */}
        <div className="flex items-center gap-2.5 pt-1">
          <ActionButton
            id="save-settings"
            variant="primary"
            size="lg"
            icon={saved ? CheckCircle2 : undefined}
            onClick={handleSave}
            className={saved ? '!bg-emerald-500 hover:!bg-emerald-600 !shadow-emerald-500/25' : ''}
          >
            {saved ? 'Saved' : 'Save settings'}
          </ActionButton>
          <ActionButton id="reset-settings" variant="ghost" size="lg" icon={RotateCcw} onClick={handleReset}>
            Reset defaults
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
