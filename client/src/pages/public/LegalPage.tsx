import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Printer, ReceiptText, ShieldCheck } from 'lucide-react';
import { LEGAL, LEGAL_DOCUMENTS, type LegalDocument } from './legalContent';

const ICONS: Record<LegalDocument['slug'], typeof FileText> = {
  terms: FileText,
  privacy: ShieldCheck,
  'refund-policy': ReceiptText
};

export function LegalPage({ slug }: { slug: LegalDocument['slug'] }) {
  const doc = LEGAL_DOCUMENTS.find(d => d.slug === slug) || LEGAL_DOCUMENTS[0];

  useEffect(() => {
    document.title = `${doc.title} — ${LEGAL.product}`;
    window.scrollTo({ top: 0 });
  }, [doc]);

  return (
    <div className="min-h-screen bg-white text-[#060606] font-sans">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#D8D8D8]/70 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-[#3683F8] text-white flex items-center justify-center font-black text-lg shrink-0">✚</div>
            <span className="font-extrabold text-sm sm:text-base truncate">{LEGAL.product}</span>
          </Link>
          <Link to="/" className="text-sm font-bold text-slate-600 hover:text-[#3683F8] inline-flex items-center gap-1.5 shrink-0">
            <ArrowLeft size={16} /> Home
          </Link>
        </div>
      </header>

      <section className="bg-[#EBF3FE] border-b border-blue-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <span className="text-xs font-black uppercase tracking-widest text-[#3683F8]">Legal</span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">{doc.title}</h1>
          <p className="text-slate-600 mt-3 max-w-2xl leading-relaxed">{doc.summary}</p>
          <p className="text-xs font-semibold text-slate-500 mt-4">
            Effective {LEGAL.effectiveDate} · Version {LEGAL.version}
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-12 gap-10">
        <aside className="lg:col-span-3 print:hidden">
          <div className="lg:sticky lg:top-24 space-y-6">
            <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {LEGAL_DOCUMENTS.map(d => {
                const Icon = ICONS[d.slug];
                const active = d.slug === doc.slug;
                return (
                  <Link
                    key={d.slug}
                    to={`/${d.slug}`}
                    className={`shrink-0 flex items-center gap-2.5 px-3.5 h-11 rounded-xl text-sm font-bold border transition-colors ${active ? 'bg-[#060606] text-white border-[#060606]' : 'bg-white text-slate-600 border-[#D8D8D8] hover:border-[#3683F8] hover:text-[#3683F8]'}`}
                  >
                    <Icon size={16} /> {d.title}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden lg:block">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">On this page</div>
              <ul className="space-y-1.5">
                {doc.sections.map(s => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-sm text-slate-600 hover:text-[#3683F8] transition-colors">{s.title}</a>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="hidden lg:inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-[#D8D8D8] text-sm font-bold text-slate-600 hover:border-[#3683F8] hover:text-[#3683F8]"
            >
              <Printer size={16} /> Print / Save as PDF
            </button>
          </div>
        </aside>

        <main className="lg:col-span-9 min-w-0">
          <div className="rounded-2xl border border-blue-100 bg-[#EBF3FE]/50 p-5 mb-10">
            <div className="text-sm font-extrabold mb-3">In short</div>
            <ul className="grid sm:grid-cols-2 gap-2.5">
              {doc.highlights.map(h => (
                <li key={h} className="flex gap-2 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> {h}
                </li>
              ))}
            </ul>
          </div>

          <article className="space-y-10">
            {doc.sections.map(section => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl font-extrabold tracking-tight mb-3">{section.title}</h2>
                <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
                  {section.blocks.map((block, i) =>
                    block.type === 'p' ? (
                      <p key={i}>{block.text}</p>
                    ) : (
                      <ul key={i} className="space-y-2 pl-1">
                        {block.items.map(item => (
                          <li key={item} className="flex gap-2.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#3683F8] shrink-0 mt-2.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </section>
            ))}
          </article>

          <div className="mt-12 pt-6 border-t border-[#D8D8D8] text-sm text-slate-500 space-y-1">
            <p>
              {LEGAL.company} · <a href={`mailto:${LEGAL.email}`} className="text-[#3683F8] font-semibold">{LEGAL.email}</a>
            </p>
            {LEGAL.address && <p>{LEGAL.address}</p>}
          </div>
        </main>
      </div>
    </div>
  );
}
