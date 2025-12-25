import { handleFollowsDelete, handleFollowsGet, handleFollowsPost } from "./_lib/handlers";

// POST /api/follows  body: { predictionId: number, walletAddress: string }
export async function POST(req: Request) {
  return handleFollowsPost(req);
}

// DELETE /api/follows  body: { predictionId: number, walletAddress: string }
export async function DELETE(req: Request) {
  return handleFollowsDelete(req);
}

// GET /api/follows?predictionId=xx&walletAddress=xx
export async function GET(req: Request) {
  return handleFollowsGet(req);
}
