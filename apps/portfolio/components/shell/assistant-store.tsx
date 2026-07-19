"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { siteConfig } from "@/lib/config/site";
import { buildAssistantContext } from "@/lib/content/brief";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_TURNS_IN_CONTEXT = 3;

async function askSinllama(prompt: string): Promise<string> {
  const res = await fetch(`${siteConfig.apiBaseUrl}/api/v1/sinllama/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "The model is unreachable right now.");
  }

  const data = await res.json();
  return data.response as string;
}

type AssistantContextValue = {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  /** Sends a message and updates transcript/loading/error — call from an event handler. */
  sendMessage: (text: string) => Promise<void>;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: trimmed },
      ];
      setMessages(nextMessages);
      setError(null);
      setLoading(true);

      const recentTurns = nextMessages.slice(-MAX_TURNS_IN_CONTEXT * 2);
      const transcript = recentTurns
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n");
      const prompt = `${buildAssistantContext()}\n\n${transcript}\nAssistant:`;

      try {
        const response = await askSinllama(prompt);
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [messages, loading]
  );

  const value = useMemo<AssistantContextValue>(
    () => ({ messages, loading, error, sendMessage }),
    [messages, loading, error, sendMessage]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}
