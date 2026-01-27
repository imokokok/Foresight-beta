/**
 * Sidebar 组件单元测试
 */

import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ComponentType } from "react";

vi.mock("lucide-react", () => ({
  ChevronDown: (props: any) => <svg data-testid="chevron-down-icon" {...props} />,
  Users: (props: any) => <svg data-testid="users-icon" {...props} />,
  BarChart3: (props: any) => <svg data-testid="bar-chart3-icon" {...props} />,
  MessageSquare: (props: any) => <svg data-testid="message-square-icon" {...props} />,
  Pin: (props: any) => <svg data-testid="pin-icon" {...props} />,
  Flag: (props: any) => <svg data-testid="flag-icon" {...props} />,
  Trophy: (props: any) => <svg data-testid="trophy-icon" {...props} />,
  ShieldCheck: (props: any) => <svg data-testid="shield-check-icon" {...props} />,
}));

vi.mock("framer-motion", () => {
  const motionHandler: ProxyHandler<Record<string, any>> = {
    get(_target, prop: string) {
      const tag = prop === "aside" ? "aside" : prop === "button" ? "button" : "div";
      return ({ children, ...rest }: any) => React.createElement(tag, rest, children);
    },
  };
  return {
    motion: new Proxy({}, motionHandler),
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("../WalletModal", () => ({
  __esModule: true,
  default: () => null,
}));

// Router mocks（使用 vi.hoisted 保证可在工厂外复用）
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/trending",
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

// Mock 上下文（同样使用 hoisted）
const useWalletMock = vi.hoisted(() =>
  vi.fn(() => ({
    account: null,
    formatAddress: (addr: string) => addr,
  }))
);

const useAuthMock = vi.hoisted(() =>
  vi.fn(() => ({
    user: null,
  }))
);

const useUserProfileOptionalMock = vi.hoisted(() =>
  vi.fn(() => ({
    isAdmin: false,
    profile: null,
  }))
);

vi.mock("@/contexts/WalletContext", () => ({
  useWallet: useWalletMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
  useAuthOptional: () => null,
}));

vi.mock("@/contexts/UserProfileContext", () => ({
  useUserProfileOptional: useUserProfileOptionalMock,
}));

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ user: null }),
}));

describe("Sidebar Component", () => {
  let Sidebar: ComponentType;

  beforeAll(async () => {
    Sidebar = (await import("../Sidebar")).default;
  });

  describe("导航菜单渲染", () => {
    it("应该渲染所有导航项", () => {
      render(<Sidebar />);

      // 检查主要导航项
      expect(screen.getByText("trending")).toBeInTheDocument();
      expect(screen.getByText("leaderboard")).toBeInTheDocument();
      expect(screen.getByText("forum")).toBeInTheDocument();
      expect(screen.getByText("flags")).toBeInTheDocument();
    });

    it("应该显示导航图标", () => {
      render(<Sidebar />);

      expect(screen.getByTestId("bar-chart3-icon")).toBeInTheDocument();
      expect(screen.getByTestId("trophy-icon")).toBeInTheDocument();
      expect(screen.getByTestId("message-square-icon")).toBeInTheDocument();
      expect(screen.getByTestId("flag-icon")).toBeInTheDocument();
    });
  });

  describe("响应式行为", () => {
    it("应该在移动端显示菜单按钮", () => {
      render(<Sidebar />);

      const menuButton = screen.getByRole("button", { name: "menu" });
      expect(menuButton).toBeInTheDocument();
    });
  });

  describe("可访问性", () => {
    it("侧边栏应该有正确的 role 属性", () => {
      render(<Sidebar />);

      const nav = screen.getByRole("navigation", { name: /mainNav/i });
      expect(nav).toBeInTheDocument();
    });

    it("导航按钮应该可以键盘访问", () => {
      render(<Sidebar />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("活动状态与交互", () => {
    it("当前页面的导航项应该高亮", () => {
      render(<Sidebar />);

      const trendingButton = screen.getByRole("button", { name: "trending" });
      expect(trendingButton).toHaveAttribute("aria-current", "page");
    });

    it("点击导航项应该触发路由跳转", () => {
      routerPushMock.mockClear();

      render(<Sidebar />);

      const leaderboardButton = screen.getByRole("button", { name: "leaderboard" });
      fireEvent.click(leaderboardButton);

      expect(routerPushMock).toHaveBeenCalledWith("/leaderboard");
    });
  });
});
