"use client";

import { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { siGithub } from "simple-icons";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://backend.sin-ai.app/api/v1").replace(/\/+$/, "");

/** Phone, LinkedIn and GitHub per member, managed in the admin panel. */
interface TeamContact {
  student_id: string;
  phone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
}

// One request shared by all four cards.
let contactsRequest: Promise<Map<string, TeamContact>> | null = null;

function loadContacts() {
  contactsRequest ??= fetch(`${API_BASE}/portfolio/team-contacts`)
    .then((response) => (response.ok ? response.json() : []))
    .then((rows: unknown) =>
      new Map(Array.isArray(rows) ? (rows as TeamContact[]).map((row) => [row.student_id, row]) : []),
    )
    .catch(() => {
      contactsRequest = null; // let a later mount retry
      return new Map<string, TeamContact>();
    });
  return contactsRequest;
}

// Only https links are rendered, whatever the API returns.
const safeUrl = (url: string | null | undefined) => (url && url.startsWith("https://") ? url : null);

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d={siGithub.path} />
    </svg>
  );
}

const ICON_LINK =
  "rounded-lg p-1.5 text-[#8C8880] transition-colors hover:bg-stone-100 hover:text-crimson";

export default function MemberContactLinks({
  studentId,
  name,
  email,
}: {
  studentId: string;
  name: string;
  email?: string;
}) {
  const [contact, setContact] = useState<TeamContact | null>(null);

  useEffect(() => {
    let active = true;
    loadContacts().then((contacts) => {
      if (active) setContact(contacts.get(studentId) ?? null);
    });
    return () => {
      active = false;
    };
  }, [studentId]);

  const phone = contact?.phone;
  const linkedin = safeUrl(contact?.linkedin_url);
  const github = safeUrl(contact?.github_url);

  return (
    <div className="flex items-center gap-0.5">
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} title={`Call ${name}: ${phone}`} aria-label={`Call ${name}`} className={ICON_LINK}>
          <Phone aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      )}
      {linkedin && (
        <a href={linkedin} target="_blank" rel="noopener noreferrer" title={`${name} on LinkedIn`} aria-label={`${name} on LinkedIn`} className={ICON_LINK}>
          <LinkedInIcon className="h-3.5 w-3.5" />
        </a>
      )}
      {github && (
        <a href={github} target="_blank" rel="noopener noreferrer" title={`${name} on GitHub`} aria-label={`${name} on GitHub`} className={ICON_LINK}>
          <GitHubIcon className="h-3.5 w-3.5" />
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} title={`Email ${name}`} aria-label={`Email ${name}`} className={ICON_LINK}>
          <Mail aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
