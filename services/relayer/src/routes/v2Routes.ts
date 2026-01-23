import express from "express";
import { MatchingEngine } from "../matching/index.js";

interface V2RoutesOptions {
  matchingEngine: MatchingEngine;
  clusterIsActive: boolean;
}

export default function createV2Routes({ matchingEngine, clusterIsActive }: V2RoutesOptions) {
  const router = express.Router();

  // Simple route that returns success
  router.get("/api/orderbook/types", async (req, res) => {
    res.json({
      success: true,
      data: [
        { id: "binary", name: "Binary", description: "Two outcomes: yes/no" },
        { id: "multi", name: "Multi", description: "Multiple outcomes" },
      ],
    });
  });

  // Simple depth route that returns empty depth
  router.get("/api/orderbook/depth/:marketKey/:outcomeIndex", async (req, res) => {
    try {
      const { marketKey, outcomeIndex } = req.params;
      const levels = parseInt((req.query.levels as string) || "10");

      res.json({
        success: true,
        data: {
          bids: [],
          asks: [],
          marketKey,
          outcomeIndex,
          levels,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: String(error),
      });
    }
  });

  return router;
}
