import { cn } from '@/utils/general';
import {
  ALKHAIRIA_APP_STORE_URL,
  ALKHAIRIA_PLAY_STORE_URL,
  APP_STORE_BADGE,
  GOOGLE_PLAY_BADGE,
  type DevicePlatform,
} from '@/helpers/follow-link';

type StoreBadgesProps = {
  /** Show only the store for this platform. 'other' shows every live store. */
  platform?: DevicePlatform;
  /** Render plain images, for screens nobody can tap. */
  linked?: boolean;
  className?: string;
  /** Sets the badge height; both badges share it so they line up. */
  badgeClassName?: string;
};

/**
 * The official Google Play and App Store badges. The App Store badge appears
 * only once ALKHAIRIA_APP_STORE_URL is set.
 */
export function StoreBadges({
  platform = 'other',
  linked = true,
  className,
  badgeClassName = 'h-11',
}: StoreBadgesProps) {
  const badges = [
    platform !== 'ios' && {
      key: 'play',
      href: ALKHAIRIA_PLAY_STORE_URL,
      src: GOOGLE_PLAY_BADGE,
      alt: 'Get it on Google Play',
    },
    platform !== 'android' &&
      ALKHAIRIA_APP_STORE_URL && {
        key: 'app-store',
        href: ALKHAIRIA_APP_STORE_URL,
        src: APP_STORE_BADGE,
        alt: 'Download on the App Store',
      },
  ].filter(badge => !!badge);

  if (badges.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {badges.map(badge => {
        const image = (
          <img src={badge.src} alt={badge.alt} className={cn('w-auto', badgeClassName)} />
        );
        return linked ? (
          <a key={badge.key} href={badge.href} target='_blank' rel='noreferrer'>
            {image}
          </a>
        ) : (
          <span key={badge.key}>{image}</span>
        );
      })}
    </div>
  );
}
