import { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { fetchUsernamesByAddresses, getDisplayName } from "@/lib/userProfiles";
import { formatAddress } from "@/lib/address";
import { useForumList } from "./useForumList";

export function useForumData() {
  const { address } = useWallet();
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const fetchedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!address || fetchedRef.current) return;
    fetchedRef.current = true;

    const run = async () => {
      const res = await fetchUsernamesByAddresses([address]);
      if (res && Object.keys(res).length > 0) {
        setNameMap((prev) => ({ ...prev, ...res }));
      }
    };
    run();
  }, [address]);

  const {
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    filtered,
    loading,
    loadingMore,
    error,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
    hasNextPage,
    loadMore,
    total,
    refetch,
    // 实时更新
    newCount,
    resetNewCount,
    refreshAndReset,
    isConnected,
    // 滚动位置
    saveScrollPosition,
    getSavedScrollPosition,
  } = useForumList();

  // 使用 useCallback 避免每次渲染创建新函数
  const displayName = useCallback(
    (addr: string) => getDisplayName(addr, nameMap, formatAddress),
    [nameMap]
  );

  return {
    address,
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    filtered,
    loading,
    loadingMore,
    error,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
    displayName,
    // 无限滚动相关
    hasNextPage,
    loadMore,
    total,
    refetch,
    // 实时更新相关
    newCount,
    resetNewCount,
    refreshAndReset,
    isConnected,
    // 滚动位置
    saveScrollPosition,
    getSavedScrollPosition,
  };
}
