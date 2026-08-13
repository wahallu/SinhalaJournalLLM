import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SinAI Document Assistant",
  applicationName: "SinAI Document Assistant",
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SinAI Document Assistant",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Google Workspace / Google Docs",
  description:
    "SinAI Document Assistant is an AI-powered Sinhala writing assistant for Google Docs that provides grammar error correction, headline generation, 5-tone style rewriting, and article summarization.",
  url: "https://sin-ai.app/docs-addon",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Organization",
    name: "SinAi Research & Engineering Group",
    url: "https://sin-ai.app",
  },
};

export default function DocsAddonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
