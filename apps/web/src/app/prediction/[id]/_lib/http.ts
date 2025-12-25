export async function safeJson<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    if (text && text.trim().startsWith("<!DOCTYPE html")) {
      throw new Error("Server returned an HTML error page");
    }
    throw new Error("Unexpected response format");
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("Invalid JSON response");
  }
}
