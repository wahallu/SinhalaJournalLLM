export type TeamMember = {
  name: string;
  role: string;
  bio: string;
  avatarSeed: string;
  links?: {
    github?: string;
    linkedin?: string;
    email?: string;
  };
};

export const supervisor: TeamMember = {
  name: "Dr. Ruwan Weerasinghe",
  role: "Research Supervisor",
  bio: "Guides the project's NLP methodology and evaluation design, with a focus on low-resource language modeling.",
  avatarSeed: "sinai-supervisor-ruwan",
};

export const teamMembers: TeamMember[] = [
  {
    name: "Chathura Wickramasinghe",
    role: "Model Training Lead",
    bio: "Owns the LoRA adapter pipeline and evaluation harness for SinLlama's four writing tasks.",
    avatarSeed: "sinai-team-chathura",
    links: { github: "https://github.com", email: "mailto:chathura@sinai.example" },
  },
  {
    name: "Nadeesha Perera",
    role: "Data & Pipeline Engineer",
    bio: "Built the news-scraping and cleaning pipeline across six Sri Lankan newspaper sources.",
    avatarSeed: "sinai-team-nadeesha",
    links: { github: "https://github.com", email: "mailto:nadeesha@sinai.example" },
  },
  {
    name: "Ishan Fernando",
    role: "Backend & Infrastructure",
    bio: "Designed the model gateway's provider chain and the deployment pipeline across four client apps.",
    avatarSeed: "sinai-team-ishan",
    links: { github: "https://github.com", email: "mailto:ishan@sinai.example" },
  },
  {
    name: "Dilki Jayasooriya",
    role: "Product & Frontend",
    bio: "Leads the client experiences: web app, Chrome extension, and this research site.",
    avatarSeed: "sinai-team-dilki",
    links: { github: "https://github.com", email: "mailto:dilki@sinai.example" },
  },
];
