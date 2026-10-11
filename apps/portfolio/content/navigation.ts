/**
 * Header tabs, after the SLIIT project-website guideline: Home, Domain,
 * Milestones, Documents, Presentations, About us, Contact us. The Domain tab
 * is a dropdown built in the Navbar, so it sits between HOME_TAB and TABS.
 * Every target is a section of the one-page home (or /project-scope).
 */
export interface NavLink {
  id: string;
  label: string;
  href: string;
}

export const HOME_TAB: NavLink = { id: "home", label: "Home", href: "/#hero" };

export const DOMAIN_TAB_ID = "domain";

export const TABS: NavLink[] = [
  { id: "milestones", label: "Milestones", href: "/#milestones" },
  { id: "documents", label: "Documents", href: "/#documents" },
  { id: "presentations", label: "Presentations", href: "/#presentations" },
  { id: "about", label: "About us", href: "/#team" },
  { id: "contact", label: "Contact us", href: "/#contact" },
];

/**
 * Which tab each home-page section belongs to, for the active-tab highlight.
 * Sections that are not listed (for example #achievements) highlight no tab.
 */
export const SECTION_TAB: Record<string, string> = {
  hero: "home",
  about: "home",
  where: "home",
  technologies: "home",
  milestones: "milestones",
  recognition: "milestones",
  library: "documents",
  documents: "documents",
  presentations: "presentations",
  publications: "presentations",
  team: "about",
  contact: "contact",
};
