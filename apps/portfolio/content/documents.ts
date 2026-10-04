export type DocumentCategory = "document" | "presentation" | "publication";

export interface PortfolioDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  document_type: string;
  submitted_at: string | null;
  description: string | null;
  file_name: string;
  file_url: string;
  mime_type: string;
  size_bytes: number;
  is_published: boolean;
  sort_order: number;
}

/**
 * Documents supplied with the project. The public component keeps this list
 * available if the API is offline, while admin uploads are loaded live.
 */
export const BUNDLED_DOCUMENTS: PortfolioDocument[] = [
  {
    id: "topic-assessment",
    title: "Topic Assessment Form",
    category: "document",
    document_type: "Group",
    submitted_at: null,
    description: "Approved research topic and initial project scope for R26-SE-037.",
    file_name: "topic-assessment-form.pdf",
    file_url: "/documents/topic-assessment-form.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 0,
  },
  {
    id: "proposal-grammar",
    title: "Proposal Report - Sinhala Grammar Checker",
    category: "document",
    document_type: "Individual",
    submitted_at: "2026-03-13",
    description: "IT22207272 individual proposal report.",
    file_name: "proposal-grammar-checker.pdf",
    file_url: "/documents/proposal-grammar-checker.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 1,
  },
  {
    id: "proposal-headline",
    title: "Proposal Report - Headline and Image Generator",
    category: "document",
    document_type: "Individual",
    submitted_at: "2026-03-12",
    description: "IT22228062 individual proposal report.",
    file_name: "proposal-headline-generator.pdf",
    file_url: "/documents/proposal-headline-generator.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 2,
  },
  {
    id: "proposal-summary",
    title: "Proposal Report - Sinhala News Summarizer",
    category: "document",
    document_type: "Individual",
    submitted_at: "2026-03-13",
    description: "IT22049872 individual proposal report.",
    file_name: "proposal-news-summarizer.pdf",
    file_url: "/documents/proposal-news-summarizer.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 3,
  },
  {
    id: "proposal-style",
    title: "Proposal Report - Article Style Rewriter",
    category: "document",
    document_type: "Individual",
    submitted_at: "2026-03-12",
    description: "IT22246332 individual proposal report.",
    file_name: "proposal-style-rewriter.pdf",
    file_url: "/documents/proposal-style-rewriter.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 4,
  },
  {
    id: "proposal-presentation",
    title: "Proposal Presentation",
    category: "presentation",
    document_type: "Group",
    submitted_at: "2026-03-16",
    description: "Research problem, proposed solution, objectives, and methodology.",
    file_name: "proposal-presentation.pdf",
    file_url: "/documents/proposal-presentation.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 0,
  },
  {
    id: "progress-presentation-1",
    title: "Progress Presentation 1",
    category: "presentation",
    document_type: "Group",
    submitted_at: "2026-05-11",
    description: "Progress, component status, architecture, and evaluation plan.",
    file_name: "progress-presentation-1.pdf",
    file_url: "/documents/progress-presentation-1.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 1,
  },
  {
    id: "progress-presentation-2",
    title: "Progress Presentation 2",
    category: "presentation",
    document_type: "Group",
    submitted_at: null,
    description: "Updated datasets, four task adapters, and product progress.",
    file_name: "progress-presentation-2.pdf",
    file_url: "/documents/progress-presentation-2.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 2,
  },
  {
    id: "research-paper",
    title: "SinhalaJournal-LLM Research Paper",
    category: "publication",
    document_type: "Research paper",
    submitted_at: "2026-09-03",
    description:
      "Data-centric adaptation and reliable evaluation of a Sinhala language model for journalism.",
    file_name: "sinhalajournal-llm-research-paper.pdf",
    file_url: "/documents/sinhalajournal-llm-research-paper.pdf",
    mime_type: "application/pdf",
    size_bytes: 0,
    is_published: true,
    sort_order: 0,
  },
];
