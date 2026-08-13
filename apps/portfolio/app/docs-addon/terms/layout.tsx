import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — SinAI Document Assistant",
  description:
    "Terms of Service for SinAI Document Assistant Google Docs Add-on. Acceptable use, licensing, AI disclaimers, and user rights.",
};

export default function DocsAddonTermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
