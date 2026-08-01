/** Centered card shell shared by the five auth screens. */

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <img src="/logored.svg" alt="" className="w-8 h-8 object-contain" />
          <span
            className="text-[24px] text-ink-900 tracking-tight"
            style={{ fontFamily: "'Gwen', 'Satoshi', sans-serif" }}
          >
            SinAi
          </span>
        </div>

        <div className="bg-white border border-ink-200/80 rounded-2xl shadow-card p-6">
          <h1 className="text-[17px] font-bold text-ink-900">{title}</h1>
          {subtitle && <p className="text-[12.5px] text-ink-500 mt-1 mb-5">{subtitle}</p>}
          {children}
        </div>

        {footer && <p className="text-center text-[12.5px] text-ink-500 mt-4">{footer}</p>}
      </div>
    </div>
  );
}
