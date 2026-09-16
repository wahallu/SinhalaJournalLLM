/**
 * A labelled read-only fact, or a labelled inline field when given children.
 *
 * Shared by the Account and Security panels. Moved out of ProfilePage when
 * that file was split — it was one of four presentational helpers defined
 * above a 400-line component.
 */
export default function InfoCard({ icon: Icon, label, value, valueClassName = '', children }) {
  return (
    <div className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-ink-200 bg-white p-4 dark:bg-ink-50">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Icon size={19} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-ink-500">{label}</p>
        {children ?? (
          <p className={`mt-1 truncate text-[14px] font-semibold text-ink-900 ${valueClassName}`} title={value}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
