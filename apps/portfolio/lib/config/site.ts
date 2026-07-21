export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "sinai",
  tagline:
    process.env.NEXT_PUBLIC_SITE_TAGLINE ??
    "Style-controlled Sinhala journalism, model-assisted",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
  nav: [
    { label: "Home", href: "/" },
    { label: "Work", href: "/research" },
    { label: "Team", href: "/team" },
    { label: "Papers", href: "/publications" },
    { label: "Play", href: "/playground" },
    { label: "Contact", href: "/contact" },
  ],
} as const;
