import { useEffect, useRef } from 'react';

export function useAutoSave(
  trigger: unknown,
  enabled: boolean,
  onSave: () => void | Promise<void>,
  delayMs = 2000
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const firstRun = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void onSaveRef.current();
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trigger, enabled, delayMs]);
}
