import { useState, useEffect } from 'react';
import { nowInTimeZone } from '@/utils';

type ReturnType = {
  currentTime: Date;
};

/**
 * Hook that returns the current time and updates every second
 * @param timeZone The masjid's IANA zone; null falls back to the device's
 * @returns {Date} The current time, as a wall clock in that zone
 */
export const useCurrentTime = (timeZone: string | null | undefined = null): ReturnType => {
  const [currentTime, setCurrentTime] = useState<Date>(() => nowInTimeZone(timeZone));
  const [prevTimeZone, setPrevTimeZone] = useState(timeZone);

  if (prevTimeZone !== timeZone) {
    setPrevTimeZone(timeZone);
    setCurrentTime(nowInTimeZone(timeZone));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(nowInTimeZone(timeZone));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeZone]);

  return { currentTime };
};
