import { CheckCircle2, FileText, Heading, Wand2, type LucideIcon } from "lucide-react";
import type { ToolId } from "@/content/tools";

export const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  grammar: CheckCircle2,
  headlines: Heading,
  style: Wand2,
  summaries: FileText,
};
