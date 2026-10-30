import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useFetchDisplayData,
  useOnlineStatus,
  useOrientationMismatch,
  usePrayerAlert,
  usePrayerTimings,
  useScreenHeartbeat,
  useWakeLock,
  useWeatherData,
} from '@/hooks';
import { useDisplayStore } from '@/store';
import { formatContactDetails, localizedProfileField } from '@/helpers';
import { isEventUpcoming } from '@/utils';
import Loading from '../loading-page';
import {
  ErrorDisplay,
  PrayerTimingDisplay,
  AnnouncementsDisplay,
  PostsDisplay,
  EventsDisplay,
  WeatherDisplay,
  FollowQrDisplay,
  YouTubeVideoDisplay,
  AyatHadithDisplay,
} from '@/components/display';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import { EffectFade, Keyboard } from 'swiper/modules';
import {
  Theme,
  type Announcement,
  type AyatAndHadith,
  type Event,
  type Post,
  type YouTubeVideo,
} from '@/types';
import './display.css';

const DEFAULT_SLIDE_DELAY = 5000;

export default function Display() {
  useWakeLock();

  const swiperRef = useRef<SwiperType | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const { masjidProfile, displayScreen } = useDisplayStore();
  const { i18n } = useTranslation();

  useScreenHeartbeat(displayScreen?.code);

  const {
    mismatch: orientationMismatch,
    expected,
    actual,
  } = useOrientationMismatch(displayScreen?.orientation);

  const showPrayerTimes = displayScreen?.show_prayer_times ?? true;
  const showWeather = displayScreen?.show_weather ?? true;
  // Un-listing withdraws the masjid from the app, so the invitation goes with it.
  const followQrMasjidId =
    displayScreen?.show_follow_qr && masjidProfile?.in_app ? masjidProfile.id : null;
  const language = displayScreen?.language ?? 'en';
  const slideDelay = displayScreen?.slide_interval_seconds
    ? displayScreen.slide_interval_seconds * 1000
    : DEFAULT_SLIDE_DELAY;
  const prayerAlertTriggers = displayScreen?.prayer_alert_triggers ?? [];

  // Localized profile text with English fallback when a translation is blank.
  const localizedArea = localizedProfileField(masjidProfile, 'area', language);
  const localizedMasjidName = localizedProfileField(masjidProfile, 'name', language);
  // Phone, email and website are language-neutral, so unlike the name and area
  // they are the same line on every screen.
  const contactDetails = formatContactDetails(masjidProfile);

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [i18n, language]);

  const isOnline = useOnlineStatus();
  const masjidTimeZone = masjidProfile?.timezone ?? null;

  // The payload is only refetched on the revision beacon, so the events
  // cut-off below is re-checked on a minute tick.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const {
    isLoading,
    errorMessage,
    orderedContent: rawOrderedContent,
    userSettings,
  } = useFetchDisplayData();

  // YouTube embeds need a live network connection, so drop those slides when
  // we're offline — the slideshow keeps cycling through the remaining content.
  const orderedContent = useMemo(
    () =>
      rawOrderedContent.filter(item => {
        if (item.contentType === 'youtube_videos') return isOnline;
        if (item.contentType === 'events') return isEventUpcoming(item.data as Event, now);
        return true;
      }),
    [rawOrderedContent, isOnline, now]
  );

  const {
    isLoading: isPrayerTimingsLoading,
    errorMessage: prayerTimingsError,
    prayerTimes,
    prayerTimeSettings,
  } = usePrayerTimings(showPrayerTimes || prayerAlertTriggers.length > 0);

  usePrayerAlert({
    triggers: prayerAlertTriggers,
    prayerTimes,
    prayerTimeSettings,
    timeZone: masjidTimeZone,
  });

  const {
    weatherForecast,
    isLoading: isWeatherLoading,
    errorMessage: weatherErrorMessage,
  } = useWeatherData(showWeather, language);

  // Build a set of slide indices that are YouTube videos (offset by prayer/weather slides)
  const youtubeSlideIndices = useMemo(() => {
    const fixedSlideCount =
      (showPrayerTimes ? 1 : 0) +
      (showWeather && weatherForecast ? 1 : 0) +
      (followQrMasjidId ? 1 : 0);
    const indices = new Set<number>();
    orderedContent.forEach((item, i) => {
      if (item.contentType === 'youtube_videos') {
        indices.add(fixedSlideCount + i);
      }
    });
    return indices;
  }, [orderedContent, showPrayerTimes, showWeather, weatherForecast, followQrMasjidId]);

  const advanceSlide = useCallback(() => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    if (swiper.activeIndex >= swiper.slides.length - 1) {
      swiper.slideTo(0);
    } else {
      swiper.slideNext();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const swiper = swiperRef.current;
      if (!swiper) return;
      // Don't auto-advance if current slide is a YouTube video — the video handles its own timing
      if (youtubeSlideIndices.has(swiper.activeIndex)) return;
      if (swiper.activeIndex >= swiper.slides.length - 1) {
        swiper.slideTo(0);
      } else {
        swiper.slideNext();
      }
    }, slideDelay);

    return () => clearInterval(interval);
  }, [youtubeSlideIndices, slideDelay]);

  const isPageLoading =
    isLoading || (showPrayerTimes && isPrayerTimingsLoading) || (showWeather && isWeatherLoading);

  if (isPageLoading) return <Loading />;

  if (orientationMismatch) {
    return (
      <ErrorDisplay
        errorMessage={{
          title: 'Orientation mismatch',
          description: `This screen is configured for ${expected} mode but your monitor is in ${actual} mode. Please rotate your monitor or change the screen orientation in the admin panel.`,
        }}
      />
    );
  }

  if (errorMessage) return <ErrorDisplay errorMessage={errorMessage} />;
  if (showPrayerTimes && prayerTimingsError)
    return <ErrorDisplay errorMessage={prayerTimingsError} />;
  if (showWeather && weatherErrorMessage)
    return <ErrorDisplay errorMessage={weatherErrorMessage} />;

  const hasNoContent =
    !showPrayerTimes &&
    !(showWeather && weatherForecast) &&
    !followQrMasjidId &&
    orderedContent.length === 0;

  if (hasNoContent) {
    return (
      <ErrorDisplay
        errorMessage={{
          title: 'No content assigned',
          description:
            'This screen has no content assigned to it yet. Please assign content from the admin panel.',
        }}
      />
    );
  }

  const fixedSlideCount =
    (showPrayerTimes ? 1 : 0) +
    (showWeather && weatherForecast ? 1 : 0) +
    (followQrMasjidId ? 1 : 0);

  const contentSlides = orderedContent.map((item, index) => {
    const slideIndex = fixedSlideCount + index;

    switch (item.contentType) {
      case 'announcements':
        return (
          <SwiperSlide key={`content-${index}`}>
            <AnnouncementsDisplay
              announcements={[item.data as Announcement]}
              orientation={displayScreen?.orientation ?? 'landscape'}
            />
          </SwiperSlide>
        );
      case 'events':
        return (
          <SwiperSlide key={`content-${index}`}>
            <EventsDisplay
              event={item.data as Event}
              orientation={displayScreen?.orientation ?? 'landscape'}
              timeZone={masjidTimeZone}
            />
          </SwiperSlide>
        );
      case 'posts':
        return (
          <SwiperSlide key={`content-${index}`}>
            <PostsDisplay post={item.data as Post} />
          </SwiperSlide>
        );
      case 'youtube_videos':
        return (
          <SwiperSlide key={`content-${index}`}>
            <YouTubeVideoDisplay
              video={item.data as YouTubeVideo}
              isActive={activeSlideIndex === slideIndex}
              onSlideNext={advanceSlide}
            />
          </SwiperSlide>
        );
      case 'ayat_and_hadith':
        return (
          <SwiperSlide key={`content-${index}`}>
            <AyatHadithDisplay slide={item.data as AyatAndHadith} />
          </SwiperSlide>
        );
      default:
        return null;
    }
  });

  return (
    <div className='h-screen w-full overflow-hidden'>
      <Swiper
        onSwiper={swiper => {
          swiperRef.current = swiper;
        }}
        onSlideChange={swiper => setActiveSlideIndex(swiper.activeIndex)}
        modules={[EffectFade, Keyboard]}
        effect='fade'
        fadeEffect={{ crossFade: true }}
        spaceBetween={0}
        slidesPerView={1}
        speed={800}
        keyboard={{ enabled: true, onlyInViewport: true }}
        navigation={false}
        className='h-full w-full'
      >
        {showPrayerTimes && (
          <SwiperSlide>
            <PrayerTimingDisplay
              prayerTimes={prayerTimes}
              prayerTimeSettings={prayerTimeSettings}
              userSettings={userSettings}
              orientation={displayScreen?.orientation ?? 'landscape'}
              theme={displayScreen?.theme ?? Theme.Theme1}
              masjidName={localizedMasjidName}
              contactDetails={contactDetails}
              customTheme={displayScreen?.custom_theme}
              timeZone={masjidTimeZone}
            />
          </SwiperSlide>
        )}
        {showWeather && weatherForecast && (
          <SwiperSlide>
            <WeatherDisplay
              weatherForecast={weatherForecast}
              area={localizedArea}
              orientation={displayScreen?.orientation ?? 'landscape'}
              timeZone={masjidTimeZone}
            />
          </SwiperSlide>
        )}
        {followQrMasjidId && (
          <SwiperSlide>
            <FollowQrDisplay
              masjidId={followQrMasjidId}
              masjidName={localizedMasjidName}
              orientation={displayScreen?.orientation ?? 'landscape'}
            />
          </SwiperSlide>
        )}
        {contentSlides}
        {/* {isDev && (
          <SwiperSlide>
            <LogoutDisplay />
          </SwiperSlide>
        )} */}
      </Swiper>
    </div>
  );
}
