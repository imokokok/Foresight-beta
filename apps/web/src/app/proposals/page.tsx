"use client";
import React, { useEffect, useMemo, useState } from "react";
import ProposalsPageView from "./ProposalsPageView";
import { useProposalsList } from "./useProposalsList";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale, useTranslations } from "@/lib/i18n";

const INSPIRATIONS_COUNT = 5;

function buildProposalsJsonLd(tProposals: (key: string) => string, locale: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: tProposals("page.jsonLdName"),
        url: baseUrl + "/proposals",
        description: tProposals("page.jsonLdDescription"),
        inLanguage: locale,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: tProposals("page.breadcrumbHome"),
            item: baseUrl + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: tProposals("page.breadcrumbProposals"),
            item: baseUrl + "/proposals",
          },
        ],
      },
    ],
  };
}

function useRollingInspiration(inspirationsCount: number) {
  const [inspirationIndex, setInspirationIndex] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const isRollingRef = React.useRef(false);
  const inspirationsCountRef = React.useRef(inspirationsCount);

  const rollInspiration = React.useCallback(() => {
    const count = inspirationsCountRef.current;
    if (isRollingRef.current || count <= 0) return;
    isRollingRef.current = true;
    setIsRolling(true);
    let tick = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setInspirationIndex(Math.floor(Math.random() * count));
      tick += 1;
      if (tick > 10) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        isRollingRef.current = false;
        setIsRolling(false);
      }
    }, 100);
  }, []);

  useEffect(() => {
    inspirationsCountRef.current = inspirationsCount;
  }, [inspirationsCount]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { inspirationIndex, isRolling, rollInspiration };
}

export default function ProposalsPage() {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const { account, connectWallet } = useWallet();
  const { user } = useAuth();
  const listState = useProposalsList(account ?? null, () => void connectWallet());
  const tProposals = useTranslations("proposals");
  const { locale } = useLocale();
  const { inspirationIndex, isRolling, rollInspiration } =
    useRollingInspiration(INSPIRATIONS_COUNT);

  const jsonLd = useMemo(() => buildProposalsJsonLd(tProposals, locale), [tProposals, locale]);

  return (
    <ProposalsPageView
      {...listState}
      account={account}
      user={user}
      connectWallet={connectWallet}
      isCreateModalOpen={isCreateModalOpen}
      setCreateModalOpen={setCreateModalOpen}
      inspiration={inspirationIndex}
      isRolling={isRolling}
      rollInspiration={rollInspiration}
      jsonLd={jsonLd}
    />
  );
}
