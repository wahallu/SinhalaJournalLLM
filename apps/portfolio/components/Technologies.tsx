import {
  siCoolify,
  siDocker,
  siFastapi,
  siGoogleappsscript,
  siGooglechrome,
  siHuggingface,
  siMeta,
  siNextdotjs,
  siOpenrouter,
  siPostgresql,
  siPython,
  siPytorch,
  siReact,
  siSupabase,
  siTailwindcss,
  siVite,
} from "simple-icons";
import { Section, SectionHeader } from "@/components/ui";
import { LogoCloud, type Logo } from "@/components/ui/logo-cloud-2";

/**
 * Only technologies the code actually uses: docs/serve_sinai.py (PyTorch,
 * Hugging Face transformers + peft, FastAPI), apps/backend-api
 * (requirements.txt, OpenRouter fallback client, Supabase), the web app and
 * this site's package.json, the Dockerfiles and infra/ (Coolify), and the
 * Chrome extension and Docs add-on. Order runs model → backend → clients.
 */
const LOGOS: Logo[] = [
  { icon: siMeta, name: "Llama 3 / SinLlama" },
  { icon: siPytorch },
  { icon: siHuggingface, name: "Transformers + PEFT" },
  { icon: siPython },
  { icon: siFastapi },
  { icon: siOpenrouter },
  { icon: siSupabase },
  { icon: siPostgresql },
  { icon: siReact },
  { icon: siVite },
  { icon: siTailwindcss, name: "Tailwind CSS" },
  { icon: siNextdotjs, name: "Next.js" },
  { icon: siGooglechrome, name: "Chrome extension" },
  { icon: siGoogleappsscript, name: "Google Apps Script" },
  { icon: siDocker },
  { icon: siCoolify },
];

export default function Technologies() {
  return (
    <Section id="technologies" className="overflow-hidden">
      <SectionHeader title="Technologies used" />
      <LogoCloud logos={LOGOS} />
    </Section>
  );
}
