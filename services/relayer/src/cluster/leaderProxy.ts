import type { Request, Response } from "express";
import type { ClusterManager } from "./clusterManager.js";
import { readIntEnv } from "../utils/envNumbers.js";
import {
  clusterFollowerProxiedTotal,
  clusterFollowerProxyCircuitOpenTotal,
  clusterFollowerProxyErrorsTotal,
  clusterFollowerProxyLatency,
  clusterFollowerProxyUpstreamResponsesTotal,
  clusterFollowerProxyCircuitOpen,
} from "../monitoring/metrics.js";

type CircuitState = {
  failures: number;
  openUntilMs: number;
};

const circuits = new Map<string, CircuitState>();

function nowMs(): number {
  return Date.now();
}

function getCircuit(path: string): CircuitState {
  const existing = circuits.get(path);
  if (existing) return existing;
  const created: CircuitState = { failures: 0, openUntilMs: 0 };
  circuits.set(path, created);
  return created;
}

function getCircuitConfig() {
  const failureThreshold = Math.max(
    1,
    Number(process.env.RELAYER_LEADER_PROXY_CIRCUIT_FAILURES || "3")
  );
  const openMs = Math.max(1000, Number(process.env.RELAYER_LEADER_PROXY_CIRCUIT_OPEN_MS || "5000"));
  return { failureThreshold, openMs };
}

function setCircuitOpen(path: string, openUntilMs: number): void {
  clusterFollowerProxyCircuitOpen.set({ path }, 1);
  if (openUntilMs > 0) return;
  clusterFollowerProxyCircuitOpen.set({ path }, 0);
}

function categorizeStatusCode(code: number): string {
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500 && code < 600) return "5xx";
  return "other";
}

export function getLeaderProxyState(): Array<{
  path: string;
  failures: number;
  openUntilMs: number;
  open: boolean;
}> {
  const t = nowMs();
  return Array.from(circuits.entries()).map(([path, state]) => ({
    path,
    failures: state.failures,
    openUntilMs: state.openUntilMs,
    open: state.openUntilMs > t,
  }));
}

export function getLeaderProxyUrl(): string {
  return String(
    process.env.RELAYER_LEADER_PROXY_URL || process.env.RELAYER_LEADER_URL || ""
  ).trim();
}

type LeaderIdCache = {
  leaderId: string | null;
  expiresAtMs: number;
  inFlight: Promise<string | null> | null;
};

const leaderIdCache: LeaderIdCache = {
  leaderId: null,
  expiresAtMs: 0,
  inFlight: null,
};

export async function getCachedLeaderId(cluster: ClusterManager): Promise<string | null> {
  const known = cluster.getKnownLeaderId();
  if (known) return known;
  const now = Date.now();
  const ttlMs = Math.max(200, readIntEnv("RELAYER_LEADER_ID_CACHE_MS", 1000));
  if (leaderIdCache.leaderId && now < leaderIdCache.expiresAtMs) {
    return leaderIdCache.leaderId;
  }
  if (leaderIdCache.inFlight) return leaderIdCache.inFlight;
  leaderIdCache.inFlight = cluster
    .getLeaderId()
    .catch(() => null)
    .then((id) => {
      leaderIdCache.leaderId = id;
      leaderIdCache.expiresAtMs = Date.now() + ttlMs;
      leaderIdCache.inFlight = null;
      return id;
    });
  return leaderIdCache.inFlight;
}

export function sendNotLeader(
  res: Response,
  payload: { leaderId: string | null; nodeId?: string; path: string }
) {
  const proxyUrl = getLeaderProxyUrl();
  res.status(503).json({
    success: false,
    message: "Not leader",
    leaderId: payload.leaderId,
    nodeId: payload.nodeId || null,
    path: payload.path,
    retryable: true,
    suggestedWaitMs: 1000,
    proxyUrlConfigured: !!proxyUrl,
  });
}

export async function proxyToLeader(
  leaderBaseUrl: string,
  req: Request,
  res: Response,
  pathLabel: string
): Promise<boolean> {
  const startTime = nowMs();
  const pathForMetrics = pathLabel || req.path || "/";

  const circuit = getCircuit(pathForMetrics);
  const t = nowMs();
  if (circuit.openUntilMs > t) {
    clusterFollowerProxyCircuitOpenTotal.inc({ path: pathForMetrics });
    clusterFollowerProxiedTotal.inc({ path: pathForMetrics, status: "error" });
    clusterFollowerProxyErrorsTotal.inc({ path: pathForMetrics, error_type: "circuit_open" });
    clusterFollowerProxyLatency.observe({ path: pathForMetrics, status: "error" }, t - startTime);
    return false;
  }
  if (circuit.openUntilMs > 0 && circuit.openUntilMs <= t) {
    circuit.openUntilMs = 0;
    setCircuitOpen(pathForMetrics, 0);
  }

  const base = leaderBaseUrl.trim();
  if (!base) {
    clusterFollowerProxiedTotal.inc({ path: pathForMetrics, status: "error" });
    clusterFollowerProxyErrorsTotal.inc({ path: pathForMetrics, error_type: "missing_base_url" });
    clusterFollowerProxyLatency.observe(
      { path: pathForMetrics, status: "error" },
      nowMs() - startTime
    );
    return false;
  }
  if (req.headers["x-foresight-proxy"]) {
    clusterFollowerProxiedTotal.inc({ path: pathForMetrics, status: "error" });
    clusterFollowerProxyErrorsTotal.inc({ path: pathForMetrics, error_type: "loop_prevented" });
    clusterFollowerProxyLatency.observe(
      { path: pathForMetrics, status: "error" },
      nowMs() - startTime
    );
    return false;
  }
  if (typeof (globalThis as any).fetch !== "function") {
    clusterFollowerProxiedTotal.inc({ path: pathForMetrics, status: "error" });
    clusterFollowerProxyErrorsTotal.inc({ path: pathForMetrics, error_type: "fetch_unavailable" });
    clusterFollowerProxyLatency.observe(
      { path: pathForMetrics, status: "error" },
      nowMs() - startTime
    );
    return false;
  }

  let url: URL;
  try {
    url = new URL(req.originalUrl || req.url, base);
  } catch {
    clusterFollowerProxiedTotal.inc({ path: pathForMetrics, status: "error" });
    clusterFollowerProxyErrorsTotal.inc({ path: pathForMetrics, error_type: "invalid_url" });
    clusterFollowerProxyLatency.observe(
      { path: pathForMetrics, status: "error" },
      nowMs() - startTime
    );
    return false;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.RELAYER_LEADER_PROXY_TIMEOUT_MS || "5000"));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (!key) continue;
      const lower = key.toLowerCase();
      if (
        lower === "host" ||
        lower === "connection" ||
        lower === "keep-alive" ||
        lower === "proxy-authenticate" ||
        lower === "proxy-authorization" ||
        lower === "te" ||
        lower === "trailer" ||
        lower === "transfer-encoding" ||
        lower === "upgrade" ||
        lower === "content-length" ||
        lower === "accept-encoding"
      ) {
        continue;
      }
      if (typeof value === "string") headers.set(lower, value);
      else if (Array.isArray(value)) headers.set(lower, value.join(","));
    }

    const requestId = (req as any).requestId;
    if (typeof requestId === "string" && requestId.length > 0 && !headers.has("x-request-id")) {
      headers.set("x-request-id", requestId);
    }

    const forwardedFor = headers.get("x-forwarded-for");
    const ip = (req.ip || "").toString();
    if (ip) headers.set("x-forwarded-for", forwardedFor ? `${forwardedFor}, ${ip}` : ip);
    if (!headers.has("x-forwarded-proto")) headers.set("x-forwarded-proto", req.protocol || "http");
    if (!headers.has("x-forwarded-host") && req.headers.host) {
      headers.set("x-forwarded-host", String(req.headers.host));
    }

    headers.set("x-foresight-proxy", "1");

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    let body: any = undefined;
    if (hasBody) {
      if (req.body === null || typeof req.body === "undefined") {
        body = undefined;
      } else if (typeof req.body === "string" || req.body instanceof Buffer) {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
        if (!headers.has("content-type")) headers.set("content-type", "application/json");
      }
    }

    const upstream = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("x-foresight-proxied", "1");

    for (const [key, value] of upstream.headers.entries()) {
      const lower = key.toLowerCase();
      if (
        lower === "connection" ||
        lower === "keep-alive" ||
        lower === "proxy-authenticate" ||
        lower === "proxy-authorization" ||
        lower === "te" ||
        lower === "trailer" ||
        lower === "transfer-encoding" ||
        lower === "upgrade" ||
        lower === "content-length" ||
        lower === "content-encoding"
      ) {
        continue;
      }
      res.setHeader(key, value);
    }

    res.status(upstream.status).send(responseBody);

    const statusCode = upstream.status;
    clusterFollowerProxyUpstreamResponsesTotal.inc({
      path: pathForMetrics,
      status_code: String(statusCode),
      status_class: categorizeStatusCode(statusCode),
    });

    clusterFollowerProxiedTotal.inc({ path: pathForMetrics, status: "success" });
    clusterFollowerProxyLatency.observe(
      { path: pathForMetrics, status: "success" },
      nowMs() - startTime
    );

    circuit.failures = 0;
    return true;
  } catch (err: any) {
    const name = typeof err?.name === "string" ? err.name : "";
    const errorType = name === "AbortError" ? "timeout" : "network_error";

    clusterFollowerProxiedTotal.inc({ path: pathForMetrics, status: "error" });
    clusterFollowerProxyErrorsTotal.inc({ path: pathForMetrics, error_type: errorType });
    clusterFollowerProxyLatency.observe(
      { path: pathForMetrics, status: "error" },
      nowMs() - startTime
    );

    const { failureThreshold, openMs } = getCircuitConfig();
    circuit.failures += 1;
    if (circuit.failures >= failureThreshold) {
      circuit.openUntilMs = nowMs() + openMs;
      setCircuitOpen(pathForMetrics, circuit.openUntilMs);
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
