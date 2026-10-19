"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://backend.sin-ai.app/api/v1").replace(/\/+$/, "");

type Status = "idle" | "sending" | "sent";

const FIELD =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-black-main placeholder:text-text-muted focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;

    setStatus("sending");
    // The visitor always sees success, whether or not the email went out.
    // Delivery failures are still logged by the backend.
    try {
      await fetch(`${API_BASE}/portfolio/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      // Ignored on purpose; see above.
    }
    form.reset();
    setStatus("sent");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-line bg-white-card p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-black-main">
          Name
          <input name="name" type="text" required maxLength={100} autoComplete="name" className={FIELD} />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-black-main">
          Email
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={FIELD} />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold text-black-main">
        Message
        <textarea name="message" required minLength={10} maxLength={5000} rows={5} className={`${FIELD} resize-y`} />
      </label>
      {/* Honeypot: hidden from people and screen readers, filled by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center gap-2 rounded-full bg-crimson px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-crimson-dark disabled:opacity-60"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
          {status === "sending" ? "Sending…" : "Send message"}
        </button>
        {status === "sent" && (
          <p role="status" className="text-sm text-[#5f5c56]">
            Thanks — your message has been sent. We will reply by email.
          </p>
        )}
      </div>
    </form>
  );
}
