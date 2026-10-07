"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileText, Presentation, ScrollText } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import { BUNDLED_DOCUMENTS, type DocumentCategory, type PortfolioDocument } from "@/content/documents";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://backend.sin-ai.app/api/v1").replace(/\/+$/, "");

const GROUPS: Array<{
  category: DocumentCategory;
  id: string;
  label: string;
  icon: typeof FileText;
}> = [
  { category: "document", id: "documents", label: "Documents", icon: FileText },
  { category: "presentation", id: "presentations", label: "Presentations", icon: Presentation },
  { category: "publication", id: "publications", label: "Publications", icon: ScrollText },
];

function formatDate(value: string | null) {
  if (!value) return "Date not specified";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function DocumentLibrary() {
  const [uploaded, setUploaded] = useState<PortfolioDocument[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/portfolio/documents`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Document service returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setUploaded(data);
      })
      // Offline or unreachable: the bundled documents are shown on their own.
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const documents = useMemo(() => {
    const bundledUrls = new Set(BUNDLED_DOCUMENTS.map((item) => item.file_url));
    return [
      ...uploaded.filter((item) => !bundledUrls.has(item.file_url)),
      ...BUNDLED_DOCUMENTS,
    ].sort((a, b) => a.sort_order - b.sort_order);
  }, [uploaded]);

  return (
    <Section id="library">
      <SectionHeader title="Research library" />

      <div className="space-y-16">
        {GROUPS.map(({ category, id, label, icon: Icon }) => {
          const rows = documents.filter((item) => item.category === category);
          if (rows.length === 0) return null;
          return (
            <section key={category} id={id} className="scroll-mt-28">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-crimson-tint text-crimson">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="font-display text-3xl font-bold text-black-main">{label}</h3>
              </div>
              <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((item) => (
                  <li key={item.id} className="flex min-h-64 flex-col rounded-3xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-panel-bg px-3 py-1 text-xs font-semibold text-[#5f5c56]">
                        {item.document_type}
                      </span>
                      <span className="text-xs text-text-muted">{formatDate(item.submitted_at)}</span>
                    </div>
                    <h4 className="mt-5 font-display text-xl font-bold leading-snug text-black-main">{item.title}</h4>
                    {item.description && (
                      <p className="mt-3 text-sm leading-relaxed text-[#5f5c56]">{item.description}</p>
                    )}
                    <div className="mt-auto flex items-center gap-3 pt-6">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-black-main px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-crimson"
                      >
                        View <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                      <a
                        href={item.file_url}
                        download={item.file_name}
                        className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-black-main transition-colors hover:border-black-main"
                      >
                        Download <Download aria-hidden="true" className="h-4 w-4" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Section>
  );
}
