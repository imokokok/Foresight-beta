"use client";
import React from "react";

type Variant = "primary" | "secondary" | "success" | "warning" | "danger" | "ghost" | "subtle" | "cta";
type Size = "sm" | "md" | "lg";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const base = "btn-base focus:btn-focus disabled:opacity-50 disabled:cursor-not-allowed";
const sizes: Record<Size, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};
const variants: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  success: "btn-success",
  warning: "btn-warning",
  danger: "btn-danger",
  ghost: "btn-ghost",
  subtle: "btn-subtle",
  cta: "btn-cta",
};

export default function Button({ variant = "primary", size = "md", icon, fullWidth, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(base, sizes[size], variants[variant], fullWidth && "w-full", className)}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}
