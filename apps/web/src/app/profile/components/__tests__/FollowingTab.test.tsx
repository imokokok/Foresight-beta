import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type React from "react";
import { FollowingTab } from "../FollowingTab";

const useFollowingEventsMock = vi.fn();
const useFollowingUsersMock = vi.fn();
const TEST_ADDRESS = "0xabc0000000000000000000000000000000000000";

vi.mock("@/lib/i18n", () => ({
  useTranslations: vi.fn((namespace?: string) => {
    return (key: string) => (namespace ? `${namespace}.${key}` : key);
  }),
  useLocale: () => ({
    locale: "en-US",
  }),
  formatTranslation: (template: string) => template,
}));

vi.mock("lucide-react", () => ({
  Heart: () => <svg data-testid="heart-icon" />,
  Users: () => <svg data-testid="users-icon" />,
  Target: () => <svg data-testid="target-icon" />,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/EmptyState", () => ({
  __esModule: true,
  default: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <div>{title}</div>
      {description && <div>{description}</div>}
    </div>
  ),
}));

vi.mock("@/components/ui/UserHoverCard", () => ({
  UserHoverCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useQueries", () => ({
  useFollowingEvents: (...args: unknown[]) => useFollowingEventsMock(...args),
  useFollowingUsers: (...args: unknown[]) => useFollowingUsersMock(...args),
}));

describe("FollowingTab 组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useFollowingEventsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      refetch: vi.fn(),
    });

    useFollowingUsersMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      refetch: vi.fn(),
    });
  });

  it("未提供地址时应显示空状态", () => {
    render(<FollowingTab address={null} />);

    expect(screen.getByText("profile.following.tabEvents")).toBeInTheDocument();
    expect(screen.getByText("profile.following.tabUsers")).toBeInTheDocument();
    expect(screen.getByText("profile.following.empty.title")).toBeInTheDocument();
    expect(screen.getByText("profile.following.empty.description")).toBeInTheDocument();
  });

  it("地址存在且事件列表加载中时应显示事件 skeleton", () => {
    useFollowingEventsMock.mockReturnValue({
      isLoading: true,
      isError: false,
      data: [],
      refetch: vi.fn(),
    });

    const { container } = render(<FollowingTab address={TEST_ADDRESS} />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("请求失败时应显示错误提示并支持重试", () => {
    const refetch = vi.fn();

    useFollowingEventsMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: [],
      refetch,
    });

    render(<FollowingTab address={TEST_ADDRESS} />);

    expect(screen.getByText("common.loadFailed")).toBeInTheDocument();
    expect(screen.getByText("common.retry")).toBeInTheDocument();

    fireEvent.click(screen.getByText("common.retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("有事件数据时应支持分页加载更多", () => {
    const events = Array.from({ length: 8 }).map((_, index) => ({
      id: index + 1,
      title: `event-${index + 1}`,
      followers_count: 10,
    }));

    useFollowingEventsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: events,
      refetch: vi.fn(),
    });

    render(<FollowingTab address={TEST_ADDRESS} />);

    expect(screen.getByText("event-1")).toBeInTheDocument();
    expect(screen.getByText("event-6")).toBeInTheDocument();
    expect(screen.queryByText("event-7")).not.toBeInTheDocument();
    expect(screen.queryByText("event-8")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("common.more"));

    expect(screen.getByText("event-7")).toBeInTheDocument();
    expect(screen.getByText("event-8")).toBeInTheDocument();
  });

  it("切换到用户标签时应显示用户列表", () => {
    const users = [
      {
        wallet_address: "0xabc",
        username: "user-1",
        avatar: "/avatar.png",
      },
    ];

    useFollowingEventsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      refetch: vi.fn(),
    });

    useFollowingUsersMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: users,
      refetch: vi.fn(),
    });

    render(<FollowingTab address={TEST_ADDRESS} />);

    fireEvent.click(screen.getByText("profile.following.tabUsers"));

    expect(screen.getByText("user-1")).toBeInTheDocument();
  });
});
