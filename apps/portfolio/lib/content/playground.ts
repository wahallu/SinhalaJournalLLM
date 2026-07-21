export type PlaygroundToolId = "grammar" | "headline" | "rewrite" | "summarize";

export type PlaygroundTool = {
  id: PlaygroundToolId;
  label: string;
  description: string;
  sampleInput: string;
  sampleInputTranslation: string;
  options?: { id: string; label: string }[];
};

export const playgroundTools: PlaygroundTool[] = [
  {
    id: "grammar",
    label: "Grammar Checker",
    description: "Fixes grammar, spelling, and punctuation while preserving meaning.",
    sampleInput: "මම පාසැල් ගියෙමි අද.",
    sampleInputTranslation: "I went to school today. (word order and spelling corrected)",
  },
  {
    id: "headline",
    label: "Headline Generator",
    description: "Writes concise, engaging Sinhala headlines from an article body.",
    sampleInput:
      "ශ්‍රී ලංකාවේ තාක්ෂණ ක්ෂේත්‍රයේ නව යෙදුමක් හඳුන්වා දී ඇති අතර, එමගින් රටේ තරුණ ප්‍රජාවට නව රැකියා අවස්ථා විවර වනු ඇතැයි අපේක්ෂා කෙරේ.",
    sampleInputTranslation:
      "A new technology app has been introduced in Sri Lanka, expected to open new job opportunities for the youth.",
  },
  {
    id: "rewrite",
    label: "Style Rewriter",
    description: "Rewrites an article in one of five newsroom styles.",
    sampleInput: "නව රෙගුලාසි හෙට සිට ක්‍රියාත්මක වේ.",
    sampleInputTranslation: "New regulations take effect from tomorrow.",
    options: [
      { id: "formal", label: "Formal" },
      { id: "sports", label: "Sports" },
      { id: "youth", label: "Youth" },
      { id: "editorial", label: "Editorial" },
      { id: "feature", label: "Feature" },
    ],
  },
  {
    id: "summarize",
    label: "News Summarizer",
    description: "Abstractive summaries at short, medium, or long length.",
    sampleInput:
      "රජය විසින් අද දින නිකුත් කරන ලද නිවේදනයක දැක්වෙන පරිදි, ඉදිරි වසර තුළ රටේ ප්‍රවාහන පද්ධතිය නවීකරණය කිරීම සඳහා නව ආයෝජන සැලසුමක් ක්‍රියාත්මක කිරීමට නියමිතය.",
    sampleInputTranslation:
      "The government announced a new investment plan to modernize the country's transport system over the coming year.",
    options: [
      { id: "short", label: "Short" },
      { id: "medium", label: "Medium" },
      { id: "long", label: "Long" },
    ],
  },
];

export function getPlaygroundTool(id: PlaygroundToolId) {
  const tool = playgroundTools.find((t) => t.id === id);
  if (!tool) throw new Error(`Unknown playground tool: ${id}`);
  return tool;
}

// Mock responses shaped to match apps/backend-api's /api/v1 payloads,
// so swapping to the real API later is a fetch-call change, not a shape change.

export type GrammarCorrection = { original: string; corrected: string };
export type GrammarResult = { correctedText: string; corrections: GrammarCorrection[] };

export function mockGrammarCheck(): GrammarResult {
  return {
    correctedText: "මම අද පාසැල් ගියෙමි.",
    corrections: [{ original: "මම පාසැල් ගියෙමි අද", corrected: "මම අද පාසැල් ගියෙමි" }],
  };
}

export function mockHeadlines(count = 5): string[] {
  return [
    "නව තාක්ෂණ යෙදුමකින් තරුණ රැකියා අවස්ථා",
    "රැකියා අවස්ථා විවර කරන නව යෙදුම",
    "තාක්ෂණ නවෝත්පාදනයෙන් තරුණ අනාගතයක්",
    "නව යෙදුමක් - තරුණ ප්‍රජාවට ශුභාරංචියක්",
    "රැකියා අවස්ථා: තාක්ෂණ ක්ෂේත්‍රයේ නව පිබිදීමක්",
  ].slice(0, count);
}

export function mockRewrite(tone: string): string {
  const rewrites: Record<string, string> = {
    formal: "නව රෙගුලාසි හෙට දින සිට ක්‍රියාත්මක වන බව අදාළ බලධාරීන් නිවේදනය කර ඇත.",
    sports: "හෙට සිට ක්‍රීඩා ක්ෂේත්‍රයට අදාළ නව රෙගුලාසි ක්‍රියාත්මක වේ.",
    youth: "හෙට ඉඳන් අලුත් රුල්ස් ටික ක්‍රියාත්මක වෙනවා, දැනගෙන ඉන්න.",
    editorial: "නව රෙගුලාසි ක්‍රියාත්මක කිරීම යහපත් තීරණයක් ලෙස සැලකිය හැකිය.",
    feature: "හෙට උදෑසනින් පටන් රටේ ජනතාවගේ දෛනික ජීවිතයට බලපාන නව රෙගුලාසි ක්‍රියාත්මක වීමට නියමිතය.",
  };
  return rewrites[tone] ?? rewrites.formal;
}

export function mockSummarize(length: string): string {
  const summaries: Record<string, string> = {
    short: "රජය ප්‍රවාහන පද්ධතිය නවීකරණය කිරීමට නව ආයෝජන සැලසුමක් ක්‍රියාත්මක කරයි.",
    medium:
      "රජය විසින් නිකුත් කරන ලද නිවේදනයකට අනුව, ප්‍රවාහන පද්ධතිය නවීකරණය කිරීම සඳහා නව ආයෝජන සැලසුමක් ඉදිරි වසර තුළ ක්‍රියාත්මක කිරීමට නියමිතය.",
    long: "රජය විසින් අද නිකුත් කරන ලද නිවේදනයකට අනුව, ඉදිරි වසර තුළ රටේ ප්‍රවාහන පද්ධතිය නවීකරණය කිරීම සඳහා නව ආයෝජන සැලසුමක් ක්‍රියාත්මක කිරීමට නියමිතය. මෙය රටේ යටිතල පහසුකම් සංවර්ධනයට සැලකිය යුතු දායකත්වයක් වනු ඇතැයි අපේක්ෂා කෙරේ.",
  };
  return summaries[length] ?? summaries.medium;
}
