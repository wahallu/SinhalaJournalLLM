import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A hover/focus popover anchored to an inline word.
 *
 * Replaces the native `title` attribute, which was doing this job badly: it
 * waits about a second before appearing, cannot be styled, cannot be reached
 * from the keyboard, and — the reason it had to go — cannot contain a button,
 * so there was no way to act on what it said.
 *
 * Behaviour that makes it usable rather than merely present:
 *
 * - Opens on hover after a short delay, so sweeping the cursor across a
 *   paragraph of marked words does not strobe.
 * - Closes on a *grace period*, not immediately, and cancels that close if the
 *   pointer enters the panel. Without this the panel vanishes in the gap
 *   between word and button and the action is unreachable.
 * - Opens instantly on keyboard focus (no delay to fight) and closes on
 *   Escape, returning focus to the word.
 * - Rendered in a portal and positioned from the anchor's viewport rect, so a
 *   scrolling or `overflow-hidden` ancestor cannot clip it.
 * - Flips above the word when there is no room below, and is clamped to the
 *   viewport horizontally.
 */

const OPEN_DELAY_MS = 120;
const CLOSE_GRACE_MS = 160;
const GAP = 8;
const EDGE = 10;

export default function WordPopover({ children, panel, className = '', ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const panelId = useId();

  const clearTimers = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const scheduleOpen = useCallback((immediate = false) => {
    clearTimers();
    if (immediate) return setOpen(true);
    openTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return undefined;
  }, [clearTimers]);

  /**
   * Close only if the pointer really has left, and focus is not inside.
   *
   * A plain `setTimeout(close)` loses a race that happens constantly in
   * practice: leaving the word starts the timer, and if the pointer is still
   * travelling toward the button — slowly, diagonally, or across the gap — the
   * panel disappears out from under it and the click lands on nothing. Asking
   * the DOM who is hovered at the moment the timer fires removes the race
   * instead of widening the window and hoping.
   */
  const closeIfAway = useCallback((relatedTarget = null) => {
    const overAnchor = anchorRef.current?.matches(':hover');
    const overPanel = panelRef.current?.matches(':hover');
    // `document.activeElement` at blur time is still the blurring element
    // in Safari/Firefox; use `relatedTarget` (where focus is *going*) if
    // available so Tab-into-the-panel is not treated as a leave.
    const nextFocus = relatedTarget ?? document.activeElement;
    const focusInside =
      panelRef.current?.contains(nextFocus) ||
      anchorRef.current === nextFocus;
    if (overAnchor || overPanel || focusInside) return;
    setOpen(false);
  }, []);

  const scheduleClose = useCallback((relatedTarget = null) => {
    clearTimers();
    closeTimer.current = setTimeout(() => closeIfAway(relatedTarget), CLOSE_GRACE_MS);
  }, [clearTimers, closeIfAway]);

  /* Measured after paint but before the browser draws, so the panel never
     shows at 0,0 for a frame before jumping into place. */
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return undefined;

    /* Positions the OUTER element, whose padding already supplies the visual
       gap — so it sits flush against the word and the pointer never crosses
       unhovered space. `height` here is the outer height, padding included. */
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panelEl = panelRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const width = panelEl?.width ?? 260;
      const height = panelEl?.height ?? 96;

      const room = window.innerHeight - anchor.bottom;
      const above = room < height && anchor.top > height;

      let left = anchor.left + anchor.width / 2 - width / 2;
      left = Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));

      setCoords({
        left,
        top: above ? anchor.top - height : anchor.bottom,
        placement: above ? 'top' : 'bottom',
      });
    };

    place();
    // Re-measure once the panel has real dimensions on first open.
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      anchorRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`cursor-pointer rounded-[2px] outline-none focus-visible:ring-2
          focus-visible:ring-brand-400/70 focus-visible:ring-offset-1 ${className}`}
        onMouseEnter={() => scheduleOpen()}
        onMouseLeave={scheduleClose}
        onFocus={() => scheduleOpen(true)}
        onBlur={(e) => scheduleClose(e.relatedTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            scheduleOpen(true);
          }
        }}
        // Touch has no hover: a tap opens it.
        onClick={() => scheduleOpen(true)}
      >
        {children}
      </span>

      {open && coords &&
        createPortal(
          /* The outer element carries transparent padding on the side facing
             the word, so the visual gap is still part of the hoverable
             surface. Without it the pointer crosses dead space on its way to
             the button and the panel closes mid-journey — the gap has to be
             bridged, not merely tolerated. */
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              left: coords.left,
              top: coords.top,
              zIndex: 60,
              [coords.placement === 'top' ? 'paddingBottom' : 'paddingTop']: GAP,
            }}
            onMouseEnter={clearTimers}
            onMouseLeave={scheduleClose}
          >
            <div
              className="w-max max-w-[min(19rem,calc(100vw-1.25rem))] rounded-xl border border-ink-200
                bg-white shadow-pop px-3.5 py-3 animate-pop-in"
            >
              {typeof panel === 'function' ? panel({ close: () => setOpen(false) }) : panel}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
