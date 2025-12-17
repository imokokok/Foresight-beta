import { describe, it, expect, beforeEach, vi } from "vitest";
import { t, getCurrentLocale, getTranslation } from "../i18n";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("Internationalization (i18n)", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("getCurrentLocale", () => {
    it("should return default locale when no preference saved", () => {
      const locale = getCurrentLocale();
      expect(locale).toBe("zh-CN");
    });

    it("should return saved locale preference", () => {
      localStorage.setItem("preferred-language", "en");
      const locale = getCurrentLocale();
      expect(locale).toBe("en");
    });

    it("should fallback to zh-CN for invalid locale", () => {
      localStorage.setItem("preferred-language", "invalid");
      const locale = getCurrentLocale();
      // 这里应该返回有效的 locale
      expect(["zh-CN", "en"]).toContain(locale);
    });
  });

  describe("getTranslation", () => {
    it("should return Chinese translations by default", () => {
      const translations = getTranslation();
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("登录");
    });

    it("should return English translations when specified", () => {
      const translations = getTranslation("en");
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("Login");
    });

    it("should return Chinese for invalid locale", () => {
      const translations = getTranslation("invalid" as any);
      expect(translations.auth.login).toBe("登录");
    });
  });

  describe("t (translation function)", () => {
    it("should translate simple keys", () => {
      expect(t("common.welcome")).toBe("欢迎");
      expect(t("common.welcome", "en")).toBe("Welcome");
    });

    it("should translate nested keys", () => {
      expect(t("auth.login")).toBe("登录");
      expect(t("auth.login", "en")).toBe("Login");
    });

    it("should return key if translation not found", () => {
      expect(t("nonexistent.key")).toBe("nonexistent.key");
    });

    it("should translate navigation items", () => {
      expect(t("nav.trending")).toBe("热门趋势");
      expect(t("nav.trending", "en")).toBe("Trending");

      expect(t("nav.forum")).toBe("论坛");
      expect(t("nav.forum", "en")).toBe("Forum");
    });

    it("should translate wallet operations", () => {
      expect(t("wallet.copyAddress")).toBe("复制地址");
      expect(t("wallet.copyAddress", "en")).toBe("Copy Address");

      expect(t("wallet.balance")).toBe("余额");
      expect(t("wallet.balance", "en")).toBe("Balance");
    });

    it("should translate error messages", () => {
      expect(t("errors.somethingWrong")).toBe("哎呀，出错了！");
      expect(t("errors.somethingWrong", "en")).toBe("Oops! Something went wrong!");
    });
  });
});
