import { useEffect, useRef, useState } from 'react';
import { AppHeader } from '../../components/AppHeader';
import { useI18n } from '../../i18n';
import { drawCardFace, loadImage } from '../../lib/cardFace';
import { saveLocalMindTargets } from '../../lib/mindStore';
import { loadSet, setAssetUrl, type CardSet } from '../../lib/sets';
import { useSettingsStore } from '../../state/settingsStore';

/** Hang-watchdog budget PER TARGET (a whole set compiles many faces). */
const COMPILE_TIMEOUT_PER_TARGET_MS = 60_000;

type CompileState =
  | { step: 'idle' }
  | { step: 'compiling'; progress: number }
  | { step: 'done'; buffer: ArrayBuffer; installed: boolean }
  | { step: 'failed' };

/**
 * Builds the set's reference-image library: every card face is rasterized
 * exactly like the printed card (QR box empty) and fed to the MindAR compiler,
 * producing one multi-target .mind file. Runs entirely in the browser.
 * A watchdog fails loudly instead of hanging forever (Holoform lesson).
 */
export default function CompileScreen(): JSX.Element {
  const { t, language } = useI18n();
  const activeSetId = useSettingsStore((s) => s.activeSetId);
  const [set, setSet] = useState<CardSet | null>(null);
  const [state, setState] = useState<CompileState>({ step: 'idle' });
  const cancelled = useRef(false);

  useEffect(() => {
    loadSet(activeSetId).then(setSet).catch(() => setState({ step: 'failed' }));
    return () => {
      cancelled.current = true;
    };
  }, [activeSetId]);

  const compile = (): void => {
    if (!set) return;
    setState({ step: 'compiling', progress: 0 });

    void (async () => {
      const watchdog = setTimeout(() => {
        if (!cancelled.current) setState({ step: 'failed' });
      }, COMPILE_TIMEOUT_PER_TARGET_MS * set.pairs.length);

      try {
        // Compile order MUST follow targetIndex — that is the contract between
        // set.json and the .mind file.
        const ordered = [...set.pairs].sort((a, b) => a.targetIndex - b.targetIndex);

        const images: HTMLImageElement[] = [];
        for (const pair of ordered) {
          const face = await loadImage(setAssetUrl(set.setId, pair.faceImage));
          const canvas = document.createElement('canvas');
          await drawCardFace(canvas, face, {}); // empty QR box — see cardFace.ts
          images.push(await loadImage(canvas.toDataURL('image/png')));
        }

        const { Compiler } = await import('mind-ar/dist/mindar-image.prod.js');
        const compiler = new Compiler();
        await compiler.compileImageTargets(images, (progress: number) => {
          if (!cancelled.current) {
            setState({ step: 'compiling', progress: Math.round(progress) });
          }
        });
        const buffer = await compiler.exportData();
        clearTimeout(watchdog);
        if (!cancelled.current) setState({ step: 'done', buffer, installed: false });
      } catch {
        clearTimeout(watchdog);
        if (!cancelled.current) setState({ step: 'failed' });
      }
    })();
  };

  const download = (): void => {
    if (state.step !== 'done') return;
    const blob = new Blob([state.buffer], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'targets.mind';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const install = async (): Promise<void> => {
    if (state.step !== 'done' || !set) return;
    await saveLocalMindTargets(set.setId, state.buffer);
    setState({ ...state, installed: true });
  };

  return (
    <main className="flex h-full flex-col overflow-y-auto pb-8">
      <AppHeader title={t.compile.title} />
      <div className="mx-4 flex flex-col gap-4">
        <p className="text-sm leading-6 text-white/60">
          {set ? `${set.name[language]} (${set.pairs.length}) — ` : ''}
          {t.compile.hint}
        </p>
        <p className="rounded-xl bg-brand-blue/10 p-3 text-xs leading-5 text-brand-cyan">
          💡 {t.compile.quality}
        </p>

        {state.step === 'idle' ? (
          <button type="button" onClick={compile} disabled={!set} className="btn-primary py-3">
            {t.compile.start}
          </button>
        ) : null}

        {state.step === 'compiling' ? (
          <div className="hud-panel p-4">
            <div className="mb-2 text-sm text-white/80">{t.compile.compiling}</div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-l from-brand-blue to-brand-cyan transition-all"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <div className="mt-1 text-end text-xs text-white/50">{state.progress}%</div>
          </div>
        ) : null}

        {state.step === 'done' ? (
          <div className="hud-panel flex flex-col gap-3 p-4">
            <div className="font-bold text-brand-green">✓ {t.compile.done}</div>
            <button type="button" onClick={download} className="btn-primary py-3">
              ⬇︎ {t.compile.download}
            </button>
            {state.installed ? (
              <div className="rounded-xl bg-brand-green/10 p-3 text-sm text-brand-green">
                ✓ {t.compile.installed}
              </div>
            ) : (
              <button type="button" onClick={() => void install()} className="btn-ghost py-3">
                📲 {t.compile.install}
              </button>
            )}
          </div>
        ) : null}

        {state.step === 'failed' ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">
              {t.compile.failed}
            </div>
            <button type="button" onClick={compile} className="btn-ghost py-3">
              {t.common.retry}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
