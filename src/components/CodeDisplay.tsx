import { useCallback } from 'react';
import type { RoomCode } from '../domain/ids';
import { ar } from '../i18n/ar';
import { useToast } from '../state/toastStore';

interface CodeDisplayProps {
  code: RoomCode;
  caption?: string;
  className?: string;
}

async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls through to the legacy path below — a denied permission is normal.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** The room code, sized to be read across a table, and tappable to copy. */
export function CodeDisplay({ code, caption, className = '' }: CodeDisplayProps): JSX.Element {
  const toast = useToast();

  const onCopy = useCallback(() => {
    void copy(code).then((ok) => {
      if (ok) toast.success(ar.lobby.codeCopied);
      else toast.error(ar.errors.generic);
    });
  }, [code, toast]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`flex w-full flex-col items-center gap-2 rounded-chunk bg-ink-800 px-5 py-5 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pop-sky ${className}`}
    >
      <span className="font-body text-sm font-medium text-cream/60">
        {caption ?? ar.lobby.shareCode}
      </span>
      <span
        dir="ltr"
        className="nums font-display text-6xl font-black tracking-[0.2em] text-pop-yellow"
      >
        {code}
      </span>
    </button>
  );
}

export default CodeDisplay;
