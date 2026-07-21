export type Publication = {
  slug: string;
  title: string;
  authors: string[];
  venue: string;
  year: number;
  abstract: string;
  href?: string;
  tag: "paper" | "thesis" | "poster";
};

export const publications: Publication[] = [
  {
    slug: "sinllama-adapters",
    title:
      "SinLlama: Extending Llama-3 for Style-Controlled Sinhala Newspaper Writing",
    authors: [
      "Wickramasinghe, C.",
      "Perera, N.",
      "Fernando, I.",
      "Jayasooriya, D.",
      "Weerasinghe, R.",
    ],
    venue: "R26-SE-037, Undergraduate Research Symposium",
    year: 2026,
    abstract:
      "We present SinLlama, a Llama-3-8B model extended with Sinhala tokenization and fine-tuned with per-task LoRA adapters for grammar correction, headline generation, style rewriting, and summarization.",
    tag: "paper",
  },
  {
    slug: "sinhala-grammar-correction",
    title: "Low-Resource Grammar Correction for Sinhala News Text",
    authors: ["Wickramasinghe, C.", "Weerasinghe, R."],
    venue: "Working paper",
    year: 2026,
    abstract:
      "An evaluation of LoRA-adapted decoder-only models for Sinhala grammar and punctuation correction, compared against rule-based baselines on newspaper corpora.",
    tag: "paper",
  },
  {
    slug: "newsroom-style-transfer",
    title: "Five Newsroom Styles: Controllable Rewriting for Sinhala Journalism",
    authors: ["Jayasooriya, D.", "Perera, N."],
    venue: "Departmental thesis",
    year: 2026,
    abstract:
      "A style-conditioned rewriting adapter that transforms a single article into formal, sports, youth, editorial, and feature tones while preserving factual content.",
    tag: "thesis",
  },
];
