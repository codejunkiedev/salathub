import type { ScreenOrientation } from '@/types';

/**
 * Shown on Free screens. Its own dark backing keeps it readable over every theme
 * and slide. Text only: no link and no price.
 */
export function PoweredByBadge({ orientation = 'landscape' }: { orientation?: ScreenOrientation }) {
  const isPortrait = orientation === 'portrait';
  return (
    <div
      dir='ltr'
      className={`pointer-events-none fixed bottom-[1.5vh] right-[1.5vh] z-50 rounded-full bg-black/60 font-medium text-white/90 backdrop-blur-sm ${
        isPortrait ? 'px-[2vw] py-[0.6vw] text-[1.8vw]' : 'px-[1.2vh] py-[0.45vh] text-[1.6vh]'
      }`}
    >
      Powered by SalatHub
    </div>
  );
}
