"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/lib/i18n";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tPrediction = useTranslations("prediction");
  const tLogin = useTranslations("login");

  const labelFor = (seg: string) => {
    switch (seg) {
      case "trending":
        return tNav("trending");
      case "forum":
        return tNav("forum");
      case "my-follows":
        return tNav("myFollows");
      case "prediction":
        return tPrediction("title");
      case "privacy":
        return tLogin("privacy");
      case "terms":
        return tLogin("terms");
      default:
        return seg;
    }
  };
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
        <Link href="/" className="text-gray-600 hover:text-gray-800">
          {tNav("home")}
        </Link>
        {crumbs.map((c, idx) => (
          <span key={c.href} className="flex items-center gap-2">
            <span className="text-gray-400">/</span>
            {idx === crumbs.length - 1 ? (
              <span className="text-gray-800 font-medium">{c.label}</span>
            ) : (
              <Link href={c.href} className="text-gray-600 hover:text-gray-800">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
