import { useEffect, useRef, useCallback } from "react";
import {
  trapFocus,
  focusManager,
  KeyboardShortcuts,
  announceToScreenReader,
  generateAriaId,
} from "@/lib/accessibility";

/**
 * 焦点陷阱 Hook（用于模态框）
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const cleanup = trapFocus(containerRef.current);
    return cleanup;
  }, [isActive]);

  return containerRef;
}

/**
 * 焦点管理 Hook
 */
export function useFocusManagement() {
  const saveFocus = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      focusManager.push(activeElement);
    }
  }, []);

  const restoreFocus = useCallback(() => {
    focusManager.restore();
  }, []);

  return { saveFocus, restoreFocus };
}

/**
 * 键盘快捷键 Hook
 */
export function useKeyboardShortcut(
  keys: string[],
  callback: (event: KeyboardEvent) => void,
  options: {
    enabled?: boolean;
    preventDefault?: boolean;
    requireCtrl?: boolean;
    requireShift?: boolean;
    requireAlt?: boolean;
  } = {}
) {
  const {
    enabled = true,
    preventDefault = true,
    requireCtrl = false,
    requireShift = false,
    requireAlt = false,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMatch = keys.includes(event.key);
      const ctrlMatch = !requireCtrl || event.ctrlKey || event.metaKey;
      const shiftMatch = !requireShift || event.shiftKey;
      const altMatch = !requireAlt || event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        if (preventDefault) {
          event.preventDefault();
        }
        callback(event);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [keys, callback, enabled, preventDefault, requireCtrl, requireShift, requireAlt]);
}

/**
 * ESC 键关闭 Hook（常用于模态框）
 */
export function useEscapeKey(callback: () => void, enabled = true) {
  useKeyboardShortcut([KeyboardShortcuts.ESCAPE], callback, { enabled });
}

/**
 * 屏幕阅读器公告 Hook
 */
export function useScreenReaderAnnouncement() {
  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    announceToScreenReader(message, priority);
  }, []);

  return announce;
}

/**
 * ARIA ID 生成 Hook
 */
export function useAriaId(prefix?: string) {
  const idRef = useRef<string>();

  if (!idRef.current) {
    idRef.current = generateAriaId(prefix);
  }

  return idRef.current;
}

/**
 * 键盘导航 Hook（列表、菜单等）
 */
export function useKeyboardNavigation(
  items: any[],
  options: {
    loop?: boolean;
    orientation?: "vertical" | "horizontal";
    onSelect?: (index: number) => void;
  } = {}
) {
  const { loop = true, orientation = "vertical", onSelect } = options;
  const currentIndexRef = useRef(0);

  const navigate = useCallback(
    (direction: "next" | "prev" | "first" | "last") => {
      let newIndex = currentIndexRef.current;

      switch (direction) {
        case "next":
          newIndex++;
          if (newIndex >= items.length) {
            newIndex = loop ? 0 : items.length - 1;
          }
          break;
        case "prev":
          newIndex--;
          if (newIndex < 0) {
            newIndex = loop ? items.length - 1 : 0;
          }
          break;
        case "first":
          newIndex = 0;
          break;
        case "last":
          newIndex = items.length - 1;
          break;
      }

      currentIndexRef.current = newIndex;
      return newIndex;
    },
    [items.length, loop]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      let direction: "next" | "prev" | "first" | "last" | null = null;

      if (orientation === "vertical") {
        if (event.key === KeyboardShortcuts.ARROW_DOWN) direction = "next";
        else if (event.key === KeyboardShortcuts.ARROW_UP) direction = "prev";
      } else {
        if (event.key === KeyboardShortcuts.ARROW_RIGHT) direction = "next";
        else if (event.key === KeyboardShortcuts.ARROW_LEFT) direction = "prev";
      }

      if (event.key === KeyboardShortcuts.HOME) direction = "first";
      else if (event.key === KeyboardShortcuts.END) direction = "last";

      if (direction) {
        event.preventDefault();
        const newIndex = navigate(direction);
        onSelect?.(newIndex);
      }

      // Enter or Space to select
      if (event.key === KeyboardShortcuts.ENTER || event.key === KeyboardShortcuts.SPACE) {
        event.preventDefault();
        onSelect?.(currentIndexRef.current);
      }
    },
    [navigate, onSelect, orientation]
  );

  return {
    currentIndex: currentIndexRef.current,
    navigate,
    handleKeyDown,
  };
}
