"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ModalSize = "md" | "lg" | "fullscreen";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  role?: "dialog" | "alertdialog";
  initialFocusRef?: React.RefObject<HTMLElement>;
  className?: string;
  backdropClassName?: string;
  containerClassName?: string;
};

let scrollLockCount = 0;

function lockScroll() {
  if (typeof document === "undefined") return;
  if (scrollLockCount === 0) {
    const body = document.body;
    body.dataset.prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

function unlockScroll() {
  if (typeof document === "undefined") return;
  if (scrollLockCount === 0) return;
  scrollLockCount -= 1;
  if (scrollLockCount === 0) {
    const body = document.body;
    const prev = body.dataset.prevOverflow;
    if (prev !== undefined) {
      body.style.overflow = prev;
    } else {
      body.style.overflow = "";
    }
    delete body.dataset.prevOverflow;
  }
}

export function Modal({
  open,
  onClose,
  children,
  size = "md",
  ariaLabelledby,
  ariaDescribedby,
  role = "dialog",
  initialFocusRef,
  className = "",
  backdropClassName = "",
  containerClassName = "",
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    mountedRef.current = true;
    return () => {
      unlockScroll();
      mountedRef.current = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && containerRef.current) {
        const root = containerRef.current;
        const focusable = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const isInside = active && root.contains(active);
        if (e.shiftKey) {
          if (!isInside || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!isInside || active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const target = initialFocusRef?.current || containerRef.current;
    if (target) {
      target.focus();
    }
  }, [open, initialFocusRef]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const sizeClass =
    size === "fullscreen"
      ? "fixed inset-0 sm:inset-0"
      : "absolute inset-0 flex items-center justify-center p-4";

  return createPortal(
    <div className="fixed inset-0 z-[10000]" aria-hidden={false}>
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${backdropClassName}`}
        onClick={onClose}
      />
      <div className={sizeClass}>
        <div
          ref={containerRef}
          role={role}
          aria-modal="true"
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
          tabIndex={-1}
          className={containerClassName}
        >
          <div className={className}>{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
