import { SpellCheck, Newspaper, PenLine, FileText } from 'lucide-react';

const TOOLS = [
  { id: 'grammar',   label: 'Grammar Checker',    desc: 'Check and correct Sinhala grammar',          icon: SpellCheck, hover: 'hover:border-[#cd191a] hover:shadow-red-500/10' },
  { id: 'headlines', label: 'Headline Generator', desc: 'Generate headline options from articles',    icon: Newspaper, hover: 'hover:border-[#cd191a] hover:shadow-orange-500/10'  },
  { id: 'rewriter',  label: 'Style Rewriter',     desc: 'Rewrite text in different tones',            icon: PenLine, hover: 'hover:border-[#cd191a] hover:shadow-purple-500/10'    },
  { id: 'summarizer',label: 'News Summarizer',    desc: 'Summarize long-form articles',               icon: FileText, hover: 'hover:border-[#cd191a] hover:shadow-cyan-500/10'   },
];

export default function Dashboard({ onSelectTool }) {
  return (
    <div className="w-full flex flex-col items-center pt-8">
      <div className="mb-4 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden">
          <img src="/logored.svg" alt="SinAi logo" className="w-full h-full object-contain p-1.5" />
        </div>
      </div>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome to SinAi</h1>
      <p className="text-gray-500 mb-10 text-center">Select a tool to get started</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {TOOLS.map(({ id, label, desc, icon: Icon, hover }) => (
          <button
            key={id}
            id={`dashboard-${id}`}
            onClick={() => onSelectTool(id)}
            className={`text-left p-6 rounded-2xl border-2 border-transparent bg-white shadow-md
              ${hover} hover:-translate-y-1
              transition-all duration-300 cursor-pointer group`}
          >
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Icon size={28} className="text-black" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">{label}</h2>
                <p className="text-sm text-gray-500 mt-1">{desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
