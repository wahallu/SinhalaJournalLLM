import type { ComponentType, SVGProps } from "react";
import type { Metadata } from "next";
import { MailIcon } from "lucide-react";
import { GithubMark } from "@/components/icons/github-mark";
import { siteConfig } from "@/lib/config/site";
import { TuckMascot } from "@/components/shell/tuck-mascot";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch about the sinai research project.",
};

type ContactLink = {
  label: string;
  detail: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const links: ContactLink[] = [
  {
    label: "GitHub",
    detail: "github.com",
    href: "https://github.com",
    icon: GithubMark,
  },
  {
    label: "Email",
    detail: "contact@sinai.example",
    href: "mailto:contact@sinai.example",
    icon: MailIcon,
  },
];

// Interim page: find-me links only. The message-the-assistant card (reusing
// AssistantDrawer) and a real contact form are plan Phase I.
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-24 pb-24 sm:px-6 sm:pt-28 lg:px-8">
      <TuckMascot />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Get in touch about {siteConfig.name}.
      </h1>
      <p className="mt-3 text-muted-foreground">
        Questions about the research, the model, or the team — reach us here.
      </p>

      <div className="mt-10 flex flex-col divide-y divide-border/60 border-t border-b border-border/60">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="flex items-center gap-4 py-5 transition-colors hover:bg-muted/40"
          >
            <link.icon strokeWidth={1.75} className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{link.label}</p>
              <p className="text-xs text-muted-foreground">{link.detail}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
