import React from "react";
import CreateProposalModal from "./CreateProposalModal";
import ProposalsLeftSidebar from "./ProposalsLeftSidebar";
import ProposalsMainContent from "./ProposalsMainContent";
import ProposalsRightSidebar from "./ProposalsRightSidebar";
import type { UseProposalsListReturn } from "./useProposalsList";

type ProposalsPageViewProps = UseProposalsListReturn & {
  account: string | null | undefined;
  user: { id?: string | null; email?: string | null } | null;
  connectWallet: () => void;
  isCreateModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  inspiration: string;
  isRolling: boolean;
  rollInspiration: () => void;
  jsonLd: unknown;
  router: { push: (href: string) => void };
  queryClient: { invalidateQueries: (options: { queryKey: unknown[] }) => void };
};

export default function ProposalsPageView({
  account,
  user,
  connectWallet,
  isCreateModalOpen,
  setCreateModalOpen,
  inspiration,
  isRolling,
  rollInspiration,
  jsonLd,
  router,
  queryClient,
  filter,
  setFilter,
  category,
  setCategory,
  search,
  setSearch,
  proposals,
  sortedProposals,
  categories,
  isLoading,
}: ProposalsPageViewProps) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-[calc(100vh-64px)] w-full relative overflow-x-hidden font-sans p-4 sm:p-6 lg:p-8 flex gap-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-200/40 rounded-full blur-[100px] mix-blend-multiply animate-pulse" />
          <div
            className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-200/40 rounded-full blur-[100px] mix-blend-multiply animate-pulse"
            style={{ animationDelay: "1s" }}
          />
          <div
            className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-purple-200/40 rounded-full blur-[100px] mix-blend-multiply animate-pulse"
            style={{ animationDelay: "2s" }}
          />
        </div>

        <ProposalsLeftSidebar
          account={account}
          user={user}
          connectWallet={connectWallet}
          setCreateModalOpen={setCreateModalOpen}
          proposals={proposals}
          filter={filter}
          setFilter={setFilter}
        />

        <ProposalsMainContent
          account={account}
          connectWallet={connectWallet}
          setCreateModalOpen={setCreateModalOpen}
          search={search}
          setSearch={setSearch}
          categories={categories}
          category={category}
          setCategory={setCategory}
          sortedProposals={sortedProposals}
          isLoading={isLoading}
          router={router}
        />

        <ProposalsRightSidebar
          inspiration={inspiration}
          isRolling={isRolling}
          rollInspiration={rollInspiration}
        />

        <CreateProposalModal
          isOpen={isCreateModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["proposals"] });
            setFilter("new");
          }}
        />
      </div>
    </>
  );
}
