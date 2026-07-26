import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button, Screen } from '../../components';
import { to } from '../../app/routes';
import { ar } from '../../i18n/ar';
import { useDeviceStore } from '../../state/deviceStore';
import { StepArt } from './StepArt';

const STEPS = ar.onboarding.steps;
const SWIPE_THRESHOLD = 56;

export default function OnboardingScreen(): JSX.Element {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const completeOnboarding = useDeviceStore((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);
  // Direction feeds the slide animation; +1 means "moving forward".
  const [direction, setDirection] = useState(1);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const goTo = (next: number): void => {
    const clamped = Math.min(STEPS.length - 1, Math.max(0, next));
    if (clamped === index) return;
    setDirection(clamped > index ? 1 : -1);
    setIndex(clamped);
  };

  const finish = (): void => {
    completeOnboarding();
    navigate(to.lobby(), { replace: true });
  };

  const onNext = (): void => {
    if (isLast) navigate(to.howToPlay());
    else goTo(index + 1);
  };

  // RTL page-turning: dragging toward the start edge (right) advances.
  const onDragEnd = (_event: unknown, info: PanInfo): void => {
    if (info.offset.x > SWIPE_THRESHOLD) goTo(index + 1);
    else if (info.offset.x < -SWIPE_THRESHOLD) goTo(index - 1);
  };

  return (
    <Screen
      action={
        <button
          type="button"
          onClick={finish}
          className="min-h-[44px] rounded-pill px-3 font-display text-base font-bold text-cream/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pop-sky"
        >
          {ar.common.skip}
        </button>
      }
      footer={
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-2" aria-hidden="true">
            {STEPS.map((_, dot) => (
              <span
                key={dot}
                className={`h-2.5 rounded-pill transition-all duration-300 ${
                  dot === index ? 'w-8 bg-pop-yellow' : 'w-2.5 bg-white/20'
                }`}
              />
            ))}
          </div>
          <Button size="lg" fullWidth onClick={onNext}>
            {isLast ? ar.common.next : ar.common.next}
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <motion.div
          drag="x"
          dragSnapToOrigin
          dragElastic={0.18}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={onDragEnd}
          className="flex flex-1 touch-pan-y flex-col items-center justify-center gap-8 py-4"
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={reduceMotion ? false : { x: direction * -48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { x: direction * 48, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              className="flex w-full flex-col items-center gap-8"
            >
              <StepArt index={index} />
              <div className="flex flex-col items-center gap-3 text-center">
                <h2 className="text-balance font-display text-3xl font-black text-cream">
                  {step?.title}
                </h2>
                <p className="text-balance max-w-sm font-body text-lg leading-relaxed text-cream/70">
                  {step?.body}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </Screen>
  );
}
