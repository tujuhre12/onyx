import * as Sentry from "@sentry/nextjs";

// Only do this if you actually have a DSN set
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    integrations: [
      // BrowserTracing automatically measures page loads and navigation
      // Sentry.browserTracingIntegration(),
    ],

    // Set a non-zero sample rate to capture performance data.
    // 1.0 = 100% of page loads will have performance data; in production you might pick 0.1 or 0.2
    tracesSampleRate: 1.0,

    // If you see `enableTracing: false` anywhere in your code, remove it or set it to true.
  });
}
