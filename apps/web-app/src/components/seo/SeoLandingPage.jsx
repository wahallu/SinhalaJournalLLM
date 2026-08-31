import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SeoLandingPage({ page }) {
  return (
    <div className="min-h-screen bg-canvas text-ink-900">
      <header className="border-b border-ink-100 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-2.5" aria-label="SinAi home">
            <img src="/logored.svg" alt="" className="h-9 w-9 object-contain" />
            <span className="text-xl tracking-tight" style={{ fontFamily: "'Gwen', 'Satoshi', sans-serif" }}>SinAi</span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="https://sin-ai.app/" className="hidden text-sm font-medium text-ink-600 hover:text-brand-700 sm:inline-flex" target="_blank" rel="noopener noreferrer">
              Research <ExternalLink size={13} className="ml-1" />
            </a>
            <Link to={page.ctaHref} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
              Open tool <ArrowRight size={15} />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="border-b border-ink-100 bg-white px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-brand-700" lang="si">{page.eyebrow}</p>
            <h1 className="text-balance text-4xl font-black tracking-tight text-ink-950 sm:text-6xl">{page.heading}</h1>
            <p className="mx-auto mt-6 max-w-3xl text-pretty text-lg leading-8 text-ink-600">{page.intro}</p>
            <Link to={page.ctaHref} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-bold text-white shadow-card transition-all hover:-translate-y-0.5 hover:bg-brand-700">
              {page.ctaLabel} <ArrowRight size={18} />
            </Link>
            <p className="mt-3 text-xs text-ink-500">Free to try without an account. Review AI output before publishing.</p>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="features-heading" className="text-center text-2xl font-black tracking-tight sm:text-3xl">What you can do with SinAi</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {page.items.map((item) => {
                const content = (
                  <>
                    <CheckCircle2 size={20} className="text-brand-600" />
                    <h3 className="mt-4 text-lg font-bold text-ink-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-600">{item.description}</p>
                    {item.href && <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Learn more <ArrowRight size={14} /></span>}
                  </>
                );
                return item.href ? (
                  <Link key={item.title} to={item.href} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card transition-transform hover:-translate-y-0.5">
                    {content}
                  </Link>
                ) : (
                  <article key={item.title} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
                    {content}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-ink-100 bg-white px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-3xl">
            <h2 id="faq-heading" className="text-2xl font-black tracking-tight sm:text-3xl">Frequently asked questions</h2>
            <div className="mt-7 divide-y divide-ink-100 border-y border-ink-100">
              {page.faqs.map((faq) => (
                <article key={faq.question} className="py-6">
                  <h3 className="text-base font-bold text-ink-950">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 text-center sm:px-6 sm:py-20">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Ready to work on your Sinhala text?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-ink-600">Open the browser workspace, paste your text, and choose the writing task you need.</p>
          <Link to={page.ctaHref} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink-950 px-6 py-3.5 text-base font-bold text-white hover:bg-brand-700">
            {page.ctaLabel} <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <footer className="border-t border-ink-100 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center text-sm text-ink-500 sm:flex-row sm:text-left">
          <p>© 2026 SinAi Research &amp; Engineering Group.</p>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Footer navigation">
            <Link to="/sinhala-ai" className="hover:text-brand-700">Sinhala AI</Link>
            <a href="https://sin-ai.app/privacy" className="hover:text-brand-700">Privacy</a>
            <a href="https://sin-ai.app/terms" className="hover:text-brand-700">Terms</a>
            <a href="https://sin-ai.app/support" className="hover:text-brand-700">Support</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
