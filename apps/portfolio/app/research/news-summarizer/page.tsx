import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, CheckCircle2, SplitSquareHorizontal, MessageSquare, Gauge } from "lucide-react";
import Link from "next/link";

export default function NewsSummarizerPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] text-[#1B1B1B]">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Navigation */}
          <div className="mb-8">
            <Link 
              href="/#research-models" 
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#8C8880] hover:text-[#cd191a] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>

          {/* Hero Section */}
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fdf3f2] text-[#cd191a] text-xs font-bold uppercase tracking-widest mb-6">
              <span className="w-2 h-2 rounded-full bg-[#cd191a] animate-pulse" />
              Abstractive Compression
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-[#181818] tracking-tight leading-tight mb-6">
              News Summarizer
            </h1>
            <p className="text-lg sm:text-xl text-[#615e58] max-w-3xl leading-relaxed">
              Length-conditioned abstractive summarization. Designed to distill lengthy Sinhala journalism into concise executive briefs or structured narratives without hallucinating facts outside the source article.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <SplitSquareHorizontal className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Paradigm</p>
              <p className="text-3xl font-display font-bold text-[#181818]">Abstractive</p>
              <p className="text-xs text-[#615e58] mt-2">Generates new sentences</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Formatting</p>
              <p className="text-2xl sm:text-3xl font-display font-bold text-[#181818]">Llama-3 Chat</p>
              <p className="text-xs text-[#615e58] mt-2">Utilizes native chat templates</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <Gauge className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Length Control</p>
              <p className="text-3xl font-display font-bold text-[#181818]">3 Bands</p>
              <p className="text-xs text-[#615e58] mt-2">Short, Medium, and Long targets</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#181818] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Adapter Version</p>
              <p className="text-3xl font-display font-bold text-[#181818]">v06</p>
              <p className="text-xs text-[#615e58] mt-2">Current production deployment</p>
            </div>
          </div>

          {/* Deep Dive Content */}
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D9D7D0] shadow-lg">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#181818] mb-8 border-b border-[#F0EFEB] pb-4">
              Implementation Details
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h3 className="text-xl font-bold text-[#181818] mb-4 flex items-center gap-2">
                  <SplitSquareHorizontal className="w-5 h-5 text-[#cd191a]" />
                  Length-Conditioned Prompts
                </h3>
                <p className="text-[#615e58] leading-relaxed mb-6">
                  Introduced in version v06, the summarizer now natively understands distinct length constraints natively. When an editor asks for a "short" summary, the model leverages its conditioned training to deliver an ultra-concise brief rather than truncating a longer output.
                </p>
                <div className="bg-[#FAF9F5] p-5 rounded-xl border border-[#D9D7D0]">
                  <p className="text-sm text-[#1B1B1B] font-semibold mb-2">Supported Targets:</p>
                  <ul className="list-disc list-inside text-sm text-[#615e58] space-y-2">
                    <li><strong className="text-[#181818]">Short:</strong> 2-3 sentence core briefs.</li>
                    <li><strong className="text-[#181818]">Medium:</strong> Standard paragraph summary.</li>
                    <li><strong className="text-[#181818]">Long:</strong> Multi-paragraph detailed synopsis retaining secondary facts.</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#181818] mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#cd191a]" />
                  Chat Template Utilization
                </h3>
                <p className="text-[#615e58] leading-relaxed mb-6">
                  While the Grammar, Headline, and Style tools rely on traditional Alpaca-style instruction prompts, the Summarizer is trained on the native Llama-3 Chat format (<code>&lt;|begin_of_text|&gt;&lt;|start_header_id|&gt;...</code>). 
                </p>
                <p className="text-[#615e58] leading-relaxed">
                  This architectural divergence allows the model to better parse complex, multi-turn reasoning and handle document-scale texts with superior contextual retention.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
