import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Sinhala } from "next/font/google";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-sinhala",
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sin-ai.app"),
  title: "SinAi — The Intelligent Foundation for Sinhala Journalism & Writing",
  description:
    "An advanced AI writing and editorial intelligence platform powered by specialized Large Language Models for Sinhala journalism (Sinhala Journal LLM). Features real-time grammar checking, journalistic headline generation, 5-tone rewriting, and news summarization.",
  keywords: [
    "Sinhala LLM",
    "SinAi",
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
    title: "SinAi — The Intelligent Foundation for Sinhala Journalism & Writing",
    description:
      "Domain-adapted Sinhala AI Assistant and Writing Workspace (Sinhala Journal LLM). Transforming newsroom workflows with precision linguistic intelligence.",
    url: "https://sin-ai.app",
    siteName: "SinAi (Sinhala Journal LLM)",
    images: [
      {
        url: "/brand/hero.png",
        width: 1200,
        height: 630,
        alt: "SinAi Journalistic Intelligence Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakartaSans.variable} ${notoSinhala.variable}`}>
      <head>
        <link rel="icon" href="/brand/web-app-manifest-192x192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Noto+Sans+Sinhala:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-[#FAF9F5] text-[#1B1B1B] selection:bg-[#cd191a] selection:text-white">
        {children}
      </body>
    </html>
  );
}
