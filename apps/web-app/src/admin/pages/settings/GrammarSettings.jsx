import SettingsPanel from './SettingsPanel';

/**
 * Grammar Checker settings.
 *
 * The only tool with an "Advanced" section today: the self-consistency
 * ensemble (grammar.ensemble_size) is a real generation-quality knob, unlike
 * the other three tools, which have nothing past their adapter override yet.
 * The former second correction pass isn't here to configure — it was removed
 * outright (see grammar_service.py), not turned into a setting: it doubled
 * GPU cost on every changed request and made the result a correction of the
 * model's own first-pass output rather than of the original article, which
 * made a production check incomparable to a single-pass run over the same
 * text (e.g. the admin Comparison tool) even under the same adapter.
 */
export default function GrammarSettings() {
  return (
    <SettingsPanel
      title="Grammar Checker"
      description="Controls for grammar correction, separate from the other three tools since it's the only one with advanced settings today."
      groups={['Grammar', 'Grammar Advanced']}
    />
  );
}
