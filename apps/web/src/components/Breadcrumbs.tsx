"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function labelFor(seg: string) {
  switch (seg) {
    case "trending":
      return "热门趋势";
    case "forum":
      return "论坛/提案";
    case "my-follows":
      return "我的关注";
    case "prediction":
      return "事件";
    case "privacy":
      return "隐私政策";
    case "terms":
      return "服务条款";
    default:
      return seg;
  }
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  const crumbs = parts.map((seg, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const label = labelFor(seg);
    return { href, label };
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="breadcrumb" className="px-4 py-2">
      <div className="flex items-center flex-wrap gap-2 text-sm">
        <Link href="/" className="text-gray-600 hover:text-gray-800">首页</Link>
        {crumbs.map((c, idx) => (
          <span key={c.href} className="flex items-center gap-2">
            <span className="text-gray-400">/</span>
            {idx === crumbs.length - 1 ? (
              <span className="text-gray-800 font-medium">{c.label}</span>
            ) : (
              <Link href={c.href} className="text-gray-600 hover:text-gray-800">{c.label}</Link>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}