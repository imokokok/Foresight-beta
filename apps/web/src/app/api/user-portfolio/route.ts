import { handleUserPortfolioGet } from "./_lib/handler";

export async function GET(req: Request) {
  return handleUserPortfolioGet(req);
}
