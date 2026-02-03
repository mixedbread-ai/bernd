import { useEffect, useRef } from 'react';

export function useAutoFocus<T extends HTMLElement>(shouldFocus: boolean = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!shouldFocus) return;

    // Skip on mobile screens to avoid keyboard popup
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    // Small delay to ensure element is mounted
    const timer = setTimeout(() => {
      ref.current?.focus();
    }, 0);

    return () => clearTimeout(timer);
  }, [shouldFocus]);

  return ref;
}
