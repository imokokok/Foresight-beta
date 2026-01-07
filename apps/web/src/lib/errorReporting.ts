export function logClientErrorToApi(
  error: Error & { digest?: string },
  options?: { silent?: boolean }
) {
  if (typeof window === "undefined") return;

  fetch("/api/error-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error: error.message,
      stack: error.stack,
      digest: error.digest,
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch((err) => {
    if (!options?.silent) {
      console.error("Failed to log error:", err);
    }
  });
}
