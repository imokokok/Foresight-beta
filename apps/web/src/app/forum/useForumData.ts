import { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { fetchUsernamesByAddresses, getDisplayName } from "@/lib/userProfiles";
import { useForumList } from "./useForumList";

export function useForumData() {
  const { account, formatAddress } = useWallet();
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!account) return;
    const run = async () => {
      const res = await fetchUsernamesByAddresses([account]);
      if (res && Object.keys(res).length > 0) {
        setNameMap((prev) => ({ ...prev, ...res }));
      }
    };
    run();
  }, [account]);

  const {
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    filtered,
    loading,
    error,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
  } = useForumList();

  const displayName = (addr: string) => getDisplayName(addr, nameMap, formatAddress);

  return {
    account,
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    filtered,
    loading,
    error,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
    displayName,
  };
}
