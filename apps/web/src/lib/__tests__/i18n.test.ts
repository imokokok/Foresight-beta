import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { t, getCurrentLocale, getTranslation, formatTranslation, useTranslations } from "../i18n";

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
      expect(["zh-CN", "en", "es"]).toContain(locale);
    });

    it("should return saved locale preference", () => {
      localStorage.setItem("preferred-language", "en");
      const locale = getCurrentLocale();
      expect(locale).toBe("en");
    });

    it("should fallback to a valid locale for invalid preference", () => {
      localStorage.setItem("preferred-language", "invalid");
      const locale = getCurrentLocale();
      expect(["zh-CN", "en", "es"]).toContain(locale);
    });
  });

  describe("getTranslation", () => {
    it("should return Chinese translations when specified", () => {
      const translations = getTranslation("zh-CN");
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("登录");
    });

    it("should return English translations when specified", () => {
      const translations = getTranslation("en");
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("Login");
    });

    it("should return Spanish translations when specified", () => {
      const translations = getTranslation("es");
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("Iniciar sesión");
    });

    it("should return Chinese for invalid locale", () => {
      const translations = getTranslation("invalid" as any);
      expect(translations.auth.login).toBe("登录");
    });
  });

  describe("t (translation function)", () => {
    it("should translate simple keys", () => {
      expect(t("common.welcome", "zh-CN")).toBe("欢迎");
      expect(t("common.welcome", "en")).toBe("Welcome");
    });

    it("should translate nested keys", () => {
      expect(t("auth.login", "zh-CN")).toBe("登录");
      expect(t("auth.login", "en")).toBe("Login");
    });

    it("should return key if translation not found", () => {
      expect(t("nonexistent.key")).toBe("nonexistent.key");
    });

    it("should translate navigation items", () => {
      expect(t("nav.trending", "zh-CN")).toBe("热门趋势");
      expect(t("nav.trending", "en")).toBe("Trending");

      expect(t("nav.forum", "zh-CN")).toBe("论坛");
      expect(t("nav.forum", "en")).toBe("Forum");
    });

    it("should translate wallet operations", () => {
      expect(t("wallet.copyAddress", "zh-CN")).toBe("复制地址");
      expect(t("wallet.copyAddress", "en")).toBe("Copy Address");

      expect(t("wallet.balance", "zh-CN")).toBe("余额");
      expect(t("wallet.balance", "en")).toBe("Balance");
    });

    it("should translate error messages", () => {
      expect(t("errors.somethingWrong", "zh-CN")).toBe("哎呀，出错了！");
      expect(t("errors.somethingWrong", "en")).toBe("Oops! Something went wrong!");
    });
  });

  describe("formatTranslation", () => {
    it("should replace placeholders with provided params", () => {
      const template = "你好，{name}，你有 {count} 条消息";
      const result = formatTranslation(template, { name: "Alice", count: 3 });
      expect(result).toBe("你好，Alice，你有 3 条消息");
    });

    it("should keep placeholder when param is missing", () => {
      const template = "Hello {name} and {other}";
      const result = formatTranslation(template, { name: "Bob" });
      expect(result).toBe("Hello Bob and {other}");
    });

    it("should return template when params are not provided", () => {
      const template = "Static text";
      const result = formatTranslation(template);
      expect(result).toBe("Static text");
    });
  });

  describe("useTranslations hook", () => {
    it("should use locale from localStorage", async () => {
      localStorage.setItem("preferred-language", "en");
      const { result } = renderHook(() => useTranslations());

      await waitFor(() => {
        expect(result.current("auth.login")).toBe("Login");
      });
    });

    it("should support namespace", async () => {
      localStorage.setItem("preferred-language", "zh-CN");
      const { result } = renderHook(() => useTranslations("auth"));

      await waitFor(() => {
        expect(result.current("login")).toBe("登录");
      });
    });

    it("should respond to storage events for language changes", async () => {
      localStorage.setItem("preferred-language", "zh-CN");
      const { result } = renderHook(() => useTranslations());

      await waitFor(() => {
        expect(result.current("auth.login")).toBe("登录");
      });

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "preferred-language",
            newValue: "en",
          })
        );
      });

      await waitFor(() => {
        expect(result.current("auth.login")).toBe("Login");
      });
    });

    it("should respond to languagechange custom events", async () => {
      localStorage.setItem("preferred-language", "en");
      const { result } = renderHook(() => useTranslations());

      await waitFor(() => {
        expect(result.current("auth.login")).toBe("Login");
      });

      act(() => {
        window.dispatchEvent(
          new CustomEvent("languagechange", {
            detail: { locale: "es" },
          })
        );
      });

      await waitFor(() => {
        expect(result.current("auth.login")).toBe("Iniciar sesión");
      });
    });
  });
});
