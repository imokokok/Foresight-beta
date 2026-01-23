import express from "express";

interface AARoutesOptions {
  clusterIsActive: boolean;
}

export default function createAARoutes({ clusterIsActive }: AARoutesOptions) {
  const router = express.Router();

  // 简化实现，仅返回基本响应
  router.post("/aa/userop/draft", async (req, res) => {
    res.json({ success: true, message: "AA userop draft endpoint" });
  });

  router.post("/aa/userop/simulate", async (req, res) => {
    res.json({ success: true, message: "AA userop simulate endpoint" });
  });

  router.post("/aa/userop/submit", async (req, res) => {
    res.json({ success: true, message: "AA userop submit endpoint" });
  });

  router.post("/aa/custodial/sign", async (req, res) => {
    res.json({ success: true, message: "AA custodial sign endpoint" });
  });

  return router;
}
