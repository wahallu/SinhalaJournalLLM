import SettingsPanel from './SettingsPanel';

export default function HeadlineSettings() {
  return (
    <SettingsPanel
      title="Headline Generator"
      description="Availability, default candidate count, and adapter override."
      groups={['Headline Generator']}
    />
  );
}
