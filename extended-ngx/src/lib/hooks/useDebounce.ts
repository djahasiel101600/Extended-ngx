import { useEffect, useState } from 'react';

/**
 * useDebounce - React hook for debouncing a value
 * @param value The value to debounce
 * @param delay The debounce delay in ms
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
