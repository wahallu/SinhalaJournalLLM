import type { Metadata } from "next";
import { ToolDeepDive } from "@/components/research/ToolDeepDive";
import { TOOL_PAGE_BY_SLUG } from "@/content/toolPages";

const page = TOOL_PAGE_BY_SLUG["news-summarizer"];

export const metadata: Metadata = {
  title: `${page.title} research | SinAI Document Assistant`,
  description: page.description,
};

export default function NewsSummarizerPage() {
  return <ToolDeepDive page={page} />;
}
