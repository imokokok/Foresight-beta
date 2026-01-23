import type { Express } from "express";
import { Contract, type Wallet } from "ethers";
import type { ClusterManager } from "../cluster/clusterManager.js";

export function registerRootRoutes(
  app: Express,
  deps: {
    isClusterActive: () => boolean;
    getClusterManager: () => ClusterManager;
    getCachedLeaderId: (cluster: ClusterManager) => Promise<string | null>;
    getLeaderProxyUrl: () => string;
    proxyToLeader: (
      leaderBaseUrl: string,
      req: any,
      res: any,
      pathLabel: string
    ) => Promise<boolean>;
    sendNotLeader: (
      res: any,
      payload: { leaderId: string | null; nodeId?: string; path: string }
    ) => void;
    getIdempotencyKey: (req: any, path: string) => string | null;
    getIdempotencyEntry: (key: string) => Promise<{ status: number; body: any } | null>;
    setIdempotencyEntry: (key: string, status: number, body: any) => Promise<void> | void;
    getBundlerWallet: () => Wallet | null;
    entryPointAbi: any;
  }
) {
  app.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.send("Foresight Relayer is running!");
  });

  app.post("/", async (req, res) => {
    try {
      if (deps.isClusterActive()) {
        const cluster = deps.getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await deps.getCachedLeaderId(cluster);
          const proxyUrl = deps.getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await deps.proxyToLeader(proxyUrl, req, res, "/");
            if (ok) return;
          }
          deps.sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/",
          });
          return;
        }
      }
      const idemKey = deps.getIdempotencyKey(req, "/");
      if (idemKey) {
        const hit = await deps.getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }
      const bundlerWallet = deps.getBundlerWallet();
      if (!bundlerWallet) {
        return res.status(501).json({
          jsonrpc: "2.0",
          id: req.body?.id,
          error: { code: -32601, message: "Bundler disabled" },
        });
      }
      const { userOp, entryPointAddress } = req.body;
      if (!userOp || !entryPointAddress) {
        return res.status(400).json({
          jsonrpc: "2.0",
          id: req.body.id,
          error: { code: -32602, message: "Invalid params" },
        });
      }
      const entryPoint = new Contract(entryPointAddress, deps.entryPointAbi, bundlerWallet);
      const tx = await entryPoint.handleOps([userOp], bundlerWallet.address);
      const receipt = await tx.wait();
      const responseBody = {
        jsonrpc: "2.0",
        id: req.body.id,
        result: receipt.hash,
      };
      res.json(responseBody);
      if (idemKey) void deps.setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (error: any) {
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: { code: -32602, message: "Internal error", data: error.message },
      });
    }
  });
}
