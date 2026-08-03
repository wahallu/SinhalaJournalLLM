import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * The `utils` alias in components.json already pointed here, but the file had
 * never been created — every shadcn component pasted in expects it, so it is
 * added rather than rewritten away at each call site.
 *
 * clsx resolves conditionals and arrays; twMerge then drops the earlier of any
 * two classes that set the same property, so `cn('px-4', 'px-6')` is `px-6`
 * rather than a coin flip on stylesheet order.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
