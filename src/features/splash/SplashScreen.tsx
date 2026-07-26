import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button, Logo } from '../../components';
import { to } from '../../app/routes';
import { ar } from '../../i18n/ar';
import { useDeviceStore } from '../../state/deviceStore';

const BRAND_HOLD_MS = 1400;

/**
 * The brand beat. It also decides where the app actually starts, so a phone
 * that was mid-match when it was locked comes back to the match instead of the
 * lobby.
 */
export default function SplashScreen(): JSX.Element {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const onboardingSeen = useDeviceStore((s) => s.onboardingSeen);
  const roomId = useDeviceStore((s) => s.roomId);
  const clearRoom = useDeviceStore((s) => s.clearRoom);
  const [offerResume, setOfferResume] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (roomId) {
        setOfferResume(true);
        return;
      }
      navigate(onboardingSeen ? to.lobby() : to.onboarding(), { replace: true });
    }, BRAND_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [navigate, onboardingSeen, roomId]);

  return (
    <div className="screen h-full items-center justify-center bg-ink-950">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        >
          <Logo size="lg" withTagline />
        </motion.div>
      </div>

      <div className="w-full px-6 pb-10">
        {offerResume && roomId ? (
          <motion.div
            initial={reduceMotion ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="flex flex-col gap-3"
          >
            <Button size="lg" fullWidth onClick={() => navigate(to.setup(roomId))}>
              {ar.lobby.resume}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                clearRoom();
                navigate(onboardingSeen ? to.lobby() : to.onboarding(), { replace: true });
              }}
            >
              {ar.lobby.title}
            </Button>
          </motion.div>
        ) : (
          <div className="flex justify-center">
            <motion.span
              aria-hidden="true"
              animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="h-2.5 w-2.5 rounded-pill bg-pop-yellow"
            />
          </div>
        )}
      </div>
    </div>
  );
}
