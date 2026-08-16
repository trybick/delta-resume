import * as Sentry from '@sentry/react';
import { getSentryDsn } from './lib/env';

const dsn = getSentryDsn();

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    tracePropagationTargets: [/^\//, /^https?:\/\/localhost(:\d+)?\/api/],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [/Java object is gone/, /window\.webkit\.messageHandlers/],
    denyUrls: [/iabjs:\/\//i, /navigation_performance_logger_android/i],
  });
}
