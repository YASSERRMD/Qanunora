'use client';

import { useI18nStore, type Locale } from '@/stores/i18n.store';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18nStore();

  function toggle() {
    const next: Locale = locale === 'en' ? 'ar' : 'en';
    setLocale(next);
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-primary-gold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-gold focus:ring-offset-1"
      aria-label={locale === 'en' ? 'Switch to Arabic' : 'Switch to English'}
      title={locale === 'en' ? 'Switch to Arabic (العربية)' : 'Switch to English'}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        {locale === 'en' ? '🇸🇦' : '🇬🇧'}
      </span>
      <span>{locale === 'en' ? 'عربي' : 'EN'}</span>
    </button>
  );
}
