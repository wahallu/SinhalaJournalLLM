import { SpellCheck, Newspaper, PenLine, FileText } from 'lucide-react';

const TOOLS = [
  { id: 'grammar',   label: 'Grammar Checker',    desc: 'Check and correct Sinhala grammar',          icon: SpellCheck },
  { id: 'headlines', label: 'Headline Generator',  desc: 'Generate headline options from articles',    icon: Newspaper  },
  { id: 'rewriter',  label: 'Style Rewriter',      desc: 'Rewrite text in different tones',            icon: PenLine    },
  { id: 'summarizer',label: 'News Summarizer',     desc: 'Summarize long-form articles',               icon: FileText   },
];

export default function Dashboard({ onSelectTool }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Dashboard</h1>
      <p className="text-base text-gray-400 mb-7">Select a tool to begin.</p>

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
