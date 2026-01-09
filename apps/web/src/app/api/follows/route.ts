import { handleFollowsDelete, handleFollowsGet, handleFollowsPost } from "./_lib/handlers";
import type { NextRequest } from "next/server";

// POST /api/follows  body: { predictionId: number, walletAddress: string }
export async function POST(req: NextRequest) {
  return handleFollowsPost(req);
}

// DELETE /api/follows  body: { predictionId: number, walletAddress: string }
export async function DELETE(req: NextRequest) {
  return handleFollowsDelete(req);
}

// GET /api/follows?predictionId=xx&walletAddress=xx
export async function GET(req: NextRequest) {
  return handleFollowsGet(req);
}
