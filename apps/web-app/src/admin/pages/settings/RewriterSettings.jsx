import SettingsPanel from './SettingsPanel';

export default function RewriterSettings() {
  return (
    <SettingsPanel
      title="Style Rewriter"
      description="Availability, default tone, and adapter override."
      groups={['Style Rewriter']}
    />
  );
}
