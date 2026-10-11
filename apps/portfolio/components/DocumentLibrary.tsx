"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Presentation, ScrollText } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import {
  openableUrl,
  type DocumentCategory,
  type PortfolioDocument,
} from "@/content/documents";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://backend.sin-ai.app/api/v1").replace(/\/+$/, "");

// Documents and Presentations always render, so the header tabs that point at
// #documents and #presentations have somewhere to land even when empty.
const GROUPS: Array<{
  category: DocumentCategory;
  id: string;
  label: string;
  icon: typeof FileText;
  alwaysShow: boolean;
  empty: string;
}> = [
  { category: "document", id: "documents", label: "Documents", icon: FileText, alwaysShow: true, empty: "No documents published yet." },
  { category: "presentation", id: "presentations", label: "Presentations", icon: Presentation, alwaysShow: true, empty: "No presentations published yet." },
  { category: "publication", id: "publications", label: "Publications", icon: ScrollText, alwaysShow: false, empty: "" },
];

type Status = "loading" | "ready" | "error";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function DocumentLibrary() {
  const [documents, setDocuments] = useState<PortfolioDocument[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/portfolio/documents`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Document service returned ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Unexpected document list");
        setDocuments(data);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const sorted = useMemo(
    () => [...documents].sort((a, b) => a.sort_order - b.sort_order),
    [documents],
  );

  return (
    <Section id="library">
      <SectionHeader title="Research library" />

      {status === "loading" && (
        <p role="status" className="mb-8 text-base text-[#5f5c56]">
          Loading documents…
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="mb-8 text-base text-[#5f5c56]">
          Documents are temporarily unavailable. Please try again later.
        </p>
      )}

      <div className="space-y-16">
        {GROUPS.map(({ category, id, label, icon: Icon, alwaysShow, empty }) => {
          const rows = sorted.filter((item) => item.category === category);
          if (!alwaysShow && rows.length === 0) return null;
          return (
            <section key={category} id={id} className="scroll-mt-28">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-crimson-tint text-crimson">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="font-display text-3xl font-bold text-black-main">{label}</h3>
              </div>
              {rows.length === 0 ? (
                status === "ready" && <p className="text-base text-[#5f5c56]">{empty}</p>
              ) : (
                <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {rows.map((item) => {
                    const href = openableUrl(item.file_url);
                    return (
                      <li key={item.id} className="flex min-h-64 flex-col rounded-3xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-panel-bg px-3 py-1 text-xs font-semibold text-[#5f5c56]">
                            {item.document_type}
                          </span>
                          {item.submitted_at && (
                            <span className="text-xs text-text-muted">{formatDate(item.submitted_at)}</span>
                          )}
                        </div>
                        <h4 className="mt-5 font-display text-xl font-bold leading-snug text-black-main">{item.title}</h4>
                        {item.description && (
                          <p className="mt-3 text-sm leading-relaxed text-[#5f5c56]">{item.description}</p>
                        )}
                        <div className="mt-auto flex items-center gap-3 pt-6">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-black-main px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-crimson"
                            >
                              Open <ExternalLink aria-hidden="true" className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-[#5f5c56]">
                              Pending
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </Section>
  );
}
