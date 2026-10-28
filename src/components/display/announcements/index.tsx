import type { Announcement, ScreenOrientation } from '@/types';
import bgImage from '@/assets/backgrounds/01.jpeg';
import { AnimationProvider, DisplayContainer, DisplayCard, DisplayHeading } from '../shared';

interface AnnouncementsDisplayProps {
  announcements: Announcement[];
  orientation?: ScreenOrientation;
}

/**
 * Displays announcements in a card layout with animation and background image
 */
export function AnnouncementsDisplay({
  announcements,
  orientation = 'landscape',
}: AnnouncementsDisplayProps) {
  if (!announcements.length) return null;

  const announcement = announcements[0];
  const isPortrait = orientation === 'portrait';

  const title = announcement.title || 'اعلان';

  // A long title needs the wide card even when the description is short.
  const cardWidth: 'md' | 'lg' =
    title.length < 20 && announcement.description.length < 50 ? 'md' : 'lg';

  // One step larger than the description at each length, so the title leads
  // without outgrowing the card.
  const getTitleSizeClass = (length: number) => {
    if (isPortrait) {
      if (length < 20) return 'text-[9vw] leading-tight';
      if (length <= 50) return 'text-[7vw] leading-tight';
      return 'text-[5.5vw] leading-tight';
    }

    if (length < 20) {
      return 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl [@media(min-width:3000px)]:text-[9rem] [@media(min-width:4000px)]:text-[11rem] leading-tight';
    } else if (length <= 50) {
      return 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl [@media(min-width:3000px)]:text-[7.5rem] [@media(min-width:4000px)]:text-[9.5rem] leading-tight';
    } else {
      return 'text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl [@media(min-width:3000px)]:text-[6.3rem] [@media(min-width:4000px)]:text-[8rem] leading-tight';
    }
  };

  const getDynamicFontClass = (length: number) => {
    if (isPortrait) {
      if (length < 50) {
        return 'text-[7vw] leading-relaxed';
      } else if (length <= 200) {
        return 'text-[5vw] leading-relaxed';
      } else {
        return 'text-[3.5vw] leading-relaxed';
      }
    }

    if (length < 50) {
      // Short: larger sizes
      return 'text-xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl [@media(min-width:3000px)]:text-[8.4rem] [@media(min-width:4000px)]:text-[10.5rem]';
    } else if (length <= 200) {
      // Medium: medium sizes
      return 'text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl [@media(min-width:3000px)]:text-[6.3rem] [@media(min-width:4000px)]:text-[8.4rem]';
    } else {
      // Long: smaller sizes
      return 'text-lg sm:text-lg md:text-xl lg:text-2xl xl:text-4xl 2xl:text-5xl [@media(min-width:3000px)]:text-[5.25rem] [@media(min-width:4000px)]:text-[6.3rem]';
    }
  };

  return (
    <DisplayContainer backgroundImage={bgImage}>
      <DisplayCard width={cardWidth}>
        <AnimationProvider>
          <DisplayHeading title={title} sizeClassName={getTitleSizeClass(title.length)} />

          <div className='min-h-[150px] 2xl:min-h-[200px] [@media(min-width:3000px)]:min-h-[184px] [@media(min-width:4000px)]:min-h-[204px] flex items-center justify-center stagger-item animate-fade-in-up'>
            <p
              className={`text-white ${getDynamicFontClass(announcement.description.length)} text-center leading-relaxed break-words`}
            >
              {announcement.description}
            </p>
          </div>
        </AnimationProvider>
      </DisplayCard>
    </DisplayContainer>
  );
}
