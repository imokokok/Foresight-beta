import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type * as I18nModule from "../i18n";

let i18n: typeof I18nModule;

beforeAll(async () => {
  i18n = await vi.importActual<typeof I18nModule>("../i18n");
});

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
    try {
      document.cookie = "preferred-language=; Max-Age=0; path=/";
    } catch {}
  });

  describe("getCurrentLocale", () => {
    it("should return default locale when no preference saved", () => {
      const locale = i18n.getCurrentLocale();
      expect(locale).toBe("en");
    });

    it("should return saved locale preference", () => {
      document.cookie = "preferred-language=zh-CN; path=/";
      const locale = i18n.getCurrentLocale();
      expect(locale).toBe("zh-CN");
    });

    it("should fallback to a valid locale for invalid preference", () => {
      document.cookie = "preferred-language=invalid; path=/";
      const locale = i18n.getCurrentLocale();
      expect(locale).toBe("en");
    });
  });

  describe("getTranslation", () => {
    it("should return Chinese translations when specified", () => {
      const translations = i18n.getTranslation("zh-CN");
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("登录");
    });

    it("should return English translations when specified", () => {
      const translations = i18n.getTranslation("en");
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("Login");
    });

    it("should return Spanish translations when specified", () => {
      const translations = i18n.getTranslation("es");
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("Iniciar sesión");
    });

    it("should return French translations when specified", () => {
      const translations = i18n.getTranslation("fr");
      expect(translations.common.appName).toBe("Foresight");
      expect(translations.auth.login).toBe("Se connecter");
    });

    it("should return Chinese for invalid locale", () => {
      const translations = i18n.getTranslation("invalid" as any);
      expect(translations.auth.login).toBe("Login");
    });
  });

  describe("t (translation function)", () => {
    it("should translate simple keys", () => {
      expect(i18n.t("common.welcome", "zh-CN")).toBe("欢迎");
      expect(i18n.t("common.welcome", "en")).toBe("Welcome");
    });

    it("should translate nested keys", () => {
      expect(i18n.t("auth.login", "zh-CN")).toBe("登录");
      expect(i18n.t("auth.login", "en")).toBe("Login");
    });

    it("should return key if translation not found", () => {
      expect(i18n.t("nonexistent.key")).toBe("nonexistent.key");
    });

    it("should translate navigation items", () => {
      expect(i18n.t("nav.trending", "zh-CN")).toBe("热门趋势");
      expect(i18n.t("nav.trending", "en")).toBe("Trending");

      expect(i18n.t("nav.forum", "zh-CN")).toBe("论坛");
      expect(i18n.t("nav.forum", "en")).toBe("Forum");
    });

    it("should translate wallet operations", () => {
      expect(i18n.t("wallet.copyAddress", "zh-CN")).toBe("复制地址");
      expect(i18n.t("wallet.copyAddress", "en")).toBe("Copy Address");

      expect(i18n.t("wallet.balance", "zh-CN")).toBe("余额");
      expect(i18n.t("wallet.balance", "en")).toBe("Balance");
    });

    it("should translate error messages", () => {
      expect(i18n.t("errors.somethingWrong", "zh-CN")).toBe("哎呀，出错了！");
      expect(i18n.t("errors.somethingWrong", "en")).toBe("Oops! Something went wrong!");
    });
  });

  describe("formatTranslation", () => {
    it("should replace placeholders with provided params", () => {
      const template = "你好，{name}，你有 {count} 条消息";
      const result = i18n.formatTranslation(template, { name: "Alice", count: 3 });
      expect(result).toBe("你好，Alice，你有 3 条消息");
    });

    it("should keep placeholder when param is missing", () => {
      const template = "Hello {name} and {other}";
      const result = i18n.formatTranslation(template, { name: "Bob" });
      expect(result).toBe("Hello Bob and {other}");
    });

    it("should return template when params are not provided", () => {
      const template = "Static text";
      const result = i18n.formatTranslation(template);
      expect(result).toBe("Static text");
    });
  });

  describe("useTranslations hook", () => {
    it("should use locale from localStorage", async () => {
      localStorage.setItem("preferred-language", "en");
      const { result } = renderHook(() => i18n.useTranslations());

      await waitFor(() => {
        expect(result.current("auth.login")).toBe("Login");
      });
    });

    it("should support namespace", async () => {
      localStorage.setItem("preferred-language", "zh-CN");
      const { result } = renderHook(() => i18n.useTranslations("auth"));

      await waitFor(() => {
        expect(result.current("login")).toBe("登录");
      });
    });

    it("should respond to storage events for language changes", async () => {
      localStorage.setItem("preferred-language", "zh-CN");
      const { result } = renderHook(() => i18n.useTranslations());

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
      const { result } = renderHook(() => i18n.useTranslations());

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
