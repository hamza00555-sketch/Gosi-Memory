import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Screen } from '../../components/Screen';
import { PAIRS } from '../../content';
import { ar } from '../../i18n/ar';
import { to } from '../../app/routes';

/**
 * How to lay out the physical table. Shown before the first match because the
 * cards, not the screen, are the board — getting them face-down and well lit is
 * the single biggest factor in whether recognition feels good.
 */
export default function HowToPlayScreen(): JSX.Element {
  const navigate = useNavigate();

  return (
    <Screen
      title={ar.onboarding.cardsTitle}
      onBack={() => navigate(-1)}
      footer={
        <button type="button" className="btn-primary w-full" onClick={() => navigate(to.lobby())}>
          {ar.common.start}
        </button>
      }
    >
      <div className="flex flex-col gap-5 px-5">
        <p className="text-balance text-lg text-cream/80">{ar.onboarding.cardsBody}</p>

        {/* A face-down 14-card layout, drawn rather than photographed so it
            stays truthful when the printed art changes. */}
        <div className="panel">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: PAIRS.length * 2 }, (_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 400, damping: 20 }}
                className="flex aspect-[3/4] items-center justify-center rounded-xl bg-ink-700"
              >
                <span className="h-4 w-4 rounded-full border-2 border-cream/20" />
              </motion.div>
            ))}
          </div>
        </div>

        <p className="rounded-chunk bg-pop-yellow/12 p-4 text-sm text-cream/85">
          {ar.onboarding.cardsHint}
        </p>

        <ul className="flex flex-col gap-3 pb-4">
          {[ar.camera.permissionBody, ar.calibration.hint, ar.game.holdSteady].map((line) => (
            <li key={line} className="flex items-start gap-3 text-cream/70">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pop-yellow" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}
