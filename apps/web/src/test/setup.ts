import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";
import React from "react";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-for-testing-only-do-not-use-in-production";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  captureEvent: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setContext: vi.fn(),
  startTransaction: vi.fn(() => ({
    setStatus: vi.fn(),
    finish: vi.fn(),
  })),
  init: vi.fn(),
  replayIntegration: vi.fn(),
  browserTracingIntegration: vi.fn(),
}));

vi.mock("@/lib/i18n", async () => {
  const actual = await vi.importActual<typeof import("@/lib/i18n")>("@/lib/i18n");
  return {
    ...actual,
    useTranslations: vi.fn(() => (key: string) => key),
  };
});

vi.mock("lucide-react", () => {
  const overrideTestIds: Record<string, string> = {
    TrendingUp: "trending-icon",
  };

  const handler: ProxyHandler<Record<string, React.ComponentType<any>>> = {
    get(_target, prop: string) {
      const testId =
        overrideTestIds[prop] ??
        `${prop.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}-icon`;
      return (props: any) =>
        React.createElement("svg", {
          "data-testid": testId,
          ...props,
        });
    },
  };

  return new Proxy({}, handler);
});

vi.mock("framer-motion", () => {
  const motionHandler: ProxyHandler<Record<string, React.ComponentType<any>>> = {
    get(_target, prop: string) {
      const tag = prop === "tr" ? "tr" : prop === "button" ? "button" : "div";
      return ({ children, ...rest }: any) => React.createElement(tag, rest, children);
    },
  };

  return {
    motion: new Proxy({}, motionHandler),
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

if (typeof navigator !== "undefined") {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: "/",
    query: {},
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: any) =>
    React.createElement("img", {
      src: typeof src === "string" ? src : "",
      alt,
      ...rest,
    }),
}));

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  const localStorageStore: Record<string, string> = {};

  const localStorageMock = {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(localStorageStore, key)
        ? localStorageStore[key]
        : null;
    },
    setItem(key: string, value: string) {
      localStorageStore[key] = String(value);
    },
    removeItem(key: string) {
      delete localStorageStore[key];
    },
    clear() {
      for (const key of Object.keys(localStorageStore)) {
        delete localStorageStore[key];
      }
    },
    key(index: number) {
      const keys = Object.keys(localStorageStore);
      return index >= 0 && index < keys.length ? keys[index] : null;
    },
    get length() {
      return Object.keys(localStorageStore).length;
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  });

  (globalThis as any).localStorage = localStorageMock;
}

global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
