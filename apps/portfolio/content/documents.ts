export type DocumentCategory = "document" | "presentation" | "publication";

export interface PortfolioDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  document_type: string;
  submitted_at: string | null;
  description: string | null;
  /** Public link to the file, hosted anywhere. Null while the item is pending. */
  file_url: string | null;
  is_published: boolean;
  sort_order: number;
}

/**
 * The link to open, or null. Only plain https links are opened; anything
 * else (javascript:, data:, http:, relative paths) is treated as "no link
 * yet", even though the admin API already refuses to store such values.
 */
export function openableUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^https:\/\/[^\s/]+\S*$/i.test(url) ? url : null;
}
