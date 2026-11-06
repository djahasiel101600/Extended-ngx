import { useCallback, useState } from 'react';
import { readJSON, writeJSON, removeKey } from '@/lib/storage';

/**
 * useLocalStorage — a useState-like hook that transparently persists to
 * localStorage via the defensive storage helpers. Returns the current value,
 * a setter, and a `reset` that removes the stored key (falls back to default).
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readJSON<T>(key, initialValue));

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeJSON(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const reset = useCallback(() => {
    removeKey(key);
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, set, reset] as const;
}
