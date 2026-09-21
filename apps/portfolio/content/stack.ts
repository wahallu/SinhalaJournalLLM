/**
 * Technology stack, grouped. Names come from each app's package.json, from
 * `apps/backend-api/requirements.txt` and from the README.
 */
export interface StackGroup {
  title: string;
  items: string[];
}

export const STACK: StackGroup[] = [
  {
    title: "AI models",
    items: [
      "SinLlama (Llama 3 8B extended for Sinhala)",
      "LoRA adapters, one per task",
      "4-bit NF4 base with BF16 compute (QLoRA)",
      "Hosted fallback via OpenRouter",
    ],
  },
  {
    title: "Backend",
    items: ["Python", "FastAPI", "Pydantic", "httpx", "PyJWT and bcrypt", "pytest"],
  },
  {
    title: "Data",
    items: ["Supabase (PostgreSQL)", "Row-level security", "Runtime settings and audit log"],
  },
  {
    title: "Web app",
    items: ["React 19", "Vite", "Tailwind CSS", "Radix UI", "React Router", "Recharts"],
  },
  {
    title: "Other clients",
    items: ["Chrome extension (Manifest V3)", "Google Docs add-on (Apps Script)"],
  },
  {
    title: "This website",
    items: ["Next.js 16", "React 19", "Tailwind CSS 4", "Static export"],
  },
  {
    title: "Deployment",
    items: ["Docker", "Coolify (self-hosted)"],
  },
];
