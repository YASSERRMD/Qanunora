import { useI18nStore } from '@/stores/i18n.store';
import en from './en.json';
import ar from './ar.json';

const translations: Record<string, Record<string, unknown>> = { en, ar };

/**
 * Get a nested translation value by dot-notation key.
 * Returns the key itself when the translation is missing.
 */
function getNestedValue(obj: Record<string, unknown>, key: string): string {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
}

/**
 * Returns a translation function for the current locale.
 *
 * Usage:
 *   const { t, locale, isRtl } = useTranslation();
 *   t('nav.dashboard')  // => "Dashboard" or "لوحة التحكم"
 */
export function useTranslation() {
  const { locale } = useI18nStore();
  const dict = (translations[locale] ?? translations['en']) as Record<string, unknown>;

  function t(key: string): string {
    return getNestedValue(dict, key);
  }

  return {
    t,
    locale,
    isRtl: locale === 'ar',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
  } as const;
}
