import { useState } from 'react';

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

export default function SettingsPage() {
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
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setSaved(false);
  };

  const labelClass = "block text-base font-medium text-gray-700 mb-2";
  const inputClass = "w-full px-4 py-3 text-[15px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200";
  const selectClass = `${inputClass} bg-white cursor-pointer`;
  const hintClass = "text-sm text-gray-400 mt-1.5";

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Settings</h1>
      <p className="text-base text-gray-400 mb-7">Configure tool defaults and API connection.</p>

      <div className="space-y-7">
        {/* API Configuration */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">API Configuration</h2>
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
            <p className={hintClass}>Leave empty to use the default endpoint</p>
          </div>
        </section>

        <hr className="border-gray-100" />

        {/* Default Tool Settings */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Default Tool Settings</h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="default-tone" className={labelClass}>Default Tone (Style Rewriter)</label>
              <select id="default-tone" value={settings.defaultTone} onChange={(e) => update('defaultTone', e.target.value)} className={selectClass}>
                <option value="formal">Formal</option>
                <option value="editorial">Editorial</option>
                <option value="youth">Youth</option>
              </select>
            </div>

            <div>
              <label htmlFor="default-length" className={labelClass}>Default Summary Length</label>
              <select id="default-length" value={settings.defaultLength} onChange={(e) => update('defaultLength', e.target.value)} className={selectClass}>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
              </select>
            </div>

            <div>
              <label htmlFor="headline-count" className={labelClass}>Default Headline Count</label>
              <select id="headline-count" value={settings.headlineCount} onChange={(e) => update('headlineCount', Number(e.target.value))} className={selectClass}>
                <option value={3}>3 Headlines</option>
                <option value={5}>5 Headlines</option>
                <option value={7}>7 Headlines</option>
              </select>
            </div>
          </div>
        </section>

        <hr className="border-gray-100" />

        <div className="flex items-center gap-3">
          <button
            id="save-settings"
            onClick={handleSave}
            className="px-6 py-2.5 bg-accent text-white text-base font-medium rounded-lg
              hover:bg-accent-hover active:scale-[0.98] transition-all duration-100 cursor-pointer"
          >
            {saved ? 'Saved ✓' : 'Save Settings'}
          </button>
          <button
            id="reset-settings"
            onClick={handleReset}
            className="px-5 py-2.5 text-base font-medium text-gray-400 rounded-lg
              hover:text-gray-600 hover:bg-gray-50 transition-colors duration-100 cursor-pointer"
          >
            Reset Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
