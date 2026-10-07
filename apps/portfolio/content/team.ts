import type { ToolId } from "./tools";

/**
 * Team credits and supervisory committee for SinAI (R26-SE-037).
 * Includes faculty supervisors and undergraduate researchers with their
 * component roles, formal registration names, student IDs, and portrait images.
 */
export interface TeamMember {
  name: string;
  formalName: string;
  studentId: string;
  component: string;
  toolId: ToolId;
  roleDescription: string;
  imageUrl: string;
  email?: string;
  profileUrl?: string;
}

export interface Supervisor {
  name: string;
  role: "Supervisor" | "Co-supervisor";
  affiliation: string;
  department: string;
  imageUrl: string;
  email?: string;
  profileUrl?: string;
}

export const SUPERVISORS: Supervisor[] = [
  {
    name: "Prof. Nuwan Kodagoda",
    role: "Supervisor",
    department: "Faculty of Computing",
    affiliation: "Sri Lanka Institute of Information Technology",
    imageUrl: "/assets/team/nuwan-kodagoda.jpeg",
    email: "nuwan.k@sliit.lk",
  },
  {
    name: "Ms. Poojani Gunathilake",
    role: "Co-supervisor",
    department: "Department of Software Engineering",
    affiliation: "Sri Lanka Institute of Information Technology",
    imageUrl: "/assets/team/poojani-gunathilake.jpeg",
    email: "poojani.g@sliit.lk",
  },
];

export const TEAM: TeamMember[] = [
  {
    name: "Nisal Fonseka",
    formalName: "Fonseka G N V S",
    studentId: "IT22207272",
    component: "Grammar checker",
    toolId: "grammar",
    roleDescription: "Sinhala grammar correction & morphological error detection",
    imageUrl: "/assets/team/nisal-fonseka.png",
    email: "nisalfonseka@gmail.com",
  },
  {
    name: "Akash Jayasinghe",
    formalName: "Jayasinghe I A S A",
    studentId: "IT22228062",
    component: "Headline generator",
    toolId: "headlines",
    roleDescription: "Controlled length headline generation & visual synthesis",
    imageUrl: "/assets/team/akash-jayasinghe.png",
    email: "savindu096@gmail.com",
  },
  {
    name: "Chathushka Navod",
    formalName: "Navod W D C",
    studentId: "IT22049872",
    component: "News summarizer",
    toolId: "summaries",
    roleDescription: "Abstractive & extractive Sinhala news summarization",
    imageUrl: "/assets/team/chathushka-navod.png",
    email: "chathushkanavod11@gmail.com",
  },
  {
    name: "Sandun Hettiarachchi",
    formalName: "Hettiarachchi H A S L",
    studentId: "IT22246332",
    component: "Style rewriter",
    toolId: "style",
    roleDescription: "Multi-publication editorial style adaptation & tone transfer",
    imageUrl: "/assets/team/sandun-hettiarachchi.png",
    email: "lakshansandun545@gmail.com",
  },
];
