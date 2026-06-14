import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../../components/BottomNav';
import { getCosmetics } from '../../core/content/cosmetics';
import type { Cosmetic, CosmeticType } from '../../core/types/cosmetics';
import { useSessionStore } from '../../state/sessionStore';
import { useToastStore } from '../../state/toastStore';
import { ar } from '../../i18n/ar';

const CATEGORY_ORDER: CosmeticType[] = [
  'card_skin',
  'ar_set',
  'match_effect',
  'victory_effect',
];

export default function StoreScreen(): JSX.Element {
  const navigate = useNavigate();
  const cosmetics = getCosmetics();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-8">
        <button onClick={() => navigate('/')} className="text-sm text-white/50">
          ← {ar.common.back}
        </button>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-white">
          {ar.store.title}
        </h1>
        <p className="text-xs text-white/40">{ar.store.subtitle}</p>

        {CATEGORY_ORDER.map((type) => (
          <section key={type} className="mt-6">
            <h2 className="mb-3 text-sm font-bold text-white/70">
              {ar.store.categories[type]}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {cosmetics
                .filter((c) => c.type === type)
                .map((c) => (
                  <CosmeticCard key={c.id} cosmetic={c} />
                ))}
            </div>
          </section>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}

function CosmeticCard({ cosmetic }: { cosmetic: Cosmetic }): JSX.Element {
  const player = useSessionStore((s) => s.player);
  const isOwned = useSessionStore((s) => s.isOwned);
  const purchase = useSessionStore((s) => s.purchaseCosmetic);
  const selectCardSkin = useSessionStore((s) => s.selectCardSkin);
  const selectArSet = useSessionStore((s) => s.selectArSet);
  const pushToast = useToastStore((s) => s.push);

  const owned = isOwned(cosmetic.id);
  const selected =
    player.selectedCardSkin === cosmetic.id || player.selectedArSet === cosmetic.id;
  const selectable = cosmetic.type === 'card_skin' || cosmetic.type === 'ar_set';

  const onAction = () => {
    if (!owned) {
      const res = purchase(cosmetic.id);
      pushToast(res.ok ? `تم شراء ${cosmetic.name}` : res.reason ?? 'تعذّر الشراء', res.ok ? 'success' : 'error');
      return;
    }
    if (cosmetic.type === 'card_skin') selectCardSkin(cosmetic.id);
    else if (cosmetic.type === 'ar_set') selectArSet(cosmetic.id);
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border p-3 ${
        selected ? 'border-brand-cyan bg-brand-cyan/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="flex h-16 items-center justify-center rounded-xl bg-navy-800 text-2xl">
        {previewGlyph(cosmetic.type)}
      </div>
      <div className="text-sm font-bold text-white">{cosmetic.name}</div>
      <div className="text-[11px] leading-tight text-white/40">{cosmetic.description}</div>
      <button
        onClick={onAction}
        disabled={selectable && owned && selected}
        className={`mt-1 rounded-lg px-2 py-1.5 text-xs font-bold transition ${
          !owned
            ? 'bg-brand-blue/20 text-brand-cyan'
            : selected
              ? 'bg-white/10 text-white/50'
              : 'bg-brand-green/20 text-brand-green'
        }`}
      >
        {!owned
          ? `${ar.store.buy} · ${cosmetic.price} ✦`
          : selected
            ? ar.store.selected
            : selectable
              ? ar.store.select
              : ar.store.owned}
      </button>
    </div>
  );
}

function previewGlyph(type: CosmeticType): string {
  switch (type) {
    case 'card_skin':
      return '🂠';
    case 'ar_set':
      return '🧊';
    case 'match_effect':
      return '✨';
    case 'victory_effect':
      return '🎆';
  }
}
