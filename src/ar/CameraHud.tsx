import { useEffect, useRef, type ReactNode } from 'react';
import { useAr } from './ArProvider';

interface CameraHudProps {
  /** Overlay content rendered above the camera feed. */
  children: ReactNode;
}

/**
 * The live-camera HUD shell. Renders the camera feed as a full-bleed background
 * (or a styled futuristic fallback when the camera is unavailable/denied) and
 * lays the game overlay on top. Purely presentational — no game rules here.
 */
export function CameraHud({ children }: CameraHudProps): JSX.Element {
  const { cameraStatus, attachVideo, detach } = useAr();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el) void attachVideo(el);
    return () => detach();
  }, [attachVideo, detach]);

  const showVideo = cameraStatus === 'granted';

  return (
    <div className="relative h-full w-full overflow-hidden bg-navy-950">
      {/* Camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          showVideo ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback / tint background — also dims the live feed for readability */}
      <div
        className={`absolute inset-0 ${
          showVideo
            ? 'bg-gradient-to-b from-navy-950/40 via-navy-900/30 to-navy-950/80'
            : 'bg-gradient-to-br from-navy-900 via-navy-950 to-black'
        }`}
        aria-hidden
      />

      {/* HUD scanlines / grid accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.15) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full w-full flex-col">{children}</div>
    </div>
  );
}
