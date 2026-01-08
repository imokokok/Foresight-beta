"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { logClientErrorToApi } from "@/lib/errorReporting";
import { useTranslations, useLocale } from "@/lib/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tErrors = useTranslations("errors");
  const { locale } = useLocale();
  useEffect(() => {
    console.error("Global Error:", error);

    Sentry.captureException(error, {
      level: "fatal",
      tags: {
        errorBoundary: "global",
        digest: error.digest,
      },
      contexts: {
        app: {
          crashed: true,
        },
      },
    });

    logClientErrorToApi(error, { silent: true });
  }, [error]);

  return (
    <html lang={locale}>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "500px",
              width: "100%",
              background: "white",
              borderRadius: "20px",
              padding: "40px",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h1
              style={{
                fontSize: "48px",
                margin: "0 0 20px 0",
              }}
            >
              😵
            </h1>
            <h2
              style={{
                fontSize: "24px",
                margin: "0 0 10px 0",
                color: "#333",
              }}
            >
              {tErrors("errorOccurred")}
            </h2>
            <p
              style={{
                color: "#666",
                marginBottom: "30px",
              }}
            >
              {tErrors("unknownError")}
            </p>
            {process.env.NODE_ENV === "development" && (
              <div
                style={{
                  background: "#f5f5f5",
                  padding: "15px",
                  borderRadius: "10px",
                  marginBottom: "20px",
                  textAlign: "left",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  color: "#666",
                  overflowWrap: "break-word",
                }}
              >
                {error.message}
              </div>
            )}
            <button
              onClick={reset}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                padding: "12px 30px",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {tErrors("refreshPage")}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
