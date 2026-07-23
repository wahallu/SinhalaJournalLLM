import { Loader2 } from 'lucide-react';

/**
 * LoadingSpinner component
 * Modular animated spinner used during image generation loading states.
 */
export default function LoadingSpinner({ size = 20, className = '', label = '' }) {
  return (
    <div className={`inline-flex items-center gap-2 text-ink-500 font-medium ${className}`}>
      <Loader2 size={size} className="animate-spin text-brand-600" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
