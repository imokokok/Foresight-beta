/**
 * Logger 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { log, measurePerformance } from "../logger";

describe("Logger", () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("debug", () => {
    it("should log debug messages in development", () => {
      log.debug("Test debug message");
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("[DEBUG]"));
    });
  });

  describe("info", () => {
    it("should log info messages", () => {
      log.info("Test info message");
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("warn", () => {
    it("should log warning messages", () => {
      log.warn("Test warning");
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[WARN]"));
    });
  });

  describe("error", () => {
    it("should log error messages", () => {
      const error = new Error("Test error");
      log.error("Test error message", error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("api", () => {
    it("should log API requests", () => {
      log.api("GET", "/api/test", 200, 150);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("[API]"));
    });
  });

  describe("perf", () => {
    it("should log performance metrics", () => {
      log.perf("Test operation", 150);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("[PERF]"));
    });
  });
});

describe("measurePerformance", () => {
  it("should measure sync function performance", () => {
    const result = measurePerformance("test-sync", () => {
      return 42;
    });

    expect(result).toBe(42);
  });

  it("should measure async function performance", async () => {
    const result = await measurePerformance("test-async", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "done";
    });

    expect(result).toBe("done");
  });
});
