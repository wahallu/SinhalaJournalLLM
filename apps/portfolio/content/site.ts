/**
 * Site-wide constants. Everything the pages link to or repeat verbatim lives
 * here so a URL or name changes in exactly one place.
 */
export const SITE = {
  name: "SinAi",
  brand: "SinAi",
  origin: "https://sin-ai.app",
  appUrl: "https://chat.sin-ai.app",
  repoUrl: "https://github.com/wahallu/SinhalaJournalLLM",
  docsUrl: "https://github.com/wahallu/SinhalaJournalLLM/tree/main/docs",
  extensionUrl:
    "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/chrome-extension",
  docsAddonUrl:
    "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/docs-addon",
  supportEmail: "support@sin-ai.app",
  // Shown as written; the tel: link uses the international form.
  contactPhone: "071 076 7697",
  contactPhoneHref: "tel:+94710767697",
  organisation: "SinAi Research & Engineering Group",
  projectCode: "R26-SE-037",
  researchTitle: "Sinhala Journal LLM",
} as const;

/** SinLlama is the base model the paper adapts; cite it wherever it is named. */
export const SINLLAMA = {
  name: "SinLlama",
  citation:
    "H. W. K. Aravinda et al., “SinLlama – a large language model for Sinhala”, MERCon 2025, pp. 617–622.",
  url: "https://doi.org/10.1109/MERCon67903.2025.11217094",
} as const;
