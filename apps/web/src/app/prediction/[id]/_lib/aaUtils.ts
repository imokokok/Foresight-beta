export async function trySubmitAaCalls(input: {
  chainId: number;
  calls: Array<{ to: string; data: string; value?: string }>;
}) {
  const res = await fetch("/api/aa/userop/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => null);
  if (res.ok && json?.success) return json;
  const msg = json?.error?.message || json?.message || "AA submit failed";
  throw new Error(String(msg));
}

export function isAaEnabled() {
  const aaEnabled = String(process.env.NEXT_PUBLIC_AA_ENABLED || "")
    .trim()
    .toLowerCase();
  return aaEnabled === "1" || aaEnabled === "true" || aaEnabled === "yes" || aaEnabled === "on";
}
