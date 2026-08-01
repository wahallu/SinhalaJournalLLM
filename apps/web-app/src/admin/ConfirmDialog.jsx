/**
 * Confirmation for privileged changes.
 *
 * Always shows current → new, because "are you sure?" without stating what
 * actually changes is a rubber stamp. Every admin mutation routes through
 * this.
 */

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  description,
  current,
  next,
  confirmLabel = 'Confirm',
  destructive = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const restoreFocusTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    // Remember where focus came from, then move it into the dialog — a
    // dialog whose focus is still on the trigger behind the overlay is
    // unusable by keyboard and invisible to a screen reader.
    restoreFocusTo.current = document.activeElement;
    cancelRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreFocusTo.current?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        // Backdrop click cancels; clicks inside the panel must not.
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-3">
          {destructive && (
            <span className="mt-0.5 text-destructive shrink-0">
              <AlertTriangle size={18} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-card-foreground">{title}</h2>
            {description && (
              <p className="text-[13px] text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>

        {(current !== undefined || next !== undefined) && (
          <div className="mt-4 rounded-md bg-muted px-3 py-2.5 text-[13px] font-mono">
            <span className="text-muted-foreground">{String(current ?? '—')}</span>
            <span className="mx-2 text-muted-foreground">→</span>
            <span className="text-foreground font-semibold">{String(next ?? '—')}</span>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[12.5px] text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium text-foreground
              bg-secondary hover:opacity-80 disabled:opacity-50 cursor-pointer transition-opacity"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-3 py-1.5 rounded-md text-[13px] font-semibold cursor-pointer
              disabled:opacity-50 transition-opacity hover:opacity-90 ${
                destructive
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
