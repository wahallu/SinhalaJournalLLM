import { useEffect, useState } from 'react';
import { SpellCheck, Newspaper, PenLine, FileText, Cpu } from 'lucide-react';
import { getModelHealth } from '../services/api';

const TOOLS = [
  { id: 'grammar',   label: 'Grammar Checker',    desc: 'Check and correct Sinhala grammar',          icon: SpellCheck },
  { id: 'headlines', label: 'Headline Generator',  desc: 'Generate headline options from articles',    icon: Newspaper  },
  { id: 'rewriter',  label: 'Style Rewriter',      desc: 'Rewrite text in different tones',            icon: PenLine    },
  { id: 'summarizer',label: 'News Summarizer',     desc: 'Summarize long-form articles',               icon: FileText   },
];

function ModelStatusStrip() {
  // status: checking | sinllama | fallback | offline
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    getModelHealth()
      .then((data) => {
        if (cancelled) return;
        const sinllamaUp = data?.providers?.sinllama?.available;
        setStatus(sinllamaUp ? 'sinllama' : 'fallback');
      })
      .catch(() => {
        if (!cancelled) setStatus('offline');
      });
    return () => { cancelled = true; };
  }, []);

  const config = {
    checking: { dot: 'bg-gray-300',  text: 'Checking model status…' },
    sinllama: { dot: 'bg-green-500', text: 'SinLlama model online — full quality inference' },
    fallback: { dot: 'bg-amber-400', text: 'SinLlama server offline — using fallback provider' },
    offline:  { dot: 'bg-red-400',   text: 'Backend unreachable — check the API server' },
  }[status];

  return (
    <div id="model-status" className="flex items-center gap-2.5 px-4 py-3 mb-7 rounded-xl border border-gray-100 bg-gray-50">
      <Cpu size={15} className="text-gray-400 shrink-0" />
      <span className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
      <span className="text-sm text-gray-500">{config.text}</span>
    </div>
  );
}

export default function Dashboard({ onSelectTool }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Dashboard</h1>
      <p className="text-base text-gray-400 mb-5">Select a tool to begin.</p>

      <ModelStatusStrip />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TOOLS.map(({ id, label, desc, icon: Icon }) => (
          <button
            key={id}
            id={`dashboard-${id}`}
            onClick={() => onSelectTool(id)}
            className="text-left p-5 rounded-xl border border-gray-200
              hover:border-gray-300 hover:shadow-sm
              transition-all duration-150 cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center
                group-hover:bg-red-50 transition-colors duration-150 shrink-0">
                <Icon size={22} className="text-gray-400 group-hover:text-accent transition-colors duration-150" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{label}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
