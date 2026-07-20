import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({ text, label = 'Copy', size = 13, className = '', ...rest }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — leave state unchanged */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer
        text-[11.5px] font-medium transition-colors duration-150
        ${copied ? 'text-emerald-600' : 'text-ink-500 hover:text-ink-800 hover:bg-ink-100/80'}
        ${className}`}
      {...rest}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  );
}
