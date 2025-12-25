"use client";
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import ProposalsPageView from "./ProposalsPageView";
import { useProposalsList } from "./useProposalsList";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";

const INSPIRATIONS = [
  "Will AI achieve AGI by 2026?",
  "Will humans land on Mars before 2030?",
  "Is Bitcoin hitting $100k this year?",
  "Who wins the next World Cup?",
  "Will Apple release a folding iPhone?",
];

function buildProposalsJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Foresight 提案广场",
        url: baseUrl + "/proposals",
        description: "在 Foresight 提案广场发起新的预测市场想法、治理议题并参与社区投票。",
        inLanguage: "zh-CN",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "首页",
            item: baseUrl + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "提案广场",
            item: baseUrl + "/proposals",
          },
        ],
      },
    ],
  };
}

export default function ProposalsPage() {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const { account, connectWallet } = useWallet();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const listState = useProposalsList(account, connectWallet);

  const [inspiration, setInspiration] = useState(INSPIRATIONS[0]);
  const [isRolling, setIsRolling] = useState(false);

  const rollInspiration = () => {
    setIsRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setInspiration(INSPIRATIONS[Math.floor(Math.random() * INSPIRATIONS.length)]);
      count += 1;
      if (count > 10) {
        clearInterval(interval);
        setIsRolling(false);
      }
    }, 100);
  };

  const jsonLd = buildProposalsJsonLd();

  return (
    <ProposalsPageView
      {...listState}
      account={account}
      user={user}
      connectWallet={connectWallet}
      isCreateModalOpen={isCreateModalOpen}
      setCreateModalOpen={setCreateModalOpen}
      inspiration={inspiration}
      isRolling={isRolling}
      rollInspiration={rollInspiration}
      jsonLd={jsonLd}
      router={router}
      queryClient={queryClient}
    />
  );
}
