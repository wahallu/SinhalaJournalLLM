import RouteDialog from '../../components/RouteDialog';

/**
 * Shell shared by the five auth screens.
 *
 * They render as a modal over the app rather than as a full page. The routes
 * themselves are unchanged — /reset-password and /verify-email arrive from
 * email links and have to stay deep-linkable — so this only changes how they
 * are presented; RouteDialog handles where closing one goes.
 *
 * The header is built here rather than handed to Dialog so the wordmark can
 * sit above the title the way it did on the standalone page.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <RouteDialog title={title} description={subtitle} size="sm" showHeader={false}>
      <div className="px-6 pt-6 pb-6">
        <div className="flex items-center gap-2.5 mb-5">
          <img src="/logored.svg" alt="" className="w-7 h-7 object-contain" />
          <span
            className="text-[22px] text-ink-900 tracking-tight leading-none"
            style={{ fontFamily: "'Gwen', 'Satoshi', sans-serif" }}
          >
            SinAi
          </span>
        </div>

        <h1 className="text-[17px] font-bold text-ink-900 pr-8">{title}</h1>
        {subtitle && <p className="text-[12.5px] text-ink-500 mt-1 mb-5">{subtitle}</p>}

        {children}

        {footer && (
          <p className="text-center text-[12.5px] text-ink-500 mt-5 pt-4 border-t border-ink-100">
            {footer}
          </p>
        )}
      </div>
    </RouteDialog>
  );
}
