import http from "node:http";
import { describe, it, expect } from "vitest";
import { app } from "./index.js";
import express from "express";
import { proxyToLeader, getLeaderProxyState } from "./cluster/leaderProxy.js";
import { createWriteProxyReadinessChecker } from "./monitoring/health.js";

function requestOnce(pathname: string) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(() => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("invalid server address"));
        return;
      }
      const req = http.request({ port: address.port, path: pathname, method: "GET" }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode || 0;
          server.close();
          resolve({ status, text });
        });
      });
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

function startServer(handler: any) {
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(() => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("invalid server address"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

describe("Relayer basic routes", () => {
  it("should expose health endpoint on root path", async () => {
    const res = await requestOnce("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Foresight Relayer is running!");
  });
});

describe("Readiness checks", () => {
  it("should mark follower without proxy URL as not ready", async () => {
    const checker = createWriteProxyReadinessChecker({
      isClusterActive: () => true,
      isLeader: () => false,
      getProxyUrl: () => "",
    });
    const result = await checker();
    expect(result.ready).toBe(false);
    expect(result.message).toContain("Follower without proxy URL");
  });

  it("should mark follower with proxy URL as ready", async () => {
    const checker = createWriteProxyReadinessChecker({
      isClusterActive: () => true,
      isLeader: () => false,
      getProxyUrl: () => "http://leader:3000",
    });
    const result = await checker();
    expect(result.ready).toBe(true);
  });

  it("should mark leader as ready", async () => {
    const checker = createWriteProxyReadinessChecker({
      isClusterActive: () => true,
      isLeader: () => true,
      getProxyUrl: () => "",
    });
    const result = await checker();
    expect(result.ready).toBe(true);
    expect(result.message).toContain("Leader");
  });
});

describe("Follower → leader proxy", () => {
  it("should proxy request and return upstream response", async () => {
    const leaderApp = express();
    leaderApp.use(express.json());
    leaderApp.post("/v2/orders", (req, res) => {
      res.status(201).json({
        ok: true,
        proxyHeader: req.header("x-foresight-proxy") || null,
        requestId: req.header("x-request-id") || null,
        body: req.body,
      });
    });
    const leader = await startServer(leaderApp);

    const followerApp = express();
    followerApp.use(express.json());
    followerApp.post("/v2/orders", async (req, res) => {
      const ok = await proxyToLeader(leader.baseUrl, req as any, res as any, "/v2/orders");
      if (!ok) res.status(503).json({ ok: false });
    });
    const follower = await startServer(followerApp);

    try {
      const response = await fetch(`${follower.baseUrl}/v2/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "test-req-1",
        },
        body: JSON.stringify({ hello: "world" }),
      });
      expect(response.status).toBe(201);
      expect(response.headers.get("x-foresight-proxied")).toBe("1");
      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(json.proxyHeader).toBe("1");
      expect(json.requestId).toBe("test-req-1");
      expect(json.body).toEqual({ hello: "world" });
    } finally {
      await follower.close();
      await leader.close();
    }
  });

  it("should prevent proxy loops when header is present", async () => {
    const leaderApp = express();
    leaderApp.use(express.json());
    leaderApp.post("/v2/orders", (_req, res) => res.status(201).json({ ok: true }));
    const leader = await startServer(leaderApp);

    const followerApp = express();
    followerApp.use(express.json());
    followerApp.post("/v2/orders", async (req, res) => {
      const ok = await proxyToLeader(leader.baseUrl, req as any, res as any, "/v2/orders");
      if (!ok) res.status(503).json({ ok: false });
    });
    const follower = await startServer(followerApp);

    try {
      const response = await fetch(`${follower.baseUrl}/v2/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-foresight-proxy": "1",
        },
        body: JSON.stringify({ hello: "world" }),
      });
      expect(response.status).toBe(503);
    } finally {
      await follower.close();
      await leader.close();
    }
  });

  it("should open circuit breaker after failures", async () => {
    const prevFailures = process.env.RELAYER_LEADER_PROXY_CIRCUIT_FAILURES;
    const prevOpenMs = process.env.RELAYER_LEADER_PROXY_CIRCUIT_OPEN_MS;
    process.env.RELAYER_LEADER_PROXY_CIRCUIT_FAILURES = "1";
    process.env.RELAYER_LEADER_PROXY_CIRCUIT_OPEN_MS = "5000";

    const followerApp = express();
    followerApp.use(express.json());
    const pathLabel = `/__test__/circuit-${Date.now()}-${Math.random()}`;
    followerApp.post("/v2/orders", async (req, res) => {
      const ok = await proxyToLeader("http://127.0.0.1:1", req as any, res as any, pathLabel);
      if (!ok) res.status(503).json({ ok: false });
    });
    const follower = await startServer(followerApp);

    try {
      await fetch(`${follower.baseUrl}/v2/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hello: "world" }),
      });

      const states = getLeaderProxyState();
      const state = states.find((s) => s.path === pathLabel);
      expect(state).toBeTruthy();
      expect(state!.open).toBe(true);
    } finally {
      await follower.close();
      if (typeof prevFailures === "string")
        process.env.RELAYER_LEADER_PROXY_CIRCUIT_FAILURES = prevFailures;
      else delete process.env.RELAYER_LEADER_PROXY_CIRCUIT_FAILURES;
      if (typeof prevOpenMs === "string")
        process.env.RELAYER_LEADER_PROXY_CIRCUIT_OPEN_MS = prevOpenMs;
      else delete process.env.RELAYER_LEADER_PROXY_CIRCUIT_OPEN_MS;
    }
  });
});
