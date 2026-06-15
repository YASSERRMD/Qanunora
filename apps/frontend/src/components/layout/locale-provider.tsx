'use client';

import { useEffect } from 'react';
import { useI18nStore } from '@/stores/i18n.store';

/**
 * Sets the html lang and dir attributes reactively whenever the locale changes.
 * Rendered inside the body so it can use the Zustand store safely.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useI18nStore();

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('lang', locale);
    html.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  }, [locale]);

  return <>{children}</>;
}
