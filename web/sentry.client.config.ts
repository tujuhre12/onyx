import * as Sentry from "@sentry/nextjs";

// Only do this if you actually have a DSN set
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Capture unhandled exceptions and performance data
    integrations: [],
    tracesSampleRate: 0.1,
  });
}
