/**
 * Leaderboard 组件单元测试
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import Leaderboard from "../Leaderboard";

describe("Leaderboard Component", () => {
  const AnyLeaderboard = Leaderboard as ComponentType<any>;
  const mockLeaderboardData = [
    {
      rank: 1,
      username: "user1",
      avatar_url: "/avatar1.png",
      total_profit: 1500.5,
      total_predictions: 50,
      accuracy_rate: 85.5,
    },
    {
      rank: 2,
      username: "user2",
      avatar_url: "/avatar2.png",
      total_profit: 1200.25,
      total_predictions: 40,
      accuracy_rate: 82.0,
    },
    {
      rank: 3,
      username: "user3",
      avatar_url: "/avatar3.png",
      total_profit: 900.75,
      total_predictions: 35,
      accuracy_rate: 78.5,
    },
  ];

  describe("基本渲染", () => {
    it("应该渲染排行榜标题", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);
      expect(screen.getByText(/排行榜|Leaderboard/i)).toBeInTheDocument();
    });

    it("应该显示奖杯图标", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);
      expect(screen.getByTestId("trophy-icon")).toBeInTheDocument();
    });
  });

  describe("排名显示", () => {
    it("应该显示所有用户", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);

      expect(screen.getByText("user1")).toBeInTheDocument();
      expect(screen.getByText("user2")).toBeInTheDocument();
      expect(screen.getByText("user3")).toBeInTheDocument();
    });

    it("应该显示排名", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("应该显示用户头像", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);

      const avatars = screen.getAllByRole("img");
      expect(avatars.length).toBeGreaterThan(0);
      expect(avatars[0]).toHaveAttribute("src", "/avatar1.png");
    });

    it("应该显示总收益", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);

      expect(screen.getByText(/1500\.50|1,500\.50/)).toBeInTheDocument();
      expect(screen.getByText(/1200\.25|1,200\.25/)).toBeInTheDocument();
    });

    it("应该显示准确率", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);

      expect(screen.getByText(/85\.5%/)).toBeInTheDocument();
      expect(screen.getByText(/82\.0%|82%/)).toBeInTheDocument();
    });
  });

  describe("空状态", () => {
    it("没有数据时应该显示空状态", () => {
      render(<AnyLeaderboard data={[]} />);

      expect(screen.getByText(/暂无数据|No data/i)).toBeInTheDocument();
    });
  });

  describe("特殊排名标记", () => {
    it("前三名应该有特殊样式", () => {
      const { container } = render(<AnyLeaderboard data={mockLeaderboardData} />);

      // 第一名应该有金色样式
      const firstPlace = container.querySelector('[data-rank="1"]');
      expect(firstPlace).toHaveClass(/gold|yellow/);

      // 第二名应该有银色样式
      const secondPlace = container.querySelector('[data-rank="2"]');
      expect(secondPlace).toHaveClass(/silver|gray/);

      // 第三名应该有铜色样式
      const thirdPlace = container.querySelector('[data-rank="3"]');
      expect(thirdPlace).toHaveClass(/bronze|orange/);
    });
  });

  describe("可访问性", () => {
    it("表格应该有正确的语义结构", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);

      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();
    });

    it("表头应该正确标记", () => {
      render(<AnyLeaderboard data={mockLeaderboardData} />);

      const headers = screen.getAllByRole("columnheader");
      expect(headers.length).toBeGreaterThan(0);
    });
  });
});
