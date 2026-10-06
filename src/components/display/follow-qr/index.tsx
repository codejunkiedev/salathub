import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { getDir, getFontClass } from '@/i18n';
import { masjidFollowUrl } from '@/helpers';
import type { DisplayLanguage, ScreenOrientation } from '@/types';

interface FollowQrDisplayProps {
  masjidId: string;
  masjidName?: string;
  orientation?: ScreenOrientation;
}

/**
 * Invites the congregation to follow the masjid in the Alkhairia app. The code is
 * drawn here from the masjid's id, so the slide needs no network once loaded.
 */
export function FollowQrDisplay({
  masjidId,
  masjidName,
  orientation = 'landscape',
}: FollowQrDisplayProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as DisplayLanguage;
  const isPortrait = orientation === 'portrait';
  const unit = isPortrait ? 'vw' : 'vh';
  // Nastaliq stacks tall, so Urdu needs a smaller heading and far looser lines
  // than Latin or Naskh text to keep wrapped lines from running into each other.
  const isUrdu = lang === 'ur';
  const titleSize = isPortrait
    ? isUrdu
      ? 'text-[6.4vw]'
      : 'text-[8vw]'
    : isUrdu
      ? 'text-[3.6vw]'
      : 'text-[4.6vw]';
  const leading = isUrdu ? 'leading-[2.1]' : 'leading-snug';

  return (
    <div
      className='h-screen w-full overflow-hidden text-white'
      style={{ background: 'linear-gradient(135deg, #064e3b, #022c22)' }}
    >
      <div
        dir={getDir(lang)}
        className={`flex h-full w-full items-center justify-center ${getFontClass(lang)} ${
          isPortrait ? 'flex-col gap-[6vh] px-[8vw]' : 'flex-row gap-[6vw] px-[6vw]'
        }`}
      >
        <div
          className={`flex flex-col ${
            isPortrait
              ? 'items-center text-center gap-[2.5vh]'
              : `flex-1 ${isUrdu ? 'gap-[1.5vh]' : 'gap-[4vh]'}`
          }`}
        >
          {masjidName && (
            <div
              className={`font-semibold text-emerald-200 ${isPortrait ? 'text-[5vw]' : 'text-[2.6vw]'}`}
            >
              {masjidName}
            </div>
          )}
          <h2 className={`font-bold ${isUrdu ? 'leading-[2]' : 'leading-tight'} ${titleSize}`}>
            {t('followQr.title')}
          </h2>
          <p className={`text-white/85 ${leading} ${isPortrait ? 'text-[4vw]' : 'text-[2.1vw]'}`}>
            {t('followQr.subtitle')}
          </p>
          <p className={`text-white/70 ${isPortrait ? 'text-[3.2vw]' : 'text-[1.6vw]'}`}>
            {t('followQr.store')}
          </p>
        </div>

        {/* The white margin is the code's quiet zone; scanners need it. */}
        <div
          className='shrink-0 rounded-[3vh] bg-white shadow-2xl'
          style={{ padding: `4${unit}`, width: `72${unit}`, height: `72${unit}` }}
        >
          <QRCodeSVG value={masjidFollowUrl(masjidId)} level='M' className='h-full w-full' />
        </div>
      </div>
    </div>
  );
}
