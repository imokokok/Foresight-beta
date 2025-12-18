/**
 * 可访问性工具集
 * 提供键盘导航、焦点管理、屏幕阅读器支持等功能
 */

/**
 * 键盘快捷键映射
 */
export const KeyboardShortcuts = {
  ESCAPE: "Escape",
  ENTER: "Enter",
  SPACE: " ",
  TAB: "Tab",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
} as const;

/**
 * 判断元素是否可聚焦
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  const tabindex = element.getAttribute("tabindex");
  if (tabindex && parseInt(tabindex) < 0) {
    return false;
  }

  // 检查是否是可交互元素
  const focusableTags = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"];
  if (focusableTags.includes(element.tagName)) {
    return !element.hasAttribute("disabled");
  }

  // 检查是否有 tabindex
  return tabindex !== null;
}

/**
 * 获取容器内所有可聚焦元素
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(",");

  const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return elements.filter((el) => isFocusable(el) && el.offsetParent !== null);
}

/**
 * 焦点陷阱（用于模态框）
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== KeyboardShortcuts.TAB) return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener("keydown", handleKeyDown);

  // 自动聚焦第一个元素
  firstElement?.focus();

  // 返回清理函数
  return () => {
    container.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * 管理焦点历史（用于返回之前的焦点）
 */
class FocusManager {
  private stack: HTMLElement[] = [];

  push(element: HTMLElement) {
    this.stack.push(element);
  }

  pop(): HTMLElement | undefined {
    return this.stack.pop();
  }

  restore() {
    const element = this.pop();
    if (element && document.body.contains(element)) {
      element.focus();
    }
  }

  clear() {
    this.stack = [];
  }
}

export const focusManager = new FocusManager();

/**
 * 生成唯一的 ARIA ID
 */
let idCounter = 0;
export function generateAriaId(prefix = "aria"): string {
  idCounter++;
  return `${prefix}-${idCounter}-${Date.now()}`;
}

/**
 * 屏幕阅读器公告（Screen Reader Announcement）
 */
export function announceToScreenReader(
  message: string,
  priority: "polite" | "assertive" = "polite"
) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // 短暂延迟后移除
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * 仅屏幕阅读器可见的文本样式
 */
export const srOnlyStyles = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "0",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: "0",
} as const;

/**
 * 格式化数字为易读格式（供屏幕阅读器使用）
 */
export function formatNumberForScreenReader(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)} 百万`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)} 千`;
  }
  return num.toString();
}

/**
 * 格式化日期为易读格式（供屏幕阅读器使用）
 */
export function formatDateForScreenReader(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "今天";
  } else if (diffDays === 1) {
    return "昨天";
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}
