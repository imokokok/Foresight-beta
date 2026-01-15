/**
 * 日志系统单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 需要在导入 logger 之前设置环境变量
process.env.LOG_FORMAT = "json";
process.env.LOG_LEVEL = "debug";

// 动态导入以确保环境变量生效
const { logger, matchingLogger, settlementLogger } = await import("./logger.js");

describe("Logger", () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Log Levels", () => {
    it("should log debug messages", () => {
      logger.debug("Debug message", { key: "value" });
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("should log info messages", () => {
      logger.info("Info message");
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("should log warn messages", () => {
      logger.warn("Warning message");
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it("should log error messages", () => {
      logger.error("Error message");
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it("should log error with Error object", () => {
      const error = new Error("Test error");
      logger.error("Error occurred", { context: "test" }, error);
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe("JSON Format", () => {
    it("should output valid JSON", () => {
      logger.info("Test message", { key: "value" });

      const output = consoleSpy.log.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should include required fields", () => {
      logger.info("Test message", { customKey: "customValue" });

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output).toHaveProperty("timestamp");
      expect(output).toHaveProperty("level", "info");
      expect(output).toHaveProperty("message", "Test message");
      expect(output).toHaveProperty("service");
      expect(output.context).toHaveProperty("customKey", "customValue");
    });

    it("should format error correctly", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.ts:1:1";

      logger.error("Error occurred", {}, error);

      const output = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(output.error).toHaveProperty("name", "Error");
      expect(output.error).toHaveProperty("message", "Test error");
      expect(output.error).toHaveProperty("stack");
    });
  });

  describe("Child Logger", () => {
    it("should create child logger with context", () => {
      const childLogger = logger.child({ requestId: "123" });
      childLogger.info("Child message");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.context).toHaveProperty("requestId", "123");
    });

    it("should merge parent and child context", () => {
      const childLogger = logger.child({ parentKey: "parent" });
      const grandchildLogger = childLogger.child({ childKey: "child" });

      grandchildLogger.info("Grandchild message");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.context).toHaveProperty("parentKey", "parent");
      expect(output.context).toHaveProperty("childKey", "child");
    });
  });

  describe("Specialized Loggers", () => {
    it("should have matching-engine logger", () => {
      matchingLogger.info("Matching engine message");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.service).toBe("matching-engine");
    });

    it("should have settlement logger", () => {
      settlementLogger.info("Settlement message");

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(output.service).toBe("settlement");
    });
  });
});
