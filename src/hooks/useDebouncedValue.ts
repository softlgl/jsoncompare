import { useEffect, useState } from 'react';

/** 值稳定 delay 毫秒后才向下游传递，用于避免输入过程中高频重算 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
