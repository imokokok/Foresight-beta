import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

/**
 * XSS 防护工具
 * 清理用户输入，移除潜在的恶意脚本
 */

// 创建 DOM 环境（服务端）
const window = new JSDOM("").window;
const purify = DOMPurify(window as unknown as Window);

/**
 * 清理 HTML 字符串，防止 XSS 攻击
 */
export function sanitizeHtml(dirty: string): string {
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "code", "pre"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * 清理纯文本，移除所有 HTML 标签
 */
export function sanitizeText(dirty: string): string {
  return purify.sanitize(dirty, { ALLOWED_TAGS: [] });
}

/**
 * 验证并清理用户输入
 */
export function validateAndSanitize(
  input: unknown,
  options: {
    type: "text" | "html" | "number" | "boolean" | "email" | "url";
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  }
): { valid: boolean; value?: any; error?: string } {
  const { type, required = false, minLength, maxLength, pattern } = options;

  // 检查必填
  if (required && (input === null || input === undefined || input === "")) {
    return { valid: false, error: "此字段为必填项" };
  }

  // 如果非必填且为空，直接通过
  if (!required && (input === null || input === undefined || input === "")) {
    return { valid: true, value: input };
  }

  // 类型验证
  switch (type) {
    case "text":
      if (typeof input !== "string") {
        return { valid: false, error: "输入必须为文本" };
      }
      const cleanText = sanitizeText(input);
      if (minLength && cleanText.length < minLength) {
        return { valid: false, error: `文本长度不能少于 ${minLength} 个字符` };
      }
      if (maxLength && cleanText.length > maxLength) {
        return { valid: false, error: `文本长度不能超过 ${maxLength} 个字符` };
      }
      if (pattern && !pattern.test(cleanText)) {
        return { valid: false, error: "输入格式不正确" };
      }
      return { valid: true, value: cleanText };

    case "html":
      if (typeof input !== "string") {
        return { valid: false, error: "输入必须为 HTML 文本" };
      }
      const cleanHtml = sanitizeHtml(input);
      if (maxLength && cleanHtml.length > maxLength) {
        return { valid: false, error: `内容长度不能超过 ${maxLength} 个字符` };
      }
      return { valid: true, value: cleanHtml };

    case "number":
      const num = Number(input);
      if (isNaN(num)) {
        return { valid: false, error: "输入必须为数字" };
      }
      return { valid: true, value: num };

    case "boolean":
      return { valid: true, value: Boolean(input) };

    case "email":
      if (typeof input !== "string") {
        return { valid: false, error: "邮箱格式不正确" };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input)) {
        return { valid: false, error: "邮箱格式不正确" };
      }
      return { valid: true, value: input.toLowerCase().trim() };

    case "url":
      if (typeof input !== "string") {
        return { valid: false, error: "URL 格式不正确" };
      }
      try {
        const url = new URL(input);
        // 只允许 http 和 https 协议
        if (!["http:", "https:"].includes(url.protocol)) {
          return { valid: false, error: "URL 必须使用 HTTP 或 HTTPS 协议" };
        }
        return { valid: true, value: input };
      } catch {
        return { valid: false, error: "URL 格式不正确" };
      }

    default:
      return { valid: false, error: "不支持的验证类型" };
  }
}

/**
 * 验证以太坊地址格式
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 验证交易哈希格式
 */
export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * 防止 SQL 注入（虽然使用了 Supabase，但仍需谨慎）
 * 清理可能包含 SQL 特殊字符的输入
 */
export function escapeSqlLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/**
 * 生成安全的随机字符串（用于 token、nonce 等）
 */
export function generateSecureToken(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);

  // 使用 crypto API 生成安全随机数
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    // Fallback（不够安全，仅用于开发环境）
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return result;
}
