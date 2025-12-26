"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

export function ProposalIntroCard() {
  const tProposals = useTranslations("proposals");

  return (
    <div className="mb-8 pl-4 border-l-2 border-purple-200/70 space-y-2">
      <p className="text-sm text-slate-700 leading-relaxed">{tProposals("intro.description")}</p>
      <p className="text-xs text-slate-500 leading-relaxed">
        {tProposals("intro.helperPrefix")}{" "}
        <Link href="/proposals" className="text-purple-600 hover:text-purple-700 hover:underline">
          {tProposals("intro.helperProposals")}
        </Link>{" "}
        {tProposals("intro.helperMiddle")}{" "}
        <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
          {tProposals("intro.helperTrending")}
        </Link>{" "}
        {tProposals("intro.helperMiddle2")}{" "}
        <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
          {tProposals("intro.helperForum")}
        </Link>{" "}
        {tProposals("intro.helperSuffix")}
      </p>
    </div>
  );
}
