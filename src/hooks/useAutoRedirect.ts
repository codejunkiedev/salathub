import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';

interface UseAutoRedirectOptions {
  to: string;
  delaySeconds?: number;
  onRedirect?: () => void;
}

/**
 * Custom hook to handle automatic redirection after a specified delay
 * @param to The route path to redirect to
 * @param delaySeconds The number of seconds to wait before redirecting (default: 5)
 * @param onRedirect Optional callback function to execute before redirection
 * @returns {secondsLeft, redirectNow} seconds remaining and function to trigger immediate redirect
 */
export function useAutoRedirect({ to, delaySeconds = 5, onRedirect }: UseAutoRedirectOptions) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(delaySeconds);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectedRef = useRef(false);

  // Function to immediately trigger the redirect
  const redirectNow = useCallback(() => {
    if (!redirectedRef.current) {
      redirectedRef.current = true;
      if (onRedirect) onRedirect();
      navigate(to, { replace: true });
    }
  }, [navigate, to, onRedirect]);

  useEffect(() => {
    // Reset timer state when dependencies change
    setSecondsLeft(delaySeconds);
    redirectedRef.current = false;

    // Clear any existing timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Set up countdown timer that updates every second
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          redirectNow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Clean up timer on unmount or when dependencies change
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, delaySeconds]);

  return { secondsLeft, redirectNow };
}
