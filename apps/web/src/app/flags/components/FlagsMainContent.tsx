import { Loader2, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { FlagCard, type FlagItem } from "@/components/FlagCard";

export type FlagsMainContentProps = {
  tFlags: (key: string) => string;
  loading: boolean;
  filteredFlags: FlagItem[];
  account: string | null | undefined;
  viewerId: string;
  onCreate: () => void;
  onCheckin: (flag: FlagItem) => void;
  onOpenHistory: (flag: FlagItem) => void;
  onSettle: (flag: FlagItem) => void;
};

type FlagsCreateCardProps = {
  tFlags: (key: string) => string;
  onCreate: () => void;
};

function FlagsCreateCard({ tFlags, onCreate }: FlagsCreateCardProps) {
  return (
    <motion.div
      layout
      onClick={onCreate}
      className="break-inside-avoid group cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative h-[300px] rounded-[2rem] border-[4px] border-dashed border-gray-300 bg-white/30 hover:bg-white/60 hover:border-purple-300 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:rotate-90 transition-all duration-500">
          <Plus className="w-8 h-8 text-gray-400 group-hover:text-purple-500 transition-colors" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-600 group-hover:text-purple-600 transition-colors">
            {tFlags("createCard.title")}
          </h3>
          <p className="text-xs font-bold text-gray-400 mt-1">{tFlags("createCard.subtitle")}</p>
        </div>
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-gray-200/50 rotate-1 mask-tape"
          style={{ clipPath: "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)" }}
        />
      </div>
    </motion.div>
  );
}

type FlagsListContainerProps = {
  filteredFlags: FlagItem[];
  account: string | null | undefined;
  viewerId: string;
  onCheckin: (flag: FlagItem) => void;
  onOpenHistory: (flag: FlagItem) => void;
  onSettle: (flag: FlagItem) => void;
};

function FlagsListContainer({
  filteredFlags,
  account,
  viewerId,
  onCheckin,
  onOpenHistory,
  onSettle,
}: FlagsListContainerProps) {
  return (
    <AnimatePresence mode="popLayout">
      {filteredFlags.map((flag, index) => (
        <motion.div
          key={flag.id}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          className="break-inside-avoid"
        >
          <FlagCard
            flag={flag}
            isMine={
              Boolean(account) &&
              String(flag.user_id || "").toLowerCase() === String(account || "").toLowerCase()
            }
            isWitnessTask={
              Boolean(viewerId) &&
              flag.status === "pending_review" &&
              flag.verification_type === "witness" &&
              String(flag.witness_id || "").toLowerCase() === viewerId.toLowerCase()
            }
            onCheckin={() => onCheckin(flag)}
            onViewHistory={() => onOpenHistory(flag)}
            onSettle={() => onSettle(flag)}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export function FlagsMainContent({
  tFlags,
  loading,
  filteredFlags,
  account,
  viewerId,
  onCreate,
  onCheckin,
  onOpenHistory,
  onSettle,
}: FlagsMainContentProps) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-8 pb-20">
      {loading ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm font-bold text-gray-400">{tFlags("state.loading")}</p>
        </div>
      ) : (
        <div className="columns-1 md:columns-2 xl:columns-3 2xl:columns-4 gap-8 space-y-8 pb-20 mx-auto">
          <FlagsCreateCard tFlags={tFlags} onCreate={onCreate} />
          <FlagsListContainer
            filteredFlags={filteredFlags}
            account={account}
            viewerId={viewerId}
            onCheckin={onCheckin}
            onOpenHistory={onOpenHistory}
            onSettle={onSettle}
          />
        </div>
      )}
    </div>
  );
}
