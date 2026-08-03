import SettingsPanel from './settings/SettingsPanel';

/**
 * Platform-wide settings: the model gateway and the anonymous-usage limit.
 *
 * Everything tool-specific (feature toggle, adapter, defaults) moved to that
 * tool's own settings page — see admin/pages/settings/*.jsx — so this page
 * only owns the two groups nothing else claims.
 */
export default function Settings() {
  return (
    <SettingsPanel
      title="Settings"
      description="Applied immediately, without a redeploy. Every change is recorded in the audit log."
      groups={['Model gateway', 'Limits']}
    />
  );
}
