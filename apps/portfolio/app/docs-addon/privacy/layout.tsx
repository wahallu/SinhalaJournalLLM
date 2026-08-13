import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SinAI Document Assistant",
  description:
    "Privacy Policy for SinAI Document Assistant for Google Docs. Details on Google user data handling, OAuth scopes, Limited Use compliance, and security.",
};

export default function DocsAddonPrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
