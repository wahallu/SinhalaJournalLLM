import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SinAI Document Assistant",
  description:
    "SinAI Document Assistant is an AI-powered Sinhala writing assistant for Google Docs that provides grammar correction, headline generation, style rewriting, and article summarization.",
  openGraph: {
    title: "SinAI Document Assistant",
    description:
      "SinAI Document Assistant is an AI-powered Sinhala writing assistant for Google Docs that provides grammar correction, headline generation, style rewriting, and article summarization.",
    url: "https://sin-ai.app/docs-addon",
    siteName: "SinAI Document Assistant",
    images: [
      {
        url: "/brand/hero.png",
        width: 1200,
        height: 630,
        alt: "SinAI Document Assistant for Google Docs",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SinAI Document Assistant",
    description:
      "SinAI Document Assistant is an AI-powered Sinhala writing assistant for Google Docs that provides grammar correction, headline generation, style rewriting, and article summarization.",
  },
};

export default function DocsAddonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
