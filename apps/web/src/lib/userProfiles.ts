export async function fetchUsernamesByAddresses(
  addresses: string[]
): Promise<Record<string, string>> {
  const list = Array.from(
    new Set(
      addresses.map((x) => String(x || "").toLowerCase()).filter((x) => x && x.startsWith("0x"))
    )
  );
  if (list.length === 0) return {};
  try {
    const res = await fetch(`/api/user-profiles?addresses=${encodeURIComponent(list.join(","))}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (data &&
          typeof data === "object" &&
          data !== null &&
          typeof (data as any).error?.message === "string" &&
          (data as any).error.message) ||
        (data &&
          typeof data === "object" &&
          data !== null &&
          typeof (data as any).message === "string" &&
          (data as any).message) ||
        `Request failed with status ${res.status}`;
      throw new Error(message);
    }
    const arr = Array.isArray((data as any)?.data?.profiles)
      ? ((data as any).data.profiles as any[])
      : [];
    const next: Record<string, string> = {};
    arr.forEach((p: any) => {
      if (p?.wallet_address && p?.username) {
        const k = String(p.wallet_address).toLowerCase();
        if (!next[k]) next[k] = String(p.username);
      }
    });
    return next;
  } catch (e) {
    console.error("fetchUsernamesByAddresses error", e);
    return {};
  }
}

export function getDisplayName(
  address: string,
  nameMap: Record<string, string>,
  formatAddress: (addr: string) => string
): string {
  const key = String(address || "").toLowerCase();
  if (key && nameMap[key]) return nameMap[key];
  return formatAddress(address);
}
