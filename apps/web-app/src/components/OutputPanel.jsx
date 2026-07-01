import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function OutputPanel({ output, loading, error, type }) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div id="output-loading" className="mt-6 py-12 flex items-center justify-center">
        <span className="text-base text-gray-400 animate-subtle-pulse">Processing…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div id="output-error" className="mt-6 px-4 py-3.5 text-[15px] text-red-600 bg-red-50 rounded-xl border border-red-100">
        {error}
      </div>
    );
  }

  if (!output) return null;

  const handleCopy = async () => {
    let text = '';
    if (type === 'list' && output.headlines) {
      text = output.headlines.join('\n');
    } else if (output.corrected) {
      text = output.corrected;
    } else if (output.rewritten) {
      text = output.rewritten;
    } else if (output.summary) {
      text = output.summary;
    } else {
      text = typeof output === 'string' ? output : JSON.stringify(output);
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div id="output-panel" className="mt-6">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Output</span>
        <button
          id="copy-output"
          onClick={handleCopy}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          title="Copy to clipboard"
        >
          {copied ? <Check size={17} className="text-green-500" /> : <Copy size={17} />}
        </button>
      </div>

      <div className="px-5 py-4 bg-gray-50 rounded-xl border border-gray-100 text-[15px] text-gray-800 leading-[1.8]">
        {type === 'list' && output.headlines ? (
          <ol className="space-y-3">
            {output.headlines.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-gray-300 font-semibold shrink-0 w-5">{i + 1}.</span>
                <span>{h}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="whitespace-pre-wrap">
            {output.corrected || output.rewritten || output.summary || (typeof output === 'string' ? output : JSON.stringify(output, null, 2))}
          </p>
        )}
      </div>
    </div>
  );
}
