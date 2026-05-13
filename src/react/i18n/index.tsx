// ============================================================
// OpenSkill Manager - 语言上下文 (i18n)
// ============================================================
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { locales, type LocaleCode, type T, LOCALE_NAMES, RTL_LOCALES } from './locales';

type TranslationKey = keyof T;

interface LanguageContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  availableLocales: { code: LocaleCode; name: string }[];
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    try {
      const saved = localStorage.getItem('openskill-locale');
      if (saved && saved in locales) return saved as LocaleCode;
      const browserLang = navigator.language;
      if (browserLang in locales) return browserLang as LocaleCode;
      const short = browserLang.split('-')[0];
      if (short in locales) return short as LocaleCode;
    } catch {}
    return 'zh-CN';
  });

  const setLocale = useCallback((newLocale: LocaleCode) => {
    setLocaleState(newLocale);
    try { localStorage.setItem('openskill-locale', newLocale); } catch {}
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = (locales[locale] as Record<string, string>)[key as string]
      || (locales['en'] as Record<string, string>)[key as string]
      || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  }, [locale]);

  const availableLocales = Object.keys(LOCALE_NAMES).map(code => ({
    code: code as LocaleCode,
    name: LOCALE_NAMES[code as LocaleCode],
  }));

  const isRTL = RTL_LOCALES.includes(locale);

  // 同步 document dir 属性
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale, isRTL]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, availableLocales, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
