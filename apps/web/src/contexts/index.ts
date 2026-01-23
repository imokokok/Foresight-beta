"use client";
import React, { ReactNode } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { WalletProvider, useWallet } from "./WalletContext";
import { UserProvider, useUser } from "./UserContext";

interface AppProviderProps {
  children: ReactNode;
}

function useAuthStore() {
  return useAuth();
}

function useWalletStore() {
  return useWallet();
}

function useUserStore() {
  return useUser();
}

export {
  AuthProvider,
  WalletProvider,
  UserProvider,
  useAuth,
  useWallet,
  useUser,
  useAuthStore,
  useWalletStore,
  useUserStore,
};

export function AppProvider({ children }: AppProviderProps) {
  return (
    <AuthProvider>
      <WalletProvider>
        <UserProvider>{children}</UserProvider>
      </WalletProvider>
    </AuthProvider>
  );
}

export function useAppStores() {
  const auth = useAuth();
  const wallet = useWallet();
  const user = useUser();

  return {
    auth,
    wallet,
    user,
    isAuthenticated: auth.isAuthenticated && wallet.isConnected,
  };
}
