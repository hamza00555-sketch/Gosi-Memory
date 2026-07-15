import { useEffect, useState } from 'react';
import { AppHeader } from '../../components/AppHeader';
import { useI18n } from '../../i18n';
import { drawCardFace } from '../../lib/cardFace';
import { loadImage } from '../../lib/cardFace';
import {
  CARD_RASTER_PX,
  SHEET_COLUMNS,
  SHEET_ROWS,
} from '../../lib/printLayout';
import { encodeQrPayload, loadSet, setAssetUrl, type CardSet } from '../../lib/sets';
import { useSettingsStore } from '../../state/settingsStore';

/** A4 portrait at ~150dpi. */
const SHEET_W = 1240;
const SHEET_H = 1754;
const SHEET_MARGIN = 60;
const CARD_GAP = 24;

interface SheetImage {
  url: string;
  label: string;
}

async function renderSheets(set: CardSet): Promise<SheetImage[]> {
  // One physical card per pair per side, in a stable order.
  const cards = set.pairs.flatMap((pair) =>
    (['a', 'b'] as const).map((side) => ({ pair, side })),
  );

  const perSheet = SHEET_COLUMNS * SHEET_ROWS;
  const cellW = (SHEET_W - SHEET_MARGIN * 2 - CARD_GAP * (SHEET_COLUMNS - 1)) / SHEET_COLUMNS;
  const cardPx = Math.floor(cellW);

  const faceCache = new Map<string, HTMLImageElement>();
  const sheets: SheetImage[] = [];

  for (let s = 0; s * perSheet < cards.length; s++) {
    const canvas = document.createElement('canvas');
    canvas.width = SHEET_W;
    canvas.height = SHEET_H;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, SHEET_W, SHEET_H);

    const batch = cards.slice(s * perSheet, (s + 1) * perSheet);
    for (let i = 0; i < batch.length; i++) {
      const { pair, side } = batch[i]!;
      const col = i % SHEET_COLUMNS;
      const row = Math.floor(i / SHEET_COLUMNS);
      const x = SHEET_MARGIN + col * (cardPx + CARD_GAP);
      const y = SHEET_MARGIN + row * (cardPx + CARD_GAP);

      const faceUrl = setAssetUrl(set.setId, pair.faceImage);
      let img = faceCache.get(faceUrl);
      if (!img) {
        img = await loadImage(faceUrl);
        faceCache.set(faceUrl, img);
      }

      const cardCanvas = document.createElement('canvas');
      await drawCardFace(cardCanvas, img, {
        size: CARD_RASTER_PX,
        qrPayload: encodeQrPayload({ setId: set.setId, pairId: pair.pairId, side }),
      });
      g.drawImage(cardCanvas, x, y, cardPx, cardPx);

      // Cut marks + hairline border.
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, cardPx - 1, cardPx - 1);
    }

    sheets.push({ url: canvas.toDataURL('image/png'), label: `${s + 1}` });
  }

  // Card backs sheet (single design, print on the reverse).
  const back = document.createElement('canvas');
  back.width = SHEET_W;
  back.height = SHEET_H;
  const bg = back.getContext('2d')!;
  bg.fillStyle = '#0b1124';
  bg.fillRect(0, 0, SHEET_W, SHEET_H);
  const cellH = cardPx;
  for (let row = 0; row < SHEET_ROWS; row++) {
    for (let col = 0; col < SHEET_COLUMNS; col++) {
      const x = SHEET_MARGIN + col * (cardPx + CARD_GAP);
      const y = SHEET_MARGIN + row * (cellH + CARD_GAP);
      const grad = bg.createLinearGradient(x, y, x + cardPx, y + cellH);
      grad.addColorStop(0, '#111a33');
      grad.addColorStop(1, '#0b1124');
      bg.fillStyle = grad;
      bg.fillRect(x, y, cardPx, cellH);
      bg.strokeStyle = set.themeColor;
      bg.lineWidth = 3;
      bg.strokeRect(x + 10, y + 10, cardPx - 20, cellH - 20);
      bg.fillStyle = set.themeColor;
      bg.font = `bold ${Math.round(cardPx * 0.18)}px Cairo, sans-serif`;
      bg.textAlign = 'center';
      bg.textBaseline = 'middle';
      bg.fillText('قوسي', x + cardPx / 2, y + cellH / 2);
      bg.strokeStyle = '#94a3b8';
      bg.lineWidth = 1;
      bg.strokeRect(x + 0.5, y + 0.5, cardPx - 1, cellH - 1);
    }
  }
  sheets.push({ url: back.toDataURL('image/png'), label: 'backs' });

  return sheets;
}

export default function PrintScreen(): JSX.Element {
  const { t, language } = useI18n();
  const activeSetId = useSettingsStore((s) => s.activeSetId);
  const [set, setSet] = useState<CardSet | null>(null);
  const [sheets, setSheets] = useState<SheetImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSheets(null);
    loadSet(activeSetId)
      .then(async (s) => {
        if (!alive) return;
        setSet(s);
        const rendered = await renderSheets(s);
        if (alive) setSheets(rendered);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [activeSetId]);

  return (
    <main className="flex h-full flex-col overflow-y-auto pb-8 print:block print:h-auto print:overflow-visible">
      <div className="print:hidden">
        <AppHeader title={t.print.title} />
        <p className="mx-4 mb-4 text-sm leading-6 text-white/60">
          {set ? `${set.name[language]} — ` : ''}
          {t.print.hint}
        </p>
        {error ? <p className="mx-4 text-sm text-red-300">{error}</p> : null}
        {!sheets && !error ? (
          <p className="mx-4 text-sm text-white/50">{t.common.loading}</p>
        ) : null}
        {sheets ? (
          <div className="mx-4 mb-4 flex gap-3">
            <button type="button" onClick={() => window.print()} className="btn-primary flex-1 py-3">
              🖨️ {t.print.print}
            </button>
          </div>
        ) : null}
      </div>

      {sheets?.map((sheet) => (
        <section key={sheet.label} className="mx-4 mb-6 print:m-0 print:break-after-page">
          <div className="mb-2 flex items-center justify-between print:hidden">
            <h2 className="text-sm font-bold text-white/80">
              {sheet.label === 'backs' ? t.print.backsTitle : `${t.print.sheet} ${sheet.label}`}
            </h2>
            <a
              href={sheet.url}
              download={`gosi-${set?.setId ?? 'set'}-sheet-${sheet.label}.png`}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              ⬇︎ {t.print.download}
            </a>
          </div>
          {sheet.label === 'backs' ? (
            <p className="mb-2 text-xs text-white/50 print:hidden">{t.print.backsHint}</p>
          ) : null}
          <img
            src={sheet.url}
            alt={sheet.label}
            className="w-full rounded-xl border border-white/10 print:w-full print:rounded-none print:border-0"
          />
        </section>
      ))}
    </main>
  );
}
