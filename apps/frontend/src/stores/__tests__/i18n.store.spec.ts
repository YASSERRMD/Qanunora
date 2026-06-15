import { act } from '@testing-library/react';
import { useI18nStore } from '../i18n.store';

// Reset the store state between tests
beforeEach(() => {
  act(() => {
    useI18nStore.setState({ locale: 'en' });
  });
});

describe('useI18nStore', () => {
  it('initialises with English locale', () => {
    const state = useI18nStore.getState();
    expect(state.locale).toBe('en');
  });

  it('switches locale to Arabic', () => {
    act(() => {
      useI18nStore.getState().setLocale('ar');
    });
    expect(useI18nStore.getState().locale).toBe('ar');
  });

  it('switches back from Arabic to English', () => {
    act(() => {
      useI18nStore.getState().setLocale('ar');
    });
    act(() => {
      useI18nStore.getState().setLocale('en');
    });
    expect(useI18nStore.getState().locale).toBe('en');
  });

  it('exposes setLocale function', () => {
    const { setLocale } = useI18nStore.getState();
    expect(typeof setLocale).toBe('function');
  });
});
