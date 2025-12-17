export async function fetchUsernamesByAddresses(
  addresses: string[]
): Promise<Record<string, string>> {
  const list = Array.from(
    new Set(
      addresses
        .map((x) => String(x || "").toLowerCase())
        .filter((x) => x && x.startsWith("0x"))
    )
  );
  if (list.length === 0) return {};
  try {
    const res = await fetch(
      `/api/user-profiles?addresses=${encodeURIComponent(list.join(","))}`
    );
    const data = await res.json().catch(() => ({}));
    const arr = Array.isArray(data?.profiles) ? data.profiles : [];
    const next: Record<string, string> = {};
    arr.forEach((p: any) => {
      if (p?.wallet_address && p?.username) {
        const k = String(p.wallet_address).toLowerCase();
        if (!next[k]) next[k] = String(p.username);
      }
    });
    return next;
  } catch {
    return {};
  }
}

