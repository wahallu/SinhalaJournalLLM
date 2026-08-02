import { SpellCheck, Newspaper, PenLine, FileText } from 'lucide-react';

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
