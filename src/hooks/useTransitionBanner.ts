import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyTransition } from '../utils/notifications';

/**
 * The in-app transition banner, plus the matching system notification.
 *
 * Every timer had its own byte-identical copy of this: a message state, a timeout ref, a helper
 * that replaced any banner still counting down, and an unmount cleanup. Sharing it means the
 * notification hook-up happens once rather than eight times, and a fix here reaches every timer.
 */
export function useTransitionBanner(methodName: string) {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const show = useCallback(
    (text: string) => {
      setMessage(text);
      // Tagged per method so a timer left running cannot stack a wall of notifications.
      notifyTransition(methodName, text, `lock-in-${methodName}`);
      // Replace any banner still counting down rather than stacking timeouts.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setMessage(null);
        timeoutRef.current = null;
      }, 4000);
    },
    [methodName]
  );

  const dismiss = useCallback(() => setMessage(null), []);

  return { message, show, dismiss };
}
