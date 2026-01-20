import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "development",
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }
    }
    if (event.contexts?.runtime?.name === "node" && event.extra) {
      delete event.extra.SUPABASE_SERVICE_KEY;
      delete event.extra.SUPABASE_SERVICE_ROLE_KEY;
      delete event.extra.JWT_SECRET;
      delete event.extra.SMTP_PASS;
    }
    if (process.env.NODE_ENV === "development") return null;
    return event;
  },
  ignoreErrors: [
    "Network request failed",
    "Failed to fetch",
    "NetworkError",
    "fetch failed",
    "Extension context invalidated",
    "chrome-extension://",
    "AbortError",
    "The user aborted a request",
    "User rejected",
    "User denied",
    "ECONNRESET",
    "EPIPE",
    "ETIMEDOUT",
  ],
});

export function register() {}

export const onRequestError = Sentry.captureRequestError;
