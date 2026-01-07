import GradientPage from "@/components/ui/GradientPage";
import CreateProposalModal from "./CreateProposalModal";
import ProposalsLeftSidebar from "./ProposalsLeftSidebar";
import ProposalsMainContent from "./ProposalsMainContent";
import ProposalsRightSidebar from "./ProposalsRightSidebar";
import type { UseProposalsListReturn } from "./useProposalsList";
import type { AuthUser } from "@/contexts/AuthContext";

type ProposalsPageViewProps = UseProposalsListReturn & {
  account: string | null | undefined;
  user: AuthUser;
  connectWallet: () => void | Promise<void>;
  isCreateModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  inspiration: number;
  isRolling: boolean;
  rollInspiration: () => void;
  jsonLd: unknown;
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
  onProposalCreated,
}: ProposalsPageViewProps) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GradientPage className="min-h-[calc(100vh-64px)] w-full relative overflow-x-hidden font-sans p-4 sm:p-6 lg:p-8 flex gap-6">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
          <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
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
        />

        <ProposalsRightSidebar
          inspirationIndex={inspiration}
          isRolling={isRolling}
          rollInspiration={rollInspiration}
        />

        <CreateProposalModal
          isOpen={isCreateModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={onProposalCreated}
        />
      </GradientPage>
    </>
  );
}
