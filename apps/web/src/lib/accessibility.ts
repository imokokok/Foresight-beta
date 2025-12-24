import { t, getCurrentLocale, formatTranslation } from "./i18n";

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

  const style = (element as HTMLElement).style;
  if (style && (style.display === "none" || style.visibility === "hidden")) {
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
  return elements.filter((el) => isFocusable(el));
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

export function manageFocusLoop(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    return () => {};
  }
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== KeyboardShortcuts.TAB) return;
    if (focusableElements.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    if (!active || !container.contains(active)) {
      return;
    }

    if (e.shiftKey) {
      if (active === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (active === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener("keydown", handleKeyDown);

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
let politeLiveRegion: HTMLDivElement | null = null;
let assertiveLiveRegion: HTMLDivElement | null = null;

function getLiveRegion(priority: "polite" | "assertive"): HTMLDivElement {
  if (priority === "polite") {
    if (!politeLiveRegion || !document.body.contains(politeLiveRegion)) {
      politeLiveRegion = document.createElement("div");
      politeLiveRegion.setAttribute("role", "status");
      politeLiveRegion.setAttribute("aria-live", "polite");
      politeLiveRegion.setAttribute("aria-atomic", "true");
      politeLiveRegion.className = "sr-only";
      document.body.appendChild(politeLiveRegion);
    }
    return politeLiveRegion;
  }

  if (!assertiveLiveRegion || !document.body.contains(assertiveLiveRegion)) {
    assertiveLiveRegion = document.createElement("div");
    assertiveLiveRegion.setAttribute("role", "alert");
    assertiveLiveRegion.setAttribute("aria-live", "assertive");
    assertiveLiveRegion.setAttribute("aria-atomic", "true");
    assertiveLiveRegion.className = "sr-only";
    document.body.appendChild(assertiveLiveRegion);
  }
  return assertiveLiveRegion;
}

export function announceToScreenReader(
  message: string,
  priority: "polite" | "assertive" = "polite"
) {
  const liveRegion = getLiveRegion(priority);
  liveRegion.textContent = message;

  setTimeout(() => {
    if (document.body.contains(liveRegion)) {
      liveRegion.textContent = "";
    }
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
  const locale = getCurrentLocale();
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  });

  if (num >= 1000000) {
    const value = formatter.format(num / 1000000);
    const template = t("accessibility.number.million");
    return formatTranslation(template, { value });
  }

  if (num >= 1000) {
    const value = formatter.format(num / 1000);
    const template = t("accessibility.number.thousand");
    return formatTranslation(template, { value });
  }

  return formatter.format(num);
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
    return t("accessibility.date.today");
  } else if (diffDays === 1) {
    return t("accessibility.date.yesterday");
  } else if (diffDays < 7) {
    const template = t("accessibility.date.daysAgo");
    return formatTranslation(template, { count: diffDays });
  } else {
    const locale = getCurrentLocale();
    return d.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}
