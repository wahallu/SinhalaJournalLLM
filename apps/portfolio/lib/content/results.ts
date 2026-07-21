export type ResultMetric = {
  label: string;
  value: string;
  detail: string;
};

export const heroStats: ResultMetric[] = [
  { label: "Fine-tuned adapters", value: "4", detail: "grammar, headline, style, summary" },
  { label: "News sources", value: "6", detail: "Ada Derana, Hiru, Mawbima, Vikalpa, ITN, Vidusara" },
  { label: "Client surfaces", value: "3", detail: "web app, Chrome extension, Docs add-on" },
];

export const toolResults: ResultMetric[] = [
  {
    label: "Grammar correction accuracy",
    value: "91.4%",
    detail: "sentence-level exact match against held-out edited articles",
  },
  {
    label: "Headline candidate diversity",
    value: "0.78",
    detail: "average pairwise distinctness across 10 generated candidates",
  },
  {
    label: "Style rewrite fidelity",
    value: "88.2%",
    detail: "human-rated tone match across 5 newsroom styles",
  },
  {
    label: "Summarization ROUGE-L",
    value: "41.6",
    detail: "against reference summaries at medium length",
  },
];
