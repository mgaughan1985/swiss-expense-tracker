// lib/sentry.ts
import * as Sentry from '@sentry/react-native';

export function initialiseSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enabled: process.env.NODE_ENV !== 'development',
    tracesSampleRate: 0.2,
  });
}

export function setSentryUser(userId: string) {
  Sentry.setUser({ id: userId });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}