import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/25 border border-transparent',
  secondary:
    'bg-white text-ink-700 border border-ink-200 hover:border-ink-300 hover:bg-ink-50 shadow-sm',
  ghost:
    'text-ink-500 border border-transparent hover:text-ink-800 hover:bg-ink-100/80',
  danger:
    'text-brand-700 border border-transparent hover:bg-brand-50',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-[12.5px] gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-[13.5px] gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-[14px] gap-2 rounded-xl',
};

const ICON_SIZES = { sm: 14, md: 15, lg: 16 };

export default function ActionButton({
  children,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}) {
  const iconSize = ICON_SIZES[size] ?? 15;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-semibold cursor-pointer select-none
        transition-all duration-150 active:scale-[0.98]
        disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANTS[variant] ?? VARIANTS.secondary}
        ${SIZES[size] ?? SIZES.md}
        ${className}
      `}
      {...rest}
    >
      {loading
        ? <Loader2 size={iconSize} className="animate-spin shrink-0" />
        : Icon && <Icon size={iconSize} className="shrink-0" strokeWidth={2.25} />}
      {children}
    </button>
  );
}
