/**
 * DatePicker 组件单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DatePicker from "../DatePicker";

// 固定系统时间，方便断言「过去/未来」逻辑
const fixedNow = new Date("2025-01-15T10:30:00");

vi.useFakeTimers();
vi.setSystemTime(fixedNow);

// Mock icons
vi.mock("lucide-react", () => ({
  Calendar: () => <svg data-testid="calendar-icon" />,
  ChevronLeft: () => <svg data-testid="chevron-left-icon" />,
  ChevronRight: () => <svg data-testid="chevron-right-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

// Mock framer-motion，避免动画影响测试
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("DatePicker Component", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("基本功能", () => {
    it("初始应该显示占位文案", () => {
      render(<DatePicker value="" onChange={() => {}} placeholder="请选择日期" />);

      expect(screen.getByText("请选择日期")).toBeInTheDocument();
      expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
    });
  });

  describe("日期选择", () => {
    it("点击后应该展开日期面板并选择某天", () => {
      const handleChange = vi.fn();

      render(<DatePicker value="" onChange={handleChange} placeholder="选择日期" />);

      // 打开面板
      const trigger = screen.getByText("选择日期");
      fireEvent.click(trigger);

      // 选择 20 号
      const dayButton = screen.getAllByRole("button").find((btn) => btn.textContent === "20");
      expect(dayButton).toBeDefined();
      fireEvent.click(dayButton as HTMLButtonElement);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const arg = handleChange.mock.calls[0][0] as string;
      expect(arg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("在 includeTime=true 时，改变时间应更新值", () => {
      const handleChange = vi.fn();

      render(<DatePicker value="2025-01-15T10:30" onChange={handleChange} includeTime />);

      fireEvent.click(screen.getByText(/2025年1月15日/));

      const timeInput = screen.getByDisplayValue("10:30") as HTMLInputElement;
      fireEvent.change(timeInput, { target: { value: "12:00" } });

      expect(handleChange).toHaveBeenCalled();
      const lastArg = handleChange.mock.calls.at(-1)?.[0] as string;
      expect(lastArg).toBe("2025-01-15T12:00");
    });
  });

  describe("日期验证", () => {
    it("默认不允许选择今天之前的日期", () => {
      const handleChange = vi.fn();

      render(<DatePicker value="" onChange={handleChange} />);

      fireEvent.click(screen.getByText("选择日期"));

      const allButtons = screen.getAllByRole("button");
      const pastDayButton = allButtons.find((btn) => btn.textContent === "10") as HTMLButtonElement;
      const todayButton = allButtons.find((btn) => btn.textContent === "15") as HTMLButtonElement;

      expect(pastDayButton).toBeDisabled();
      expect(todayButton).not.toBeDisabled();
    });

    it("设置 minDate 时，早于 minDate 的日期应该被禁止选择", () => {
      const handleChange = vi.fn();

      render(<DatePicker value="" onChange={handleChange} minDate="2025-01-20" />);

      fireEvent.click(screen.getByText("选择日期"));

      const allButtons = screen.getAllByRole("button");
      const beforeMin = allButtons.find((btn) => btn.textContent === "15") as HTMLButtonElement;
      const atMin = allButtons.find((btn) => btn.textContent === "20") as HTMLButtonElement;

      expect(beforeMin).toBeDisabled();
      expect(atMin).not.toBeDisabled();
    });
  });

  describe("格式化", () => {
    it("不含时间时，应该展示 yyyy年M月d日", () => {
      render(<DatePicker value="2025-01-15" onChange={() => {}} />);

      expect(screen.getByText("2025年1月15日")).toBeInTheDocument();
    });

    it("含时间时，应该展示 yyyy年M月d日 HH:mm", () => {
      render(<DatePicker value="2025-01-15T09:05" onChange={() => {}} includeTime />);

      expect(screen.getByText("2025年1月15日 09:05")).toBeInTheDocument();
    });
  });

  describe("可访问性", () => {
    it("外层应该可通过 role / 交互访问", () => {
      render(<DatePicker value="" onChange={() => {}} placeholder="选择日期" />);

      const trigger = screen.getByText("选择日期");
      expect(trigger).toBeInTheDocument();
      fireEvent.click(trigger);

      const monthTitle = screen.getByText(/2025年/);
      expect(monthTitle).toBeInTheDocument();
    });
  });
});
