import SettingsPanel from './SettingsPanel';

export default function SummarizerSettings() {
  return (
    <SettingsPanel
      title="News Summarizer"
      description="Availability, default length, and adapter override."
      groups={['News Summarizer']}
    />
  );
}
