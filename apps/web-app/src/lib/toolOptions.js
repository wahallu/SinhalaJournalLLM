/**
 * Option lists for the writing tools' request parameters.
 *
 * Single source shared by the editor toolbar and the Settings page. Every
 * value here is accepted by the corresponding backend endpoint — headline
 * `style` is deliberately absent because services/api.js does not send it.
 */

export const TONES = [
  { id: 'formal', label: 'Formal', desc: 'Broadsheet news desk voice' },
  { id: 'editorial', label: 'Editorial', desc: 'Analytical opinion writing' },
  { id: 'sports', label: 'Sports', desc: 'Fast, energetic sports desk' },
  { id: 'feature', label: 'Feature', desc: 'Narrative long-form style' },
  { id: 'youth', label: 'Youth', desc: 'Casual, social-media friendly' },
];

export const LENGTHS = [
  { id: 'short', label: 'Short', desc: 'Brief summary (~10% length)' },
  { id: 'medium', label: 'Medium', desc: 'Standard summary (~20% length)' },
  { id: 'long', label: 'Long', desc: 'Detailed summary (~35% length)' },
];

export const SUMMARY_VIEWS = [
  { id: 'paragraph', label: 'Paragraph' },
  { id: 'bullets', label: 'Bullets' },
];

// Word bands, mirroring HEADLINE_LENGTHS in the backend's app/core/prompts.py.
// Non-overlapping, so a headline's word count maps to exactly one band.
export const HEADLINE_LENGTHS_OPTIONS = [
  { id: 'short', label: 'Short', desc: '3–5 words' },
  { id: 'medium', label: 'Medium', desc: '6–7 words' },
  { id: 'long', label: 'Long', desc: '8–10 words' },
];

export const HEADLINE_COUNTS = [
  { id: 3, label: '3 headlines' },
  { id: 5, label: '5 headlines' },
  { id: 7, label: '7 headlines' },
];

export const HEADLINE_CATEGORIES = [
  { id: 'General', label: 'General' },
  { id: 'Politics', label: 'Politics' },
  { id: 'Business', label: 'Business' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Entertainment', label: 'Entertainment' },
  { id: 'Tech', label: 'Tech' },
  { id: 'World', label: 'World' },
];

/**
 * Which dropdowns each tool shows in its editor toolbar, keyed by the
 * settings field each one drives.
 *
 * Request parameters only — display options (the summarizer's
 * paragraph/bullets toggle) live on the results pane instead, because they
 * do not change the request. Grammar is deliberately empty:
 * POST /grammar/check takes only `text`.
 *
 * Lives here rather than in EditorToolbar.jsx because a file that exports
 * both a component and an object trips react-refresh/only-export-components.
 */
export const TOOLBAR_CONTROLS = {
  grammar: [],
  // Optimize's parameters are on its own pipeline bar, not the editor
  // toolbar: two of them belong to stages that may not run, so they have to
  // appear next to the toggle that enables them.
  optimize: [],
  headlines: [
    { key: 'headlineLength', label: 'Length', options: HEADLINE_LENGTHS_OPTIONS },
    { key: 'count', label: 'Count', options: HEADLINE_COUNTS },
    { key: 'category', label: 'Category', options: HEADLINE_CATEGORIES },
  ],
  rewriter: [{ key: 'tone', label: 'Tone', options: TONES }],
  summarizer: [{ key: 'length', label: 'Length', options: LENGTHS }],
};
