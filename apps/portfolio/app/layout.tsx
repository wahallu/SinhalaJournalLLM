import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const TITLE = "SinAi: AI Writing Assistant for Sinhala Journalism";
const DESCRIPTION =
  "SinAi is an AI writing assistant for Sinhala journalism. It checks grammar, suggests headlines, rewrites articles in five newspaper styles and summarizes long stories, built by the Sinhala Journal LLM research team (R26-SE-037).";

export const metadata: Metadata = {
  metadataBase: new URL("https://sin-ai.app"),
  title: TITLE,
  applicationName: "SinAi",
  description: DESCRIPTION,
  keywords: [
    "SinAi",
    "Sinhala LLM",
    "Sinhala Journal LLM",
    "Sinhala NLP",
    "Journalism AI",
    "Sinhala Grammar Checker",
    "Sinhala News Summarizer",
    "Sinhala Headline Generator",
    "Sri Lanka AI",
  ],
  authors: [{ name: "SinAi Research & Engineering Group" }],
  icons: {
    icon: "/brand/web-app-manifest-192x192.png",
    shortcut: "/brand/web-app-manifest-192x192.png",
    apple: "/brand/web-app-manifest-192x192.png",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://sin-ai.app",
    siteName: "SinAi",
    images: [
      {
        url: "/brand/hero.png",
        width: 1200,
        height: 630,
        alt: "SinAi",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SinAi",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, Google Docs, Chrome",
  description: DESCRIPTION,
  url: "https://sin-ai.app",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakartaSans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="icon" href="/brand/web-app-manifest-192x192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-[#FAF9F5] text-[#1B1B1B] selection:bg-[#cd191a] selection:text-white">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
