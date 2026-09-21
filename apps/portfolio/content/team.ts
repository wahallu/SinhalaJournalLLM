import type { ToolId } from "./tools";

/**
 * Team credits, exactly as supplied by the team. Names are shown verbatim
 * (surname first, then initials); edit the strings here to change the
 * display. Add `profileUrl` per person to link a profile.
 *
 * If this list is empty the Team section renders a project-level credit.
 */
export interface TeamMember {
  name: string;
  /** The tool component this person built. */
  component: string;
  toolId: ToolId;
  profileUrl?: string;
}

export const TEAM: TeamMember[] = [
  { name: "Fonseka G N V S", component: "Grammar checker", toolId: "grammar" },
  { name: "Jayasinghe I A S A", component: "Headline generator", toolId: "headlines" },
  { name: "Navod W D C", component: "News summarizer", toolId: "summaries" },
  { name: "Hettiarachchi H A S L", component: "Style rewriter", toolId: "style" },
];
