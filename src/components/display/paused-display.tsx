import { useTranslation } from 'react-i18next';
import { MonitorOff } from 'lucide-react';
import { getDir, getFontClass } from '@/i18n';
import type { DisplayLanguage, ScreenOrientation } from '@/types';

/**
 * All a paused screen shows. No price, link or upgrade prompt: the TV app is in
 * the Play Store, which bars pointing users to payment outside it.
 */
export function PausedDisplay({ orientation = 'landscape' }: { orientation?: ScreenOrientation }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as DisplayLanguage;
  const isPortrait = orientation === 'portrait';

  return (
    <div
      dir={getDir(lang)}
      className={`flex h-screen w-full flex-col items-center justify-center gap-[3vh] overflow-hidden bg-neutral-950 px-[8vw] text-center text-white ${getFontClass(lang)}`}
    >
      <MonitorOff className={isPortrait ? 'h-[10vw] w-[10vw]' : 'h-[9vh] w-[9vh]'} />
      <p className={`font-semibold leading-snug ${isPortrait ? 'text-[6vw]' : 'text-[5vh]'}`}>
        {t('pausedScreen.title')}
      </p>
      <p className={`text-white/70 leading-snug ${isPortrait ? 'text-[4vw]' : 'text-[3.2vh]'}`}>
        {t('pausedScreen.subtitle')}
      </p>
    </div>
  );
}
