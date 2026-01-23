"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotificationsLogic } from "./hooks/useNotificationsLogic";
import { useMenuState } from "./hooks/useMenuState";
import { useWalletNavLogic } from "./hooks/useWalletNavLogic";

export function useTopNavBarLogic() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 菜单状态管理
  const menuState = useMenuState();

  // 钱包导航逻辑
  const walletNav = useWalletNavLogic(mounted, menuState.setMenuOpen, menuState.setWalletSelectorOpen);

  // 计算 viewerId
  const viewerId = useMemo(() => String(walletNav.account || "").toLowerCase(), [walletNav.account]);

  // 通知逻辑
  const notifications = useNotificationsLogic(viewerId);

  return {
    // 钱包相关
    account: walletNav.account,
    isConnecting: walletNav.isConnecting,
    connectError: walletNav.connectError,
    hasProvider: walletNav.hasProvider,
    chainId: walletNav.chainId,
    balanceEth: walletNav.balanceEth,
    balanceLoading: walletNav.balanceLoading,
    refreshBalance: walletNav.refreshBalance,
    connectWallet: walletNav.connectWallet,
    disconnectWallet: walletNav.disconnectWallet,
    formatAddress: walletNav.formatAddress,
    availableWallets: walletNav.availableWallets,
    currentWalletType: walletNav.currentWalletType,
    switchNetwork: walletNav.switchNetwork,
    user: walletNav.user,
    authLoading: walletNav.authLoading,
    signOut: walletNav.signOut,
    userProfile: walletNav.userProfile,
    tWallet: walletNav.tWallet,
    tAuth: walletNav.tAuth,
    tCommon: walletNav.tCommon,
    copied: walletNav.copied,
    showBalance: walletNav.showBalance,
    setShowBalance: walletNav.setShowBalance,
    walletModalOpen: walletNav.walletModalOpen,
    setWalletModalOpen: walletNav.setWalletModalOpen,
    handleConnectWallet: walletNav.handleConnectWallet,
    handleDisconnectWallet: walletNav.handleDisconnectWallet,
    copyAddress: walletNav.copyAddress,
    networkName: walletNav.networkName,
    walletTypeLabel: walletNav.walletTypeLabel,
    isSepolia: walletNav.isSepolia,
    explorerBase: walletNav.explorerBase,
    updateNetworkInfo: walletNav.updateNetworkInfo,
    openOnExplorer: walletNav.openOnExplorer,
    switchToSepolia: walletNav.switchToSepolia,
    modal: walletNav.modal,

    // 菜单状态
    mounted,
    menuOpen: menuState.menuOpen,
    setMenuOpen: menuState.setMenuOpen,
    walletSelectorOpen: menuState.walletSelectorOpen,
    setWalletSelectorOpen: menuState.setWalletSelectorOpen,
    handleWalletSelectorToggle: menuState.handleWalletSelectorToggle,
    menuRef: menuState.menuRef,
    walletSelectorRef: menuState.walletSelectorRef,
    avatarRef: menuState.avatarRef,
    menuContentRef: menuState.menuContentRef,
    walletButtonRef: menuState.walletButtonRef,
    menuPos: menuState.menuPos,
    walletSelectorPos: menuState.walletSelectorPos,

    // 通知相关
    notifications: notifications.notifications,
    notificationsCount: notifications.notificationsCount,
    notificationsOpen: notifications.notificationsOpen,
    setNotificationsOpen: notifications.setNotificationsOpen,
    handleNotificationsToggle: notifications.handleNotificationsToggle,
    notificationsLoading: notifications.notificationsLoading,
    notificationsError: notifications.notificationsError,
    notificationsHasMore: notifications.notificationsHasMore,
    handleLoadMoreNotifications: notifications.handleLoadMoreNotifications,
    handleReloadNotifications: notifications.handleReloadNotifications,
    handleMarkAllNotificationsRead: notifications.handleMarkAllNotificationsRead,
    markAllNotificationsLoading: notifications.markAllNotificationsLoading,
    handleArchiveNotification: notifications.handleArchiveNotification,
    archiveNotificationIdLoading: notifications.archiveNotificationIdLoading,
    handleArchiveAllNotifications: notifications.handleArchiveAllNotifications,
    archiveAllNotificationsLoading: notifications.archiveAllNotificationsLoading,
    notificationsFilter: notifications.notificationsFilter,
    setNotificationsFilter: notifications.setNotificationsFilter,
  };
}

export type TopNavBarState = ReturnType<typeof useTopNavBarLogic>;
