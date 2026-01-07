/**
 * Leaderboard 组件单元测试
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import Leaderboard from "../Leaderboard";

vi.mock("@/lib/i18n", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock("lucide-react", () => ({
  Trophy: () => <svg data-testid="trophy-icon" />,
  Crown: () => <svg />,
  ChevronRight: () => <svg />,
  Loader2: () => <svg data-testid="loader-icon" />,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/ui/LazyImage", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

function mockLeaderboardFetch(data: any) {
  vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  } as Response);
}

describe("Leaderboard Component", () => {
  const AnyLeaderboard = Leaderboard as ComponentType<any>;
  const mockLeaderboardData = [
    {
      rank: 1,
      wallet_address: "0x1",
      username: "user1",
      avatar: "/avatar1.png",
      trades_count: 10,
      total_volume: 1500.5,
      profit: 0,
      win_rate: 80,
      trend: "+10%",
    },
    {
      rank: 2,
      wallet_address: "0x2",
      username: "user2",
      avatar: "/avatar2.png",
      trades_count: 8,
      total_volume: 1200.25,
      profit: 0,
      win_rate: 75,
      trend: "-5%",
    },
    {
      rank: 3,
      wallet_address: "0x3",
      username: "user3",
      avatar: "/avatar3.png",
      trades_count: 5,
      total_volume: 900.75,
      profit: 0,
      win_rate: 70,
      trend: "+2%",
    },
    {
      rank: 4,
      wallet_address: "0x4",
      username: "user4",
      avatar: "/avatar4.png",
      trades_count: 3,
      total_volume: 500,
      profit: 0,
      win_rate: 60,
      trend: "0%",
    },
  ];

  describe("基本渲染", () => {
    it("应该渲染排行榜标题", async () => {
      mockLeaderboardFetch({ leaderboard: mockLeaderboardData });
      render(<AnyLeaderboard />);
      expect(await screen.findByText("title")).toBeInTheDocument();
    });

    it("应该显示奖杯图标", async () => {
      mockLeaderboardFetch({ leaderboard: mockLeaderboardData });
      render(<AnyLeaderboard />);
      expect(await screen.findByTestId("trophy-icon")).toBeInTheDocument();
    });
  });

  describe("排名显示", () => {
    it("应该显示所有用户", async () => {
      mockLeaderboardFetch({ leaderboard: mockLeaderboardData });
      render(<AnyLeaderboard />);

      await waitFor(() => {
        expect(screen.getByText("user1")).toBeInTheDocument();
        expect(screen.getByText("user2")).toBeInTheDocument();
        expect(screen.getByText("user3")).toBeInTheDocument();
      });
    });

    it("应该显示前三名排名标签", async () => {
      mockLeaderboardFetch({ leaderboard: mockLeaderboardData });
      render(<AnyLeaderboard />);

      expect(await screen.findByText("#1")).toBeInTheDocument();
      expect(await screen.findByText("#2")).toBeInTheDocument();
      expect(await screen.findByText("#3")).toBeInTheDocument();
    });

    it("应该显示用户头像", async () => {
      mockLeaderboardFetch({ leaderboard: mockLeaderboardData });
      render(<AnyLeaderboard />);

      const avatars = await screen.findAllByRole("img");
      expect(avatars.length).toBeGreaterThan(0);
      expect(avatars.some((avatar) => avatar.getAttribute("src") === "/avatar1.png")).toBe(true);
    });

    it("应该显示格式化后的交易量", async () => {
      mockLeaderboardFetch({ leaderboard: mockLeaderboardData });
      render(<AnyLeaderboard />);

      expect(await screen.findByText("1.5K")).toBeInTheDocument();
      expect(await screen.findByText("1.2K")).toBeInTheDocument();
    });
  });

  describe("空状态", () => {
    it("没有数据时应该显示空状态", async () => {
      mockLeaderboardFetch({ leaderboard: [] });
      render(<AnyLeaderboard />);

      expect(await screen.findByText(/noData/i)).toBeInTheDocument();
    });
  });
});
