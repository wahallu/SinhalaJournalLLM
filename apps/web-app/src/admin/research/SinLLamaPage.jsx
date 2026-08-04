/**
 * Admin-only research instrument, moved here from the user product.
 *
 * Deliberately still styled with the SinAi ink/brand tokens rather than
 * the admin palette. Restyling three large components is cosmetic work
 * with real regression risk, and it should not ride along with a move —
 * these tools are valued for what they do, not how they look. Tracked as
 * follow-up in the Phase 4 plan.
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, User, Cpu, WifiOff } from 'lucide-react';
import { ShimmerDot } from '../../components/ui/Skeleton';
import { chatSinLlama, getSinLlamaHealth } from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import ActionButton from '../../components/ui/ActionButton';
import SamplePromptChips from '../../components/ui/SamplePromptChips';
import { Card } from '../../components/ui/Card';

const EXAMPLE_PROMPTS = [
  'ශ්‍රී ලංකාවේ ප්‍රධාන නගර මොනවාද?',
  'සිංහල භාෂාවේ ඉතිහාසය කෙරෙහි කෙටියෙන් විස්තර කරන්න.',
  'ලංකාවේ ආර්ථිකය ගැන ලියන්න.',
  'Write a short Sinhala poem about the ocean.',
];

function MetaChip({ children }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ink-200/70 text-ink-600 tabular-nums">
      {children}
    </span>
  );
}

export default function SinLLamaPage() {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [online,   setOnline]   = useState(null);
  const [elapsed,  setElapsed]  = useState(null);

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const timerRef    = useRef(null);

  // Ping server (through the backend — it owns the inference server's address)
  useEffect(() => {
    let cancelled = false;
    getSinLlamaHealth()
      .then((data) => { if (!cancelled) setOnline(Boolean(data.available)); })
      .catch(() => { if (!cancelled) setOnline(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    setInput('');
    setError(null);
    setElapsed(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    setLoading(true);

    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(((Date.now() - start) / 1000).toFixed(1));
    }, 100);

    try {
      const data = await chatSinLlama(prompt);

      clearInterval(timerRef.current);
      setElapsed(((Date.now() - start) / 1000).toFixed(1));

      setMessages((prev) => [...prev, {
        role: 'bot',
        text: data.response ?? JSON.stringify(data),
        meta: {
          inputTok:  data.input_tokens,
          cap:       data.max_cap_used,
          outputTok: data.output_tokens,
        },
      }]);
      setOnline(true);
    } catch (err) {
      clearInterval(timerRef.current);
      setError(err.message || 'Failed to reach SinLLaMA server.');
      setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    setElapsed(null);
  };

  const autoResize = (el) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const usePrompt = (p) => {
    setInput(p);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        icon={Bot}
        title="SinLLaMA Playground"
        description="Send Sinhala or English prompts straight to the base model — no task adapter applied."
        badge={
          online === true  ? <StatusBadge status="online" label="Server online" /> :
          online === false ? <StatusBadge status="offline" label="Server offline" /> :
                             <StatusBadge status="checking" label="Checking…" pulse />
        }
        actions={
          <>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-500
              bg-white border border-ink-200 rounded-full px-2.5 py-1">
              <Cpu size={11} className="text-brand-600" />
              Base model
            </span>
            <ActionButton
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={handleClear}
              disabled={messages.length === 0 && !error}
              title="Clear conversation"
            >
              Clear
            </ActionButton>
          </>
        }
        className="mb-4"
      />

      {/* Chat card */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 scroll-smooth">
          {messages.length === 0 && !loading && !error && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center shadow-sm shadow-brand-600/10">
                <Bot size={26} className="text-brand-600" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-ink-900">Test SinLLaMA</h3>
                <p className="text-[12.5px] text-ink-500 mt-1 max-w-sm leading-relaxed">
                  Send any Sinhala or English prompt to the base SinLLaMA model and inspect
                  its raw, un-adapted responses.
                </p>
              </div>
              <SamplePromptChips
                prompts={EXAMPLE_PROMPTS}
                onSelect={usePrompt}
                className="justify-center max-w-lg mt-2"
              />
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={i}
                className={`flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200
                  ${isUser ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0
                    ${isUser ? 'bg-ink-900 text-white' : 'bg-brand-50 text-brand-600 border border-brand-100'}`}
                  aria-hidden="true"
                >
                  {isUser ? <User size={14} strokeWidth={2.25} /> : <Bot size={14} strokeWidth={2.25} />}
                </div>
                <div
                  className={`max-w-[80%] px-4 py-2.5 text-[14px] leading-[1.7] break-words
                    ${isUser
                      ? 'bg-ink-900 text-white rounded-2xl rounded-tr-md'
                      : 'bg-ink-50 text-ink-800 border border-ink-200/60 rounded-2xl rounded-tl-md'}`}
                >
                  <p className="whitespace-pre-wrap m-0">{msg.text}</p>
                  {msg.meta && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <MetaChip>in {msg.meta.inputTok}t</MetaChip>
                      <MetaChip>cap {msg.meta.cap}t</MetaChip>
                      <MetaChip>out {msg.meta.outputTok}t</MetaChip>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
              <div className="w-7.5 h-7.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center shrink-0">
                <Bot size={14} strokeWidth={2.25} />
              </div>
              <div className="flex items-center gap-1.5 px-4 py-3.5 bg-ink-50 border border-ink-200/60 rounded-2xl rounded-tl-md">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
                {elapsed && <span className="text-[11px] text-ink-400 ml-2 font-medium tabular-nums">{elapsed}s</span>}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-brand-50 border border-brand-200/70 rounded-xl text-brand-700" role="alert">
              <WifiOff size={15} className="shrink-0 mt-0.5" />
              <span className="text-[13px] font-medium break-words">{error}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-ink-100 p-3 sm:p-4">
          <div className="flex items-end gap-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Type a Sinhala or English prompt…"
              aria-label="Prompt"
              className="flex-1 resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5
                text-[14px] leading-relaxed text-ink-800 placeholder:text-ink-400 outline-none
                transition-all duration-150 min-h-[44px] max-h-40 overflow-y-auto
                focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]
                disabled:bg-ink-50 disabled:opacity-70"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Send prompt"
              className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0
                cursor-pointer transition-all duration-150 shadow-sm shadow-brand-600/25
                hover:bg-brand-700 active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? <ShimmerDot size={17} /> : <Send size={17} />}
            </button>
          </div>
          <p className="text-[10.5px] text-ink-400 mt-2 pl-1">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </Card>
    </div>
  );
}
