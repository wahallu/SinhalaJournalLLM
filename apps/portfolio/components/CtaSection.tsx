import Image from "next/image";
import { SITE } from "@/content/site";
import { ButtonLink, Section } from "@/components/ui";

export default function CtaSection() {
  return (
    <Section id="start" tone="panel">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Image
          src="/brand/web-app-manifest-192x192.png"
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-2xl object-cover shadow-xl shadow-crimson/25"
        />
        <h2 className="mt-8 font-display text-4xl font-bold leading-[1.1] tracking-tight text-black-main text-balance sm:text-5xl">
          Try it on your own Sinhala text.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#5f5c56]">
          Open the web app, add the Chrome extension, or install the Google Docs
          add-on. You can start without an account.
        </p>
        <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href={SITE.appUrl} variant="accent">
            Try SinAi Workspace
          </ButtonLink>
          <ButtonLink href={SITE.repoUrl} variant="secondary">
            View the source code
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
