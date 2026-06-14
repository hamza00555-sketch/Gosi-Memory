import { useState } from 'react';
import { ar } from '../../i18n/ar';

interface SolveSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (guess: string) => Promise<void>;
}

/** Bottom sheet for attempting to solve the hidden phrase. */
export function SolveSheet({ open, onClose, onSubmit }: SolveSheetProps): JSX.Element | null {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const submit = async () => {
    if (busy || value.trim().length === 0) return;
    setBusy(true);
    await onSubmit(value.trim());
    setBusy(false);
    setValue('');
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="hud-panel w-full rounded-b-none p-5">
        <h3 className="mb-3 text-center font-display text-lg font-bold text-white">
          {ar.game.solve}
        </h3>
        <input
          autoFocus
          dir="rtl"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ar.game.solvePlaceholder}
          className="w-full rounded-xl border border-white/15 bg-navy-950 px-4 py-3 text-center text-white outline-none focus:border-brand-cyan"
        />
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">
            {ar.game.cancel}
          </button>
          <button onClick={submit} disabled={busy} className="btn-success flex-1">
            {ar.game.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
