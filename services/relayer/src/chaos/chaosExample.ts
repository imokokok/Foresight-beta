/**
 * 混沌工程使用示例
 * 展示如何在实际代码中使用混沌注入
 */

import { createChaos } from "./chaosCore.js";
import { DatabasePool } from "../database/connectionPool.js";
import { logger } from "../monitoring/logger.js";

/**
 * 示例：在数据库连接池中使用混沌注入
 */
export async function exampleChaosInDatabase() {
  // 初始化混沌实例
  const chaos = createChaos({
    enabled: process.env.CHAOS_ENABLED === "true",
    probability: 0.5,
    scenarios: {
      latency: {
        enabled: true,
        minDelay: 100,
        maxDelay: 1000,
      },
      error: {
        enabled: true,
        errorTypes: [
          { type: "DBError", message: "Database connection error", probability: 0.3 },
          { type: "QueryTimeout", message: "Query timed out", probability: 0.7 },
        ],
      },
    },
  });

  // 初始化数据库连接池
  const pool = new DatabasePool({
    primary: {
      url: process.env.SUPABASE_URL || "",
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    },
  });

  try {
    // 示例：使用混沌注入执行查询
    const result = await chaos.inject(async () => {
      // 这里可以添加实际的数据库查询逻辑
      logger.info("Executing database query with chaos injection");
      // 模拟数据库查询
      return { success: true, data: [{ id: 1, name: "test" }] };
    });

    logger.info("Query result:", result);
  } catch (error) {
    logger.error("Query failed with chaos injection:", { error: String(error) });
    // 这里可以添加错误处理逻辑
  } finally {
    // 关闭混沌实例
    chaos.close();
  }
}

/**
 * 示例：为对象方法添加混沌注入
 */
export function exampleChaosToMethod() {
  // 初始化混沌实例
  const chaos = createChaos({
    enabled: process.env.CHAOS_ENABLED === "true",
    probability: 0.3,
    scenarios: {
      latency: {
        enabled: true,
        minDelay: 50,
        maxDelay: 500,
      },
      cpuSpike: {
        enabled: true,
        duration: 500,
        intensity: 0.8,
      },
    },
  });

  // 示例对象
  const myService = {
    doSomething: async () => {
      logger.info("Doing something important");
      return "result";
    },
    doAnotherThing: async () => {
      logger.info("Doing another thing");
      return "another result";
    },
  };

  // 为方法添加混沌注入
  chaos.addChaosToMethod(myService, "doSomething", ["latency", "cpuSpike"]);
  chaos.addChaosToMethod(myService, "doAnotherThing", ["latency"]);

  // 使用带混沌注入的方法
  myService
    .doSomething()
    .then((result) => {
      logger.info("doSomething result:", { result });
    })
    .catch((error) => {
      logger.error("doSomething failed:", { error: String(error) });
    });

  myService
    .doAnotherThing()
    .then((result) => {
      logger.info("doAnotherThing result:", { result });
    })
    .catch((error) => {
      logger.error("doAnotherThing failed:", { error: String(error) });
    });

  // 注意：在实际应用中，需要在适当的时候关闭混沌实例
  // chaos.close();
}
