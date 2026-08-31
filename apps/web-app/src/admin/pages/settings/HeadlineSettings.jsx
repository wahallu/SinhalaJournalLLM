import SettingsPanel from './SettingsPanel';

export default function HeadlineSettings() {
  return (
    <SettingsPanel
      title="Headline Generator"
      description="Availability, default candidate count, adapter override, and the image model used for visual prompts."
      groups={['Headline Generator', 'Image Generation']}
    />
  );
}
