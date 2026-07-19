"use client";

import { useState, type FormEvent } from "react";
import { SendIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useShell } from "@/components/shell/shell-context";
import { useAssistant } from "@/components/shell/assistant-store";
import { siteConfig } from "@/lib/config/site";

const SUGGESTED_PROMPTS = [
  "what does sinai do?",
  "who's on the team?",
  "what are the results?",
];

export function AssistantDrawer() {
  const { assistantOpen, setAssistantOpen } = useShell();
  const { messages, loading, error, sendMessage } = useAssistant();
  const [input, setInput] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input;
    setInput("");
    void sendMessage(text);
  }

  return (
    <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Ask {siteConfig.name}</SheetTitle>
          <SheetDescription>
            Runs on SinLlama&apos;s raw base model — grounded with our project facts, but it
            can still get details wrong.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  className="justify-start text-left"
                  onClick={() => void sendMessage(prompt)}
                >
                  <span aria-hidden className="text-muted-foreground">
                    ›
                  </span>
                  {prompt}
                </Button>
              ))}
            </div>
          )}

          {messages.map((message, i) => (
            <div
              key={i}
              className={
                message.role === "user"
                  ? "ml-8 rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-8 rounded-2xl bg-muted px-3 py-2 text-sm text-foreground"
              }
            >
              {message.content}
            </div>
          ))}

          {loading && (
            <div className="mr-8 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              thinking…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <SheetFooter>
          <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ask anything about sinai…"
              aria-label="Message"
              className="h-9 flex-1 rounded-full border border-border bg-background px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Send"
              disabled={loading || !input.trim()}
            >
              <SendIcon strokeWidth={1.75} />
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
