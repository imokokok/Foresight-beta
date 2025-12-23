/**
 * FlagCard 组件单元测试
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlagCard, type FlagItem } from "../FlagCard";

describe("FlagCard Component", () => {
  const mockActiveFlag: FlagItem = {
    id: 1,
    title: "每日运动打卡",
    description: "坚持每天运动30分钟",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    verification_type: "self",
    created_at: new Date().toISOString(),
    user_id: "user-1",
  };

  const mockPendingFlag: FlagItem = {
    ...mockActiveFlag,
    id: 2,
    status: "pending_review",
    proof_image_url: "/proof.jpg",
    proof_comment: "今天跑步了5公里",
  };

  const mockSuccessFlag: FlagItem = {
    ...mockActiveFlag,
    id: 3,
    status: "success",
  };

  const mockFailedFlag: FlagItem = {
    ...mockActiveFlag,
    id: 4,
    status: "failed",
  };

  describe("基本渲染", () => {
    it("应该渲染 Flag 标题", () => {
      render(<FlagCard flag={mockActiveFlag} />);
      expect(screen.getByText("每日运动打卡")).toBeInTheDocument();
    });

    it("应该渲染 Flag 描述", () => {
      render(<FlagCard flag={mockActiveFlag} />);
      expect(screen.getByText("坚持每天运动30分钟")).toBeInTheDocument();
    });

    it("应该显示截止日期", () => {
      render(<FlagCard flag={mockActiveFlag} />);
      expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
    });
  });

  describe("状态显示", () => {
    it("active 状态应该显示进行中", () => {
      render(<FlagCard flag={mockActiveFlag} />);
      expect(screen.getByText("进行中")).toBeInTheDocument();
      expect(screen.getByTestId("target-icon")).toBeInTheDocument();
    });

    it("pending_review 状态应该显示待审核", () => {
      render(<FlagCard flag={mockPendingFlag} />);
      expect(screen.getByText("待审核")).toBeInTheDocument();
    });

    it("success 状态应该显示已完成", () => {
      render(<FlagCard flag={mockSuccessFlag} />);
      expect(screen.getByText("已完成")).toBeInTheDocument();
      expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    });

    it("failed 状态应该显示失败", () => {
      render(<FlagCard flag={mockFailedFlag} />);
      expect(screen.getByText("失败")).toBeInTheDocument();
    });
  });

  describe("验证类型", () => {
    it("自我验证应该显示正确标签", () => {
      render(<FlagCard flag={mockActiveFlag} />);
      expect(screen.getByText("自我验证")).toBeInTheDocument();
    });

    it("见证验证应该显示正确标签", () => {
      const witnessFlag: FlagItem = {
        ...mockActiveFlag,
        verification_type: "witness",
        witness_id: "witness-1",
      };

      render(<FlagCard flag={witnessFlag} />);
      expect(screen.getByText("见证验证")).toBeInTheDocument();
      expect(screen.getByTestId("users-icon")).toBeInTheDocument();
    });
  });

  describe("用户交互", () => {
    it("点击打卡按钮应该触发回调", () => {
      const onCheckin = vi.fn();
      render(<FlagCard flag={mockActiveFlag} isMine={true} onCheckin={onCheckin} />);

      const checkinButton = screen.getByText(/打卡/i);
      fireEvent.click(checkinButton);

      expect(onCheckin).toHaveBeenCalled();
    });

    it("点击查看历史应该触发回调", () => {
      const onViewHistory = vi.fn();
      render(<FlagCard flag={mockActiveFlag} onViewHistory={onViewHistory} />);

      const historyButton = screen.getByText(/历史/i);
      fireEvent.click(historyButton);

      expect(onViewHistory).toHaveBeenCalled();
    });

    it("点击结算应该触发回调", () => {
      const onSettle = vi.fn();
      const settleableFlag = {
        ...mockActiveFlag,
        deadline: new Date(Date.now() - 1000).toISOString(), // 已过期
      };

      render(<FlagCard flag={settleableFlag} isMine={true} onSettle={onSettle} />);

      const settleButton = screen.getByText(/结算/i);
      fireEvent.click(settleButton);

      expect(onSettle).toHaveBeenCalled();
    });
  });

  describe("证明信息", () => {
    it("有证明图片时应该显示", () => {
      render(<FlagCard flag={mockPendingFlag} />);

      expect(screen.getByTestId("camera-icon")).toBeInTheDocument();
    });

    it("有证明评论时应该显示", () => {
      render(<FlagCard flag={mockPendingFlag} />);

      expect(screen.getByText("今天跑步了5公里")).toBeInTheDocument();
    });
  });

  describe("条件渲染", () => {
    it("不是我的 Flag 不应该显示打卡按钮", () => {
      render(<FlagCard flag={mockActiveFlag} isMine={false} />);

      expect(screen.queryByText(/打卡/i)).not.toBeInTheDocument();
    });

    it("已完成的 Flag 不应该显示打卡按钮", () => {
      render(<FlagCard flag={mockSuccessFlag} isMine={true} />);

      expect(screen.queryByText(/打卡/i)).not.toBeInTheDocument();
    });

    it("未过期的 Flag 不应该显示结算按钮", () => {
      render(<FlagCard flag={mockActiveFlag} isMine={true} />);

      expect(screen.queryByText(/结算/i)).not.toBeInTheDocument();
    });
  });

  describe("样式和视觉效果", () => {
    it("应该有正确的卡片样式类", () => {
      const { container } = render(<FlagCard flag={mockActiveFlag} />);

      const card = container.firstChild;
      expect(card).toHaveClass("rounded-xl");
    });

    it("不同状态应该有不同的颜色主题", () => {
      const { container: activeContainer } = render(<FlagCard flag={mockActiveFlag} />);
      const { container: successContainer } = render(<FlagCard flag={mockSuccessFlag} />);

      expect(activeContainer.innerHTML).toContain("emerald");
      expect(successContainer.innerHTML).toContain("blue");
    });
  });
});
