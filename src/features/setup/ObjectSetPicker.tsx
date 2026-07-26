import { OBJECT_SETS } from '../../content';
import type { ObjectSetId } from '../../domain/ids';
import { useDeviceStore } from '../../state/deviceStore';
import { ar } from '../../i18n/ar';

interface Props {
  value: ObjectSetId;
  onChange: (id: ObjectSetId) => void;
}

/**
 * Cosmetic-only choice, per device. Locked sets show that they exist and are
 * coming later — there is deliberately no purchase flow here, because a
 * half-built store is worse than none.
 */
export function ObjectSetPicker({ value, onChange }: Props): JSX.Element {
  const owns = useDeviceStore((s) => s.ownsObjectSet);

  return (
    <div className="grid grid-cols-2 gap-3">
      {OBJECT_SETS.map((set) => {
        const owned = set.isDefault || owns(set.id);
        const selected = set.id === value;

        return (
          <button
            key={set.id}
            type="button"
            disabled={!owned}
            onClick={() => onChange(set.id)}
            aria-pressed={selected}
            className={`flex flex-col gap-2 rounded-chunk p-3 text-start transition ${
              selected
                ? 'bg-pop-yellow text-ink-950 ring-2 ring-pop-yellow'
                : owned
                  ? 'bg-ink-700 text-cream'
                  : 'bg-ink-800 text-cream/40'
            }`}
          >
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-ink-950/40">
              <img
                src={set.previewImage}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <span className="text-sm font-bold">{set.name}</span>
            {!owned && (
              <span className="nums text-xs opacity-70">
                {ar.setup.comingSoon} · {set.futurePrice}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
