import http from "node:http";
import { describe, it, expect } from "vitest";
import { app } from "./index.js";

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

describe("Relayer basic routes", () => {
  it("should expose health endpoint on root path", async () => {
    const res = await requestOnce("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Foresight Relayer is running!");
  });
});
