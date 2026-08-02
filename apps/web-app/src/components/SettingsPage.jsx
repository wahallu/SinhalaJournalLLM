import { useState } from 'react';
import { ArrowLeft, Sliders, RotateCcw, CheckCircle2, Settings as SettingsIcon } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import Dropdown from './ui/Dropdown';
import { Card } from './ui/Card';
import { TONES, LENGTHS, HEADLINE_COUNTS } from '../lib/toolOptions';

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
  defaultTone: 'formal',
  defaultLength: 'short',
  headlineCount: 5,
};

const LABEL_CLASS = 'block text-[12.5px] font-semibold text-ink-700 mb-1.5';

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
  // only came here to change one field.
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
        description="Starting values for the writing tools."
        actions={
          <ActionButton id="settings-back" size="sm" variant="ghost" icon={ArrowLeft} onClick={onBack}>
            Dashboard
          </ActionButton>
        }
      />

      <div className="space-y-4">
        <SettingsSection
          icon={Sliders}
          title="Tool defaults"
          description="Used when you open each writing tool. You can still change them per run from the editor toolbar."
        >
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLASS}>Default tone — Style Rewriter</label>
              <Dropdown
                id="default-tone"
                label="Tone"
                variant="full"
                options={TONES}
                value={settings.defaultTone}
                onChange={(v) => update('defaultTone', v)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Default summary length</label>
                <Dropdown
                  id="default-length"
                  label="Length"
                  variant="full"
                  options={LENGTHS}
                  value={settings.defaultLength}
                  onChange={(v) => update('defaultLength', v)}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Default headline count</label>
                <Dropdown
                  id="headline-count"
                  label="Count"
                  variant="full"
                  options={HEADLINE_COUNTS}
                  value={settings.headlineCount}
                  onChange={(v) => update('headlineCount', v)}
                />
              </div>
            </div>
          </div>
        </SettingsSection>

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
