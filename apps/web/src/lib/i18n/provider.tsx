'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '../api/client';
import { translate, type Locale, type Message, type Theme } from './messages';

const statuses = {
  UNDER_REVIEW: 'Under review',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  SHIPPED: 'Shipped',
  REJECTED: 'Not planned',
} as const;
const errorMessages: Record<string, Message> = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  REGISTRATION_FAILED:
    'The account could not be created. Try another sign-in method or try again.',
  VALIDATION_FAILED: 'Check the form fields.',
  AUTH_REQUIRED: 'Your session expired. Sign in again.',
  SLUG_CONFLICT: 'That slug is already in use. Choose another.',
  IDEMPOTENCY_IN_PROGRESS: 'Wait a moment before trying again.',
  GITHUB_SIGN_IN_FAILED: 'Could not start GitHub sign-in. Try again.',
};
function localeTools(locale: Locale) {
  const t = (message: Message) => translate(locale, message);
  return {
    t,
    statusLabel: (status: keyof typeof statuses) => t(statuses[status]),
    date: (value: string) =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(value)),
    number: (value: number) => new Intl.NumberFormat(locale).format(value),
    errorMessage: (error: unknown) => {
      if (!(error instanceof ApiError))
        return t('Could not connect. Try again.');
      const message = errorMessages[error.code];
      if (message) return t(message);
      if (error.status === 401)
        return t('Your session expired. Sign in again.');
      if (error.status === 403)
        return t('You do not have permission for this action.');
      if (error.status === 404) return t('This item could not be found.');
      if (error.status === 412 || error.status === 428)
        return t('This item changed. Reload before saving.');
      if (error.status === 429) return t('Wait a moment before trying again.');
      return t('The request could not be completed. Try again.');
    },
  };
}
type Preferences = ReturnType<typeof localeTools> & {
  locale: Locale;
  theme: Theme;
  setLocale: (value: Locale) => void;
  setTheme: (value: Theme) => void;
};
const LocaleContext = createContext<Preferences>({
  locale: 'en' as Locale,
  theme: 'system' as Theme,
  setLocale: () => undefined,
  setTheme: () => undefined,
  ...localeTools('en'),
});

function remember(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}
export function PreferencesProvider({
  children,
  initialLocale = 'en',
  initialTheme = 'system',
}: {
  children: ReactNode;
  initialLocale?: Locale;
  initialTheme?: Theme;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  const [theme, updateTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);
  return (
    <LocaleContext.Provider
      value={{
        locale,
        theme,
        ...localeTools(locale),
        setLocale: (value) => {
          remember('shipboard-locale', value);
          updateLocale(value);
        },
        setTheme: (value) => {
          remember('shipboard-theme', value);
          updateTheme(value);
        },
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
export function useLocale() {
  return useContext(LocaleContext);
}

export function PreferenceControls() {
  const { locale, theme, setLocale, setTheme, t } = useLocale();
  return (
    <div className="preference-controls">
      <label className="sr-only" htmlFor="site-language">
        {t('Language')}
      </label>
      <select
        id="site-language"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        <option value="pt-BR">Português</option>
        <option value="en">English</option>
      </select>
      <label className="sr-only" htmlFor="site-theme">
        {t('Theme')}
      </label>
      <select
        id="site-theme"
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
      >
        <option value="system">{t('System')}</option>
        <option value="light">{t('Light')}</option>
        <option value="dark">{t('Dark')}</option>
      </select>
    </div>
  );
}
