import { siteConfig } from "@/lib/config/site";
import { heroStats } from "@/lib/content/results";
import { publications } from "@/lib/content/publications";
import { teamMembers, supervisor } from "@/lib/content/team";

export const projectBrief = {
  name: siteConfig.name,
  tagline: siteConfig.tagline,
  summary:
    "SinLlama extends Llama-3-8B with Sinhala tokenization and four LoRA task adapters — grammar correction, headline generation, style rewriting, and summarization — trained on six Sri Lankan newspaper sources.",
  stats: heroStats,
  latestPublication: publications[0],
  teamSize: teamMembers.length + 1,
  supervisor: supervisor.name,
  sources: ["Ada Derana", "Hiru", "Mawbima", "Vikalpa", "ITN", "Vidusara"],
};

export function buildAssistantContext(): string {
  const memberLines = teamMembers
    .map((m) => `${m.name} — ${m.role}`)
    .join("; ");
  const statLines = heroStats.map((s) => `${s.value} ${s.label}`).join(", ");

  return [
    `You are the sinai project assistant. Answer questions about sinai, a university research project (${publications[0]?.venue ?? "undergraduate research"}).`,
    `Project: ${siteConfig.tagline}. ${projectBrief.summary}`,
    `By the numbers: ${statLines}.`,
    `Team: ${memberLines}. Supervisor: ${supervisor.name}.`,
    `Latest publication: "${publications[0]?.title}" (${publications[0]?.year}).`,
    `Answer briefly and only using the facts above. If asked something outside these facts, say you don't have that information.`,
  ].join("\n");
}
