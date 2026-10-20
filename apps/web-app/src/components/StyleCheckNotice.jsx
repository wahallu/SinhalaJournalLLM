import { AlertTriangle, Ban } from 'lucide-react';
import ActionButton from './ui/ActionButton';

/**
 * Verdict of the pre-rewrite style check. A block is final until the user
 * changes the article or the style; a warning offers to proceed regardless.
 */
export default function StyleCheckNotice({ check, onProceed, loading = false }) {
  const isBlock = check.status === 'block';
  const Icon = isBlock ? Ban : AlertTriangle;

  return (
    <div
      id="style-check-notice"
      role={isBlock ? 'alert' : 'status'}
      className={`px-4 py-3.5 rounded-xl border flex items-start gap-2.5
        animate-in fade-in slide-in-from-bottom-1 duration-200 ${
          isBlock
            ? 'bg-brand-50 border-brand-200/70'
            : 'bg-amber-50 border-amber-200/70'
        }`}
    >
      <Icon size={16} className={`shrink-0 mt-0.5 ${isBlock ? 'text-brand-600' : 'text-amber-500'}`} />
      <div className="min-w-0">
        <p className={`text-[13.5px] font-semibold ${isBlock ? 'text-brand-800' : 'text-amber-800'}`}>
          {isBlock
            ? 'Style not applicable'
            : check.kind === 'unavailable' ? 'Could not check the article' : 'Check the writing style'}
        </p>
        <p className={`text-[12.5px] mt-0.5 break-words ${isBlock ? 'text-brand-700/90' : 'text-amber-800/90'}`}>
          {check.message}
        </p>
        {!isBlock && (
          <ActionButton size="sm" variant="ghost" className="mt-2" onClick={onProceed} disabled={loading}>
            Rewrite anyway
          </ActionButton>
        )}
      </div>
    </div>
  );
}
