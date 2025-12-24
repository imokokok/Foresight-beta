/**
 * LanguageSwitcher 组件单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { setLocale } from "@/lib/i18n";
import LanguageSwitcher from "../LanguageSwitcher";

// Mock 翻译
vi.mock("@/lib/i18n", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  getCurrentLocale: vi.fn(() => "zh-CN"),
  setLocale: vi.fn(),
}));

// Mock icons
vi.mock("lucide-react", () => ({
  Globe: () => <svg data-testid="globe-icon" />,
  Check: () => <svg data-testid="check-icon" />,
}));

describe("LanguageSwitcher Component", () => {
  beforeEach(() => {
    // 清理 localStorage
    if (typeof localStorage.clear === "function") {
      localStorage.clear();
    } else {
      Object.keys(localStorage as any).forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {}
      });
    }
  });

  describe("基本渲染", () => {
    it("应该渲染语言切换按钮", () => {
      render(<LanguageSwitcher />);

      expect(screen.getByTestId("globe-icon")).toBeInTheDocument();
    });

    it("应该有可访问的 aria-label", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByLabelText(/切换语言|language/i);
      expect(button).toBeInTheDocument();
    });
  });

  describe("语言选择", () => {
    it("点击按钮应该打开语言菜单", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByTestId("globe-icon").closest("button");
      fireEvent.click(button!);

      // 应该显示语言选项
      expect(screen.getAllByText(/中文|Chinese/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/English/i)).toBeInTheDocument();
    });

    it("应该显示当前选中的语言", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByTestId("globe-icon").closest("button");
      fireEvent.click(button!);

      // 中文选项应该有选中标记
      const options = screen.getAllByRole("menuitem");
      const chineseOption = options[0];
      expect(chineseOption).toHaveClass(/active|selected/);
    });

    it("点击语言选项应该切换语言", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByTestId("globe-icon").closest("button");
      fireEvent.click(button!);

      const englishOption = screen.getByText(/English/i);
      fireEvent.click(englishOption);

      const headerLabel = screen.getByText(/English/i);
      expect(headerLabel).toBeInTheDocument();
    });
  });

  describe("持久化", () => {
    it("应该保存语言偏好到 localStorage", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByTestId("globe-icon").closest("button");
      fireEvent.click(button!);

      const englishOption = screen.getByText(/English/i);
      fireEvent.click(englishOption);

      expect(setLocale).toHaveBeenCalledWith("en");
    });
  });

  describe("可访问性", () => {
    it("菜单应该有正确的 role 属性", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByTestId("globe-icon").closest("button");
      fireEvent.click(button!);

      const menu = screen.getByRole("menu");
      expect(menu).toBeInTheDocument();
    });

    it("语言选项应该有正确的 role", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByTestId("globe-icon").closest("button");
      fireEvent.click(button!);

      const options = screen.getAllByRole("menuitem");
      expect(options.length).toBeGreaterThan(0);
    });

    it("应该支持键盘导航", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByTestId("globe-icon").closest("button");

      // 模拟 Enter 键
      fireEvent.keyDown(button!, { key: "Enter" });

      const menu = screen.getByRole("menu");
      expect(menu).toBeInTheDocument();
    });
  });

  describe("响应式行为", () => {
    it("在移动端应该正常工作", () => {
      render(<LanguageSwitcher />);

      const button = screen.getByTestId("globe-icon").closest("button");
      expect(button).toBeInTheDocument();
    });
  });
});
