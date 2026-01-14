import { createChaos } from "./chaosCore.js";
import { chaosConfig } from "./chaosConfig.js";
import { logger } from "../monitoring/logger.js";

/**
 * 初始化混沌工程
 * 为关键组件添加混沌注入
 */
export function initChaosEngineering() {
  // 初始化混沌工程
  const chaos = createChaos(chaosConfig);

  if (chaosConfig.enabled) {
    logger.info("🚀 Chaos Engineering initialized");
  } else {
    logger.debug("🔒 Chaos Engineering is disabled");
    return chaos;
  }

  // 注意：由于我们的混沌库设计不同，我们将不在初始化时直接注入混沌
  // 而是在需要的地方显式调用混沌注入
  // 这种方式更灵活，允许我们在不同场景下使用不同的混沌配置

  return chaos;
}

/**
 * 关闭混沌工程
 */
export function closeChaosEngineering(chaos: ReturnType<typeof createChaos>) {
  chaos.close();
  logger.info("🔒 Chaos Engineering shutdown");
}
