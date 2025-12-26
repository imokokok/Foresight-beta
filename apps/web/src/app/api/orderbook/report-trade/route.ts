import { NextRequest, NextResponse } from "next/server";

function getRelayerBaseUrl(): string | undefined {
  const raw = (process.env.RELAYER_URL || process.env.NEXT_PUBLIC_RELAYER_URL || "").trim();
  if (!raw) return undefined;
  if (!/^https?:\/\//i.test(raw)) return undefined;
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const body = (() => {
      try {
        return rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return {};
      }
    })();

    const relayerBase = getRelayerBaseUrl();
    if (!relayerBase) {
      return NextResponse.json(
        { success: false, message: "Relayer not configured" },
        { status: 500 }
      );
    }

    const url = new URL("/orderbook/report-trade", relayerBase);
    const relayerRes = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const relayerJson = await relayerRes.json().catch(() => null);
    return NextResponse.json(
      relayerJson ?? { success: false, message: "invalid relayer response" },
      {
        status: relayerRes.status,
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
