const PURPOSE_REST =
  "is an AI-powered Sinhala writing and editorial intelligence platform for Google Docs, Chrome, and newsroom workflows.";

/**
 * Site-wide constants. Everything the pages link to or repeat verbatim lives
 * here so a URL or name changes in exactly one place.
 */
export const SITE = {
  // Marketplace-verified branding. The homepage H1, <title>, Navbar logo text
  // and Footer must all keep this exact string.
  name: "SinAI Document Assistant",
  brand: "SinAi",
  origin: "https://sin-ai.app",
  appUrl: "https://chat.sin-ai.app",
  repoUrl: "https://github.com/wahallu/SinhalaJournalLLM",
  docsUrl: "https://github.com/wahallu/SinhalaJournalLLM/tree/main/docs",
  extensionUrl:
    "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/chrome-extension",
  supportEmail: "support@sin-ai.app",
  organisation: "SinAi Research & Engineering Group",
  projectCode: "R26-SE-037",
  researchTitle: "Sinhala Journal LLM",

  // The purpose sentence is Marketplace-verified. Keep it word-for-word:
  // `purposeLead` is "SinAI Document Assistant " + `purposeRest`. The
  // sentence in `purposeDetail` may be edited freely.
  purposeLead: `SinAI Document Assistant ${PURPOSE_REST}`,
  purposeRest: PURPOSE_REST,
  purposeDetail:
    "It corrects grammar, suggests headlines, rewrites articles in five newspaper styles and summarizes long stories.",
} as const;

/** SinLlama is the base model the paper adapts; cite it wherever it is named. */
export const SINLLAMA = {
  name: "SinLlama",
  citation:
    "H. W. K. Aravinda et al., “SinLlama – a large language model for Sinhala”, MERCon 2025, pp. 617–622.",
  url: "https://doi.org/10.1109/MERCon67903.2025.11217094",
} as const;
