import './shiny-button.css';

/**
 * Animated-border call to action.
 *
 * Ported from a Next.js/TypeScript original. Three things had to change for
 * this codebase:
 *
 *   1. `<style jsx>` is a Next compiler feature with no Vite equivalent —
 *      under Vite it renders the CSS as literal text into the DOM. The rules
 *      live in shiny-button.css instead.
 *   2. This project is JSX, not TSX (components.json sets `"tsx": false`),
 *      so the prop types are documented rather than declared.
 *   3. The original's blue highlight and 1.25rem/2.5rem padding are replaced
 *      by the brand red ramp and size variants — it has to fit a 17rem
 *      sidebar, not a centred landing page.
 *
 * @param {object}   props
 * @param {React.ReactNode} props.children  Label. Omitted for `size="icon"`.
 * @param {React.ElementType} [props.icon]  lucide-react icon, rendered before the label.
 * @param {'sm'|'md'|'lg'|'icon'} [props.size='md']
 * @param {boolean}  [props.block=false]    Fill the container's width.
 * @param {boolean}  [props.disabled=false]
 * @param {string}   [props.className='']
 * @param {() => void} [props.onClick]
 */
export function ShinyButton({
  children,
  icon: Icon,
  size = 'md',
  block = false,
  disabled = false,
  className = '',
  onClick,
  ...rest
}) {
  const iconOnly = size === 'icon';
  const variant = size === 'md' ? '' : `shiny-cta--${size}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shiny-cta ${variant} ${block ? 'shiny-cta--block' : ''} ${className}`}
      {...rest}
    >
      {/* The label span is not decorative — ::before hangs the inner glow off
          it, and z-index:1 keeps the text above the shimmer layer. */}
      <span className="shiny-cta-label">
        {Icon && <Icon size={iconOnly ? 18 : 15} strokeWidth={2.25} className="shrink-0" />}
        {!iconOnly && children}
      </span>
    </button>
  );
}

export default ShinyButton;
