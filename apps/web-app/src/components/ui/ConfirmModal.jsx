import React from 'react';
import Dialog from './Dialog';
import ActionButton from './ActionButton';

export default function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!busy) onOpenChange(isOpen);
      }}
      title={title}
      size="sm"
    >
      <div className="space-y-5">
        {description && (
          <p className="text-[13px] text-ink-500">{description}</p>
        )}
        
        <div className="flex justify-end gap-2 pt-2">
          <ActionButton
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </ActionButton>
          <ActionButton
            variant="primary"
            className={destructive ? '!bg-red-600 hover:!bg-red-700 focus:!ring-red-400' : ''}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working...' : confirmLabel}
          </ActionButton>
        </div>
      </div>
    </Dialog>
  );
}
