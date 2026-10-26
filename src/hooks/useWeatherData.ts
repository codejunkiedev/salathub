import { useEffect, useMemo, useState } from 'react';
import { fetchWeatherForecast } from '@/api';
import type { DisplayLanguage, OpenWeatherForecastResponse } from '@/types';
import type { ErrorMessage } from '@/components/display';
import { useDisplayStore } from '@/store';
import {
  parseOpenWeatherForecast,
  isNullOrUndefined,
  readWeatherCache,
  writeWeatherCache,
} from '@/utils';

/**
 * Custom hook to fetch and manage weather data
 * Fetches weather forecast based on masjid location coordinates
 * Automatically refreshes data every 30 minutes
 * @returns Object containing weather forecast, loading state, and error messages
 */
export function useWeatherData(enabled: boolean = true, language: DisplayLanguage = 'en') {
  const { masjidProfile } = useDisplayStore();
  const { latitude, longitude, timezone } = masjidProfile || {};
  const timeZone = timezone ?? null;
  const hasLocation = !isNullOrUndefined(latitude) && !isNullOrUndefined(longitude);
  const requestKey = enabled && hasLocation ? `${latitude},${longitude},${language}` : null;

  const [fetched, setFetched] = useState<{
    key: string;
    data: OpenWeatherForecastResponse;
  } | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);

  // Hydrate from cache so the slide can render before the network call resolves.
  // If the API later fails, the user keeps seeing this stale-but-valid forecast.
  const cached = useMemo(() => {
    if (!requestKey || isNullOrUndefined(latitude) || isNullOrUndefined(longitude)) return null;
    return readWeatherCache(latitude, longitude, language);
  }, [requestKey, latitude, longitude, language]);

  const rawForecast =
    (fetched?.key === requestKey ? fetched.data : null) ?? cached ?? fetched?.data ?? null;
  const weatherForecast = useMemo(
    () => (rawForecast ? parseOpenWeatherForecast(rawForecast, timeZone) : null),
    [rawForecast, timeZone]
  );

  const isLoading = requestKey !== null && !cached && settledKey !== requestKey;

  const errorMessage: ErrorMessage | null =
    enabled && !hasLocation
      ? {
          title: 'Masjid location is missing',
          description:
            'Weather requires latitude and longitude from the masjid profile. Please set the location in the admin panel, or disable weather on this screen.',
        }
      : null;

  useEffect(() => {
    if (!requestKey || isNullOrUndefined(latitude) || isNullOrUndefined(longitude)) return;

    const abortController = new AbortController();
    const { signal } = abortController;

    const getWeatherData = () =>
      fetchWeatherForecast({ lat: latitude, lon: longitude, signal, language })
        .then(data => {
          if (!data || signal.aborted) return;
          setFetched({ key: requestKey, data });
          writeWeatherCache(latitude, longitude, language, data);
        })
        .catch(error => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          // Keep whatever forecast is already on screen (cached or last successful fetch).
          console.error('Failed to fetch weather data', error);
        })
        .finally(() => {
          if (!signal.aborted) setSettledKey(requestKey);
        });

    void getWeatherData();

    // Refresh weather data every 30 minutes
    const interval = setInterval(
      () => {
        if (!signal.aborted) void getWeatherData();
      },
      30 * 60 * 1000
    );

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [requestKey, latitude, longitude, language]);

  return { weatherForecast, isLoading, errorMessage };
}
