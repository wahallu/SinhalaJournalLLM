import { SpellCheck, Newspaper, PenLine, FileText, Wand2 } from 'lucide-react';

/**
 * Shared metadata for the four writing tools.
 * Single source for labels and icons used by the dashboard tool grid,
 * App tool config, the sidebar, and the history feed.
 */
export const TOOL_META = {
  grammar: {
    id: 'grammar',
    label: 'Grammar Checker',
    shortDesc: 'Fix Sinhala spelling, grammar, and agreement issues.',
    icon: SpellCheck,
  },
  headlines: {
    id: 'headlines',
    label: 'Headline Generator',
    shortDesc: 'Generate ranked headline candidates from an article.',
    icon: Newspaper,
  },
  rewriter: {
    id: 'rewriter',
    label: 'Style Rewriter',
    shortDesc: 'Shift copy between formal, editorial, sports, and youth desks.',
    icon: PenLine,
  },
  summarizer: {
    id: 'summarizer',
    label: 'News Summarizer',
    shortDesc: 'Condense long-form articles into tight summaries.',
    icon: FileText,
  },
};

export const TOOL_LIST = Object.values(TOOL_META);

/**
 * Optimize Article — deliberately outside TOOL_META.
 *
 * It is not a fifth tool: it runs the four above in order and persists under
 * their history tables, so putting it in TOOL_META would add a phantom card
 * to the dashboard grid and a tool label the history feed can never emit.
 * It gets the primary call to action instead.
 */
export const OPTIMIZE_META = {
  id: 'optimize',
  label: 'Optimize Article',
  shortDesc: 'Correct, restyle, headline, and summarize in one run.',
  icon: Wand2,
};
