import { useState } from 'react';
import { ArrowLeft, Globe, Sliders, RotateCcw, CheckCircle2, Info } from 'lucide-react';

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

export default function SettingsPage({ onBack }) {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...getSettings(),
  }));
  const [saved, setSaved] = useState(false);

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setSaved(false);
  };

  const labelClass = 'block text-sm font-medium text-gray-600 mb-1.5';
  const inputClass =
    'w-full px-4 py-3 text-[15px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#cd191a]/50 focus:ring-2 focus:ring-[#cd191a]/10 transition-all duration-150 bg-white';
  const selectClass = `${inputClass} cursor-pointer`;
  const hintClass = 'flex items-center gap-1.5 text-xs text-gray-400 mt-1.5';

  return (
    <div className="max-w-xl">
      {/* Back button header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          id="settings-back"
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-400
            hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50
            transition-all duration-150 cursor-pointer shrink-0"
          title="Back to Dashboard"
        >
          <ArrowLeft size={17} strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight">Settings</h1>
          <p className="text-sm text-gray-400 mt-0.5">Configure tool defaults and API connection</p>
        </div>
      </div>

      <div className="space-y-7">
        {/* API Configuration */}
        <section className="p-5 rounded-2xl border border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Globe size={14} className="text-blue-500" />
            </div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">API Configuration</h2>
          </div>
          <div>
            <label htmlFor="api-url" className={labelClass}>API Base URL</label>
            <input
              id="api-url"
              type="url"
              value={settings.apiBaseUrl}
              onChange={(e) => update('apiBaseUrl', e.target.value)}
              placeholder="http://localhost:8000/api"
              className={`${inputClass} placeholder-gray-300`}
            />
            <p className={hintClass}>
              <Info size={11} />
              Leave empty to use the default endpoint
            </p>
          </div>
        </section>

        {/* Default Tool Settings */}
        <section className="p-5 rounded-2xl border border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <Sliders size={14} className="text-purple-500" />
            </div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Default Tool Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="default-tone" className={labelClass}>Default Tone — Style Rewriter</label>
              <select
                id="default-tone"
                value={settings.defaultTone}
                onChange={(e) => update('defaultTone', e.target.value)}
                className={selectClass}
              >
                <option value="formal">Formal</option>
                <option value="editorial">Editorial</option>
                <option value="youth">Youth</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="default-length" className={labelClass}>Default Summary Length</label>
                <select
                  id="default-length"
                  value={settings.defaultLength}
                  onChange={(e) => update('defaultLength', e.target.value)}
                  className={selectClass}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                </select>
              </div>

              <div>
                <label htmlFor="headline-count" className={labelClass}>Default Headline Count</label>
                <select
                  id="headline-count"
                  value={settings.headlineCount}
                  onChange={(e) => update('headlineCount', Number(e.target.value))}
                  className={selectClass}
                >
                  <option value={3}>3 Headlines</option>
                  <option value={5}>5 Headlines</option>
                  <option value={7}>7 Headlines</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-gray-100" />

        <div className="flex items-center gap-3">
          <button
            id="save-settings"
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded-xl
              active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-sm
              ${saved
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-[#cd191a] hover:bg-[#b01517]'}`}
          >
            {saved ? (
              <>
                <CheckCircle2 size={15} />
                Saved
              </>
            ) : (
              'Save Settings'
            )}
          </button>
          <button
            id="reset-settings"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-400 rounded-xl
              hover:text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200
              transition-all duration-150 cursor-pointer"
          >
            <RotateCcw size={14} />
            Reset Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
