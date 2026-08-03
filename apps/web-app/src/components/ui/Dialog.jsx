import { Dialog as RadixDialog } from 'radix-ui';
import { X } from 'lucide-react';

/**
 * Modal shell over Radix Dialog.
 *
 * Radix supplies the parts that are easy to get wrong and invisible when you
 * do: focus trapping, focus return to the trigger on close, `Escape`,
 * outside-click dismissal, scroll locking, and `aria-modal` wiring. This file
 * adds only SinAi styling and the close affordance.
 *
 * `title` is required, not optional — Radix warns without a `Dialog.Title`,
 * and a modal with no accessible name is unusable with a screen reader.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange  Fires on Escape, overlay click and the close button.
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {'sm'|'md'|'lg'} [props.size='sm']
 * @param {boolean} [props.showHeader=true]  False when the body renders its own heading.
 */
const WIDTHS = {
  sm: 'max-w-[26rem]',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'sm',
  showHeader = true,
  children,
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-[60] bg-ink-950/55 backdrop-blur-[3px]
            data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:duration-150
            data-[state=closed]:animate-out data-[state=closed]:fade-out"
        />
        {/* The overlay is the scroll container, not the content: a dialog
            taller than the viewport has to scroll the whole card rather than
            trapping the overflow inside it. */}
        <div className="fixed inset-0 z-[60] overflow-y-auto p-4 sm:p-6 flex items-start sm:items-center justify-center pointer-events-none">
          <RadixDialog.Content
            className={`pointer-events-auto relative w-full ${WIDTHS[size] ?? WIDTHS.sm} my-auto
              bg-white rounded-2xl border border-ink-200/80 shadow-pop
              focus:outline-none
              data-[state=open]:animate-in data-[state=open]:fade-in
              data-[state=open]:slide-in-from-bottom-2 data-[state=open]:duration-200
              data-[state=closed]:animate-out data-[state=closed]:fade-out`}
          >
            <RadixDialog.Close
              className="absolute top-3.5 right-3.5 z-10 flex items-center justify-center w-8 h-8 rounded-lg
                text-ink-400 hover:text-ink-800 hover:bg-ink-100 cursor-pointer
                transition-colors duration-150 focus:outline-none
                focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-label="Close"
            >
              <X size={17} strokeWidth={2} />
            </RadixDialog.Close>

            {showHeader ? (
              <div className="px-6 pt-6 pb-5">
                <RadixDialog.Title className="text-[17px] font-bold text-ink-900 pr-8">
                  {title}
                </RadixDialog.Title>
                {description && (
                  <RadixDialog.Description className="text-[12.5px] text-ink-500 mt-1">
                    {description}
                  </RadixDialog.Description>
                )}
                <div className="mt-5">{children}</div>
              </div>
            ) : (
              <>
                {/* Still rendered, just not shown — the accessible name is not
                    optional even when the body supplies its own visible one. */}
                <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
                {description && (
                  <RadixDialog.Description className="sr-only">{description}</RadixDialog.Description>
                )}
                {children}
              </>
            )}
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
