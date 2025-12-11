"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isBinanceWallet?: boolean;
      providers?: any[];
    };
    coinbaseWalletExtension?: any;
    BinanceChain?: any;
  }
}

type WalletType = 'metamask' | 'coinbase' | 'binance' | 'okx';

// EIP-6963 multi-wallet discovery support
interface EIP6963ProviderInfo {
  uuid?: string;
  name?: string;
  icon?: string;
  rdns?: string;
}
type EIP6963AnnounceDetail = { info: EIP6963ProviderInfo; provider: any };

// Persist discovered providers and mapping across HMR
const discoveredProviders: Array<EIP6963AnnounceDetail> = [];
const providerTypeMap: WeakMap<any, WalletType> = new WeakMap();

const walletTypeFromInfo = (info: EIP6963ProviderInfo): WalletType | null => {
  const name = (info?.name || '').toLowerCase();
  const rdns = (info?.rdns || '').toLowerCase();
  if (name.includes('metamask') || rdns.includes('metamask')) return 'metamask';
  if (name.includes('coinbase') || rdns.includes('coinbase')) return 'coinbase';
  if (name.includes('binance') || rdns.includes('binance')) return 'binance';
  if (name.includes('okx') || rdns.includes('okx')) return 'okx';
  return null;
};

const handleEIP6963Announce = (event: CustomEvent<EIP6963AnnounceDetail> | any) => {
  const detail = event?.detail as EIP6963AnnounceDetail;
  if (!detail?.provider) return;
  const exists = discoveredProviders.some(d => d.provider === detail.provider);
  if (!exists) {
    discoveredProviders.push(detail);
  }
  const mapped = walletTypeFromInfo(detail.info);
  if (mapped) {
    providerTypeMap.set(detail.provider, mapped);
  }
};

interface WalletInfo {
  type: WalletType;
  name: string;
  isAvailable: boolean;
  provider?: any; // 保存提供者引用以便后续使用
  isGeneric?: boolean; // 标记为通用钱包
}

interface WalletState {
  account: string | null;
  isConnecting: boolean;
  connectError: string | null;
  hasProvider: boolean;
  chainId: string | null;
  balanceEth: string | null;
  balanceLoading: boolean;
  currentWalletType: WalletType | null;
  availableWallets: WalletInfo[];
}

interface WalletContextType extends WalletState {
  connectWallet: (walletType?: WalletType) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  formatAddress: (addr: string) => string;
  detectWallets: () => WalletInfo[];
  identifyWalletType: (provider?: any) => WalletType | null;
  siweLogin: () => Promise<{ success: boolean; address?: string; error?: string }>;
  requestWalletPermissions: () => Promise<{ success: boolean; error?: string }>;
  multisigSign: (data?: { verifyingContract?: string; action?: string; nonce?: number }) => Promise<{ success: boolean; signature?: string; error?: string }>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const LOGOUT_FLAG = "fs_wallet_logged_out";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>({
    account: null,
    isConnecting: false,
    connectError: null,
    hasProvider: false,
    chainId: null,
    balanceEth: null,
    balanceLoading: false,
    currentWalletType: null,
    availableWallets: [],
  });

  const [mounted, setMounted] = useState(false);
  const currentProviderRef = useRef<any>(null); // 保存当前连接的 provider 引用

  const detectWallets = (): WalletInfo[] => {
    const ethereum: any = (window as any).ethereum;
    let hasMM = false, hasCB = false, hasBN = false, hasOKX = false;
    
    // 检查 providers 数组中的真实钱包
    if (ethereum?.providers) {
      ethereum.providers.forEach((provider: any) => {
        const t = identifyWalletType(provider);
        if (t === 'metamask') hasMM = true;
        else if (t === 'coinbase') hasCB = true;
        else if (t === 'binance') hasBN = true;
        else if (t === 'okx') hasOKX = true;
      });
    }
    
    // 融合 EIP-6963 发现到可用状态
    if (discoveredProviders.length > 0) {
      for (const d of discoveredProviders) {
        const mapped = providerTypeMap.get(d.provider) || walletTypeFromInfo(d.info);
        if (mapped === 'metamask') hasMM = true;
        else if (mapped === 'coinbase') hasCB = true;
        else if (mapped === 'binance') hasBN = true;
        else if (mapped === 'okx') hasOKX = true;
      }
    }

    // 检查独立注入的钱包 - 增强OKX检测
    if ((window as any).BinanceChain) hasBN = true;
    if ((window as any).coinbaseWalletExtension) hasCB = true;
    
    // OKX钱包的多种检测方式
    if ((window as any).okxwallet || 
        (window as any).okex || 
        (window as any).OKXWallet ||
        (window as any).okxWallet) {
      hasOKX = true;
    }
    
    // 如果没有 providers 但有 ethereum，检查主对象
    if (!ethereum?.providers && ethereum) {
      const t = identifyWalletType(ethereum);
      if (t === 'metamask') hasMM = true;
      else if (t === 'coinbase') hasCB = true;
      else if (t === 'binance') hasBN = true;
      else if (t === 'okx') hasOKX = true;
      // 兜底：显式属性检测
      if (ethereum.isBinanceWallet) hasBN = true;
    }
  
    const wallets: WalletInfo[] = [
      { type: 'metamask', name: 'MetaMask', isAvailable: hasMM, provider: null },
      { type: 'coinbase', name: 'Coinbase Wallet', isAvailable: hasCB, provider: null },
      { type: 'binance', name: 'Binance Wallet', isAvailable: hasBN, provider: null },
      { type: 'okx', name: 'OKX Wallet', isAvailable: hasOKX, provider: null }
    ];
    
    // 去重处理，确保每种钱包类型只出现一次
    const uniqueWallets = wallets.reduce((acc: WalletInfo[], current) => {
      const exists = acc.find(w => w.type === current.type);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);
    
    return uniqueWallets;
  };

  // 识别当前连接的钱包类型
  const identifyWalletType = (provider?: any): WalletType | null => {
    const ethereum = (window as any).ethereum;
    const p = provider || ethereum;
    if (!p) return null;
  
    // 优先使用 EIP-6963 映射
    const mapped = providerTypeMap.get(p as any);
    if (mapped) return mapped;
  
    try {
      // OKX 钱包识别 - 优先检测，因为OKX可能伪装成其他钱包
      if (p.isOkxWallet || 
          p.isOKExWallet ||
          p.isOKX ||
          (p.constructor && (
            p.constructor.name === 'OkxWalletProvider' ||
            p.constructor.name === 'OKXWallet' ||
            p.constructor.name === 'OkxWallet'
          )) ||
          // 检查全局对象引用
          (typeof window !== 'undefined' && (
            p === (window as any).okxwallet ||
            p === (window as any).okex ||
            p === (window as any).OKXWallet ||
            p === (window as any).okxWallet
          ))) {
        return 'okx';
      }
      
      // MetaMask 检测 - 更精确的识别
      if (p._metamask || 
          (p.isMetaMask && p.constructor && p.constructor.name === 'MetaMaskInpageProvider') ||
          (p.isMetaMask && typeof p._metamask !== 'undefined')) {
        return 'metamask';
      }
      
      // Coinbase 钱包识别 - 增强检测
      if (p.isCoinbaseWallet || 
          p.isCoinbaseBrowser ||
          p.selectedProvider?.isCoinbaseWallet || 
          p.provider?.isCoinbaseWallet ||
          (p.constructor && p.constructor.name === 'CoinbaseWalletProvider') ||
          p.qrUrl) {
        return 'coinbase';
      }
      
      // Binance 钱包识别 - 增强检测
      if (p.isBinanceWallet ||
          p.isBinance || 
          p.bbcSignTx ||
          (p.constructor && p.constructor.name === 'BinanceWalletProvider') ||
          (p.isMetaMask && !p._metamask && !p.isCoinbaseWallet && !p.isOkxWallet)) {
        return 'binance';
      }
      
      // 检查 provider 的 host 或 origin 信息
      if (typeof p.host === 'string') {
        const host = p.host.toLowerCase();
        if (host.includes('metamask')) return 'metamask';
        if (host.includes('coinbase')) return 'coinbase';
        if (host.includes('binance')) return 'binance';
        if (host.includes('okx')) return 'okx';
      }
      
      // 检查 provider 的 name 属性
      if (typeof p.name === 'string') {
        const name = p.name.toLowerCase();
        if (name.includes('metamask')) return 'metamask';
        if (name.includes('coinbase')) return 'coinbase';
        if (name.includes('binance')) return 'binance';
        if (name.includes('okx')) return 'okx';
      }
      
    } catch (error) {
      console.log('钱包类型识别出错:', error);
    }
    
    // 独立注入的钱包检查
    if ((window as any).BinanceChain === p || (window as any).BinanceChain) return 'binance';
    if ((window as any).coinbaseWalletExtension === p || (window as any).coinbaseWalletExtension) return 'coinbase';
    if ((window as any).okxwallet === p || (window as any).okxwallet) return 'okx';
  
    // 遍历 providers 数组进行匹配
    if (!provider && ethereum?.providers) {
      for (const pr of ethereum.providers) {
        const m = providerTypeMap.get(pr);
        if (m) return m;
        if (pr._metamask && pr.isMetaMask) return 'metamask';
        if (pr.isCoinbaseWallet) return 'coinbase';
        if (pr.isMetaMask && !pr._metamask && !pr.isCoinbaseWallet) return 'binance';
      }
    }
  
    return null;
  };

  useEffect(() => {
    setMounted(true);

    let onAnnounce: any;
    if (typeof window !== 'undefined') {
      onAnnounce = (ev: any) => {
        // 记录并更新可用钱包
        handleEIP6963Announce(ev);
        const updated = detectWallets();
        const hasProvider = !!(window as any).ethereum || !!(window as any).BinanceChain || (Array.isArray((window as any).ethereum?.providers) && (window as any).ethereum.providers.length > 0) || discoveredProviders.length > 0;
        setWalletState(prev => ({ ...prev, hasProvider, availableWallets: updated }));
      };
      window.addEventListener('eip6963:announceProvider', onAnnounce);
      window.dispatchEvent(new Event('eip6963:scan'));
      // 注入可能有延迟，稍后再刷新一次检测结果
      setTimeout(() => {
        const updated = detectWallets();
        const hasProvider = !!(window as any).ethereum || !!(window as any).BinanceChain || (Array.isArray((window as any).ethereum?.providers) && (window as any).ethereum.providers.length > 0) || discoveredProviders.length > 0;
        setWalletState(prev => ({ ...prev, hasProvider, availableWallets: updated }));
      }, 200);
    }

    const availableWallets = detectWallets();
    const hasProvider = !!(window as any).ethereum || !!(window as any).BinanceChain || (Array.isArray((window as any).ethereum?.providers) && (window as any).ethereum.providers.length > 0) || discoveredProviders.length > 0;

    setWalletState(prev => ({
      ...prev,
      hasProvider,
      availableWallets
    }));

    const checkConnection = async () => {
      try {
        const ethereum = (window as any).ethereum;
        if (ethereum) {
          const accounts = await ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            const currentWalletType = identifyWalletType(ethereum);
            setWalletState(prev => ({
              ...prev,
              account: accounts[0],
              currentWalletType,
            }));
            setupEventListeners(ethereum);
          }
        } else if ((window as any).BinanceChain) {
          try {
            const accounts = await (window as any).BinanceChain.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              const currentWalletType = 'binance';
              setWalletState(prev => ({ ...prev, account: accounts[0], currentWalletType }));
              setupEventListeners((window as any).BinanceChain);
            }
          } catch {}
        }
      } catch (error) {
        console.error('检查钱包连接失败:', error);
      }
    };

    checkConnection();

    return () => {
      if (typeof window !== 'undefined' && onAnnounce) {
        window.removeEventListener('eip6963:announceProvider', onAnnounce);
      }
    };
  }, []);

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length > 0) {
      setWalletState(prev => ({ 
        ...prev, 
        account: accounts[0] 
      }));
      // 账户切换后刷新余额
      _refreshBalance(accounts[0]);
    } else {
      // 账户被断开，清除状态
      setWalletState(prev => ({ 
        ...prev, 
        account: null,
        chainId: null,
        balanceEth: null,
        currentWalletType: null
      }));
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const setupEventListeners = (provider?: any) => {
    const ethereum = (window as any).ethereum;
    const p = provider || ethereum;
    if (p && p.on) {
      p.on('accountsChanged', handleAccountsChanged);
      p.on('chainChanged', handleChainChanged);
    }
  };

  // 根据链ID选择回退RPC URL（支持环境变量覆盖）
  const getFallbackRpcUrl = (chainIdNum?: number): string | null => {
    const env = process.env || {} as any;
    const id = Number(chainIdNum || 1);
    switch (id) {
      case 1:
        return env.NEXT_PUBLIC_RPC_MAINNET || env.NEXT_PUBLIC_RPC_ETHEREUM || env.NEXT_PUBLIC_RPC_URL || 'https://ethereum.publicnode.com';
      case 11155111:
        return env.NEXT_PUBLIC_RPC_SEPOLIA || env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.org';
      case 137:
        return env.NEXT_PUBLIC_RPC_POLYGON || env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
      case 80002:
        return env.NEXT_PUBLIC_RPC_POLYGON_AMOY || env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology';
      case 56:
        return env.NEXT_PUBLIC_RPC_BSC || env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org';
      default:
        return env.NEXT_PUBLIC_RPC_URL || null;
    }
  };

  // 内部余额刷新实现，支持覆盖地址以避免状态时序问题
  const _refreshBalance = async (addressOverride?: string) => {
    try {
      const rawProvider = currentProviderRef.current || (window as any).ethereum || (window as any).BinanceChain;
      const address = addressOverride || walletState.account;
      if (!rawProvider || !address) return;
      setWalletState(prev => ({ ...prev, balanceLoading: true }));
      const provider = new ethers.BrowserProvider(rawProvider);
      try {
        const bal = await provider.getBalance(address);
        const eth = Number(ethers.formatEther(bal));
        const display = eth >= 0.0001 ? eth.toFixed(4) : eth.toFixed(6);
        setWalletState(prev => ({ ...prev, balanceEth: display, balanceLoading: false }));
        return;
      } catch (primaryErr: any) {
        // 尝试基于网络信息进行HTTP RPC回退
        let chainIdNum: number | undefined;
        try {
          const net = await provider.getNetwork();
          chainIdNum = Number(net.chainId);
        } catch {
          try {
            const hex = await (rawProvider as any)?.request?.({ method: 'eth_chainId' });
            if (hex) chainIdNum = parseInt(String(hex), 16);
          } catch {
            // 从状态兜底
            if (walletState.chainId) {
              try { chainIdNum = parseInt(walletState.chainId, 16); } catch {}
            }
          }
        }

        const fallbackUrl = getFallbackRpcUrl(chainIdNum || 1);
        if (!fallbackUrl) {
          console.error('刷新余额失败: 未配置回退RPC URL', primaryErr);
          setWalletState(prev => ({ ...prev, balanceLoading: false }));
          return;
        }

        try {
          const httpProvider = new ethers.JsonRpcProvider(fallbackUrl);
          const bal = await httpProvider.getBalance(address);
          const eth = Number(ethers.formatEther(bal));
          const display = eth >= 0.0001 ? eth.toFixed(4) : eth.toFixed(6);
          setWalletState(prev => ({ ...prev, balanceEth: display, balanceLoading: false }));
          console.warn('BrowserProvider 失败，已使用回退 RPC 获取余额。');
          return;
        } catch (fallbackErr) {
          console.error('RPC 回退也失败:', fallbackErr);
          setWalletState(prev => ({ ...prev, balanceLoading: false }));
          return;
        }
      }
    } catch (e) {
      setWalletState(prev => ({ ...prev, balanceLoading: false }));
      console.error('刷新余额失败:', e);
    }
  };

  const connectWallet = async (walletType?: WalletType) => {
    if (!mounted) return;
  
    setWalletState(prev => ({
      ...prev,
      isConnecting: true,
      connectError: null
    }));
  
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum && !(window as any).BinanceChain) {
        throw new Error('请安装钱包扩展');
      }
  
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('eip6963:scan'));
      }
  
      let targetProvider: any = null;
  
      if (walletType) {
        // 优先使用 EIP-6963 发现的 provider
        const discovered = discoveredProviders.find(d => providerTypeMap.get(d.provider) === walletType);
        if (discovered) {
          targetProvider = discovered.provider;
        } 
        // 在 providers 数组中查找目标钱包
        else if (ethereum?.providers) {
          for (const provider of ethereum.providers) {
            const t = identifyWalletType(provider);
            if (walletType === 'metamask' && t === 'metamask') { targetProvider = provider; break; }
            if (walletType === 'coinbase' && t === 'coinbase') { targetProvider = provider; break; }
            if (walletType === 'okx' && t === 'okx') { targetProvider = provider; break; }
            if (walletType === 'binance' && (t === 'binance' || provider.isBinanceWallet)) { targetProvider = provider; break; }
          }
        }
        // 检查独立注入的钱包
        else if (walletType === 'binance' && (window as any).BinanceChain) {
          targetProvider = (window as any).BinanceChain;
        }
        else if (walletType === 'coinbase' && (window as any).coinbaseWalletExtension) {
          targetProvider = (window as any).coinbaseWalletExtension;
        }
        else if (walletType === 'okx') {
          // OKX钱包的多种检测方式
          if ((window as any).okxwallet) {
            targetProvider = (window as any).okxwallet;
          } else if ((window as any).okex) {
            targetProvider = (window as any).okex;
          } else if ((window as any).OKXWallet) {
            targetProvider = (window as any).OKXWallet;
          } else if ((window as any).okxWallet) {
            targetProvider = (window as any).okxWallet;
          }
        }
      }
      
      // 如果没有找到特定钱包，使用默认 provider
      if (!targetProvider) {
        // 对于OKX钱包，如果没有找到特定provider，尝试强制检测
        if (walletType === 'okx') {
          // 尝试触发OKX钱包的注入
          if (typeof window !== 'undefined') {
            // 等待一段时间让OKX钱包完成注入
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 再次尝试检测OKX钱包
            if ((window as any).okxwallet) {
              targetProvider = (window as any).okxwallet;
            } else if ((window as any).okex) {
              targetProvider = (window as any).okex;
            } else if ((window as any).OKXWallet) {
              targetProvider = (window as any).OKXWallet;
            } else if ((window as any).okxWallet) {
              targetProvider = (window as any).okxWallet;
            } else {
              // 如果仍然没有找到，抛出特定错误
              throw new Error('OKX钱包未安装或未正确注入。请确保已安装OKX钱包扩展程序并刷新页面。');
            }
          }
        } else {
          targetProvider = ethereum || (window as any).BinanceChain;
        }
      }

      // 验证provider是否有效
      if (!targetProvider || typeof targetProvider.request !== 'function') {
        throw new Error(`${walletType === 'okx' ? 'OKX钱包' : '钱包'}未正确初始化，请刷新页面重试。`);
      }
  
      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
  
      if (accounts && accounts.length > 0) {
        const provider = new ethers.BrowserProvider(targetProvider);
        const network = await provider.getNetwork();
        const hexChainId = (typeof network.chainId === 'bigint')
          ? '0x' + network.chainId.toString(16)
          : (ethers.toBeHex as any)?.(network.chainId) ?? ('0x' + Number(network.chainId).toString(16));
  
        const actualWalletType = identifyWalletType(targetProvider);
  
        setWalletState(prev => ({
          ...prev,
          account: accounts[0],
          chainId: hexChainId,
          isConnecting: false,
          currentWalletType: actualWalletType || walletType || null,
        }));

        // 保存当前 provider 引用
        currentProviderRef.current = targetProvider;
        setupEventListeners(targetProvider);

        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(LOGOUT_FLAG);
        }

        // 连接后立即刷新余额
        await _refreshBalance(accounts[0]);
      }
    } catch (error: any) {
      console.error('连接钱包失败:', error);
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        connectError: error.message || '连接钱包失败'
      }));
    }
  };

  const disconnectWallet = async () => {
    try {
      const currentProvider = currentProviderRef.current;
      
      // 尝试通过钱包 API 断开连接（如果支持）
      if (currentProvider) {
        try {
          // 某些钱包支持 disconnect 方法
          if (typeof currentProvider.disconnect === 'function') {
            await currentProvider.disconnect();
          }
          // 或者尝试清除权限（MetaMask 等）
          else if (typeof currentProvider.request === 'function') {
            try {
              // 尝试多种断开连接的方法
              await currentProvider.request({
                method: 'wallet_revokePermissions',
                params: [{ eth_accounts: {} }]
              });
            } catch (revokeError) {
              // 如果不支持权限撤销，尝试其他方法
              try {
                // 尝试请求断开连接
                await currentProvider.request({
                  method: 'wallet_requestPermissions',
                  params: [{ eth_accounts: {} }]
                });
              } catch (requestError) {
                console.log('钱包不支持权限管理:', requestError);
              }
            }
          }
        } catch (disconnectError) {
          console.log('钱包断开连接失败:', disconnectError);
        }
        
        // 进一步：遍历所有已注入的 providers（EIP-6963），尽可能撤销权限
        try {
          const ethereum: any = (typeof window !== 'undefined') ? (window as any).ethereum : null;
          if (ethereum?.providers && Array.isArray(ethereum.providers)) {
            for (const pr of ethereum.providers) {
              if (typeof pr?.request === 'function') {
                try {
                  await pr.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
                } catch {}
              }
              if (typeof pr?.disconnect === 'function') {
                try { await pr.disconnect(); } catch {}
              }
            }
          } else if (ethereum && typeof ethereum.request === 'function') {
            try { await ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch {}
          }
        } catch (e) {
          console.log('遍历 providers 撤销权限失败:', e);
        }
        
        // 移除事件监听器
        if (currentProvider.removeListener) {
          currentProvider.removeListener('accountsChanged', handleAccountsChanged);
          currentProvider.removeListener('chainChanged', handleChainChanged);
        } else if (currentProvider.off) {
          // 某些钱包使用 off 方法
          currentProvider.off('accountsChanged', handleAccountsChanged);
          currentProvider.off('chainChanged', handleChainChanged);
        }
      }
      
      // 强制清除所有相关的本地存储
      if (typeof window !== 'undefined') {
        // 清除常见的钱包连接状态
        try {
          localStorage.removeItem('walletconnect');
          localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
          localStorage.removeItem('-walletlink:https://www.walletlink.org:version');
          localStorage.removeItem('-walletlink:https://www.walletlink.org:session:id');
          localStorage.removeItem('-walletlink:https://www.walletlink.org:session:secret');
          localStorage.removeItem('-walletlink:https://www.walletlink.org:session:linked');
          localStorage.removeItem('coinbaseWallet.version');
          
          // 清除 MetaMask 相关状态
          sessionStorage.removeItem('metamask.selectedAddress');
          
          // 清除 Binance 相关状态
          sessionStorage.removeItem('binance.selectedAddress');
          
          // 清除 OKX 相关状态
          sessionStorage.removeItem('okx.selectedAddress');
        } catch (storageError) {
          console.log('清除存储失败:', storageError);
        }
      }
      
      // 清除应用状态
      setWalletState(prev => ({
        ...prev,
        account: null,
        chainId: null,
        balanceEth: null,
        currentWalletType: null,
      }));
      
      // 清除 provider 引用
      currentProviderRef.current = null;
      
      // 设置退出标记，防止自动重连
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(LOGOUT_FLAG, "true");
      }
      
      console.log("✅ 钱包已断开连接");
    } catch (error) {
      console.error("断开钱包连接失败:", error);
    }
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // 触发 SIWE 签名登录（第二步）
  const siweLogin = async (): Promise<{ success: boolean; address?: string; error?: string }> => {
    try {
      const rawProvider = currentProviderRef.current || (window as any).ethereum || (window as any).BinanceChain;
      if (!rawProvider) {
        return { success: false, error: '钱包 provider 不可用' };
      }

      // 使用 ethers 获取地址与网络，避免依赖状态刷新时序
      const browserProvider = new ethers.BrowserProvider(rawProvider);
      const signer = await browserProvider.getSigner();
      const signerAddress = await signer.getAddress().catch(() => null);
      const net = await browserProvider.getNetwork();
      const address = signerAddress || walletState.account;
      if (!address) return { success: false, error: '请先连接钱包' };

      // 获取 nonce
      const nonceRes = await fetch('/api/siwe/nonce', { method: 'GET' });
      const nonceJson = await nonceRes.json();
      const nonce: string = nonceJson?.nonce;
      if (!nonce) return { success: false, error: '无法获取 nonce' };

      // 组装 SIWE 消息
      const { SiweMessage } = await import('siwe');
      const chainIdNum = Number(net?.chainId?.toString?.() || walletState.chainId || '1');
      const message = new SiweMessage({
        domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
        address,
        statement: 'Welcome to Foresight! Sign to connect.',
        uri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        version: '1',
        chainId: Number.isFinite(chainIdNum) ? chainIdNum : 1,
        nonce,
      });
      const prepared = message.prepareMessage();

      // 触发签名（带降级兜底）
      let signature: string;
      try {
        signature = await signer.signMessage(prepared);
      } catch (signErr) {
        // 兼容部分钱包对 personal_sign 的参数顺序差异
        if (typeof (rawProvider as any)?.request === 'function') {
          try {
            signature = await (rawProvider as any).request({ method: 'personal_sign', params: [prepared, address] });
          } catch (_) {
            signature = await (rawProvider as any).request({ method: 'personal_sign', params: [address, prepared] });
          }
        } else {
          throw signErr;
        }
      }

      // 服务端校验
      const verifyRes = await fetch('/api/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prepared, signature, domain: typeof window !== 'undefined' ? window.location.host : undefined, uri: typeof window !== 'undefined' ? window.location.origin : undefined })
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson?.success) {
        return { success: false, error: verifyJson?.message || '签名验证失败' };
      }

      return { success: true, address };
    } catch (err: any) {
      return { success: false, error: err?.message || 'SIWE 登录失败' };
    }
  };

  // 请求钱包权限（兼容不支持权限管理的钱包）
  const requestWalletPermissions = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const provider = currentProviderRef.current || (window as any).ethereum || (window as any).BinanceChain;
      if (!provider || typeof provider.request !== 'function') {
        return { success: false, error: '钱包 provider 不可用' };
      }
      try {
        await provider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (err) {
        // 兜底：请求账户权限
        try { await provider.request({ method: 'eth_requestAccounts' }); } catch (_) {}
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '权限请求失败' };
    }
  };

  // 多签签名（EIP-712，若钱包不支持则降级为消息签名）
  const multisigSign = async (data?: { verifyingContract?: string; action?: string; nonce?: number }): Promise<{ success: boolean; signature?: string; error?: string }> => {
    try {
      const rawProvider = currentProviderRef.current || (window as any).ethereum || (window as any).BinanceChain;
      if (!rawProvider) return { success: false, error: '钱包 provider 不可用' };

      const browserProvider = new ethers.BrowserProvider(rawProvider);
      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress();
      const net = await browserProvider.getNetwork();
      const chainIdNum = Number(net?.chainId?.toString?.() || walletState.chainId || '1');
      const verifyingContract = data?.verifyingContract ?? '0x0000000000000000000000000000000000000000';
      const nonce = data?.nonce ?? Date.now();
      const message = { action: data?.action ?? 'multisig-approve', nonce, timestamp: Math.floor(Date.now() / 1000) };

      const typedData = {
        domain: { name: 'Foresight MultiSig', version: '1', chainId: chainIdNum, verifyingContract },
        types: {
          Approve: [
            { name: 'action', type: 'string' },
            { name: 'nonce', type: 'uint256' },
            { name: 'timestamp', type: 'uint64' }
          ]
        },
        primaryType: 'Approve',
        message
      } as const;

      let signature: string;
      try {
        signature = await (rawProvider as any).request({ method: 'eth_signTypedData_v4', params: [address, JSON.stringify(typedData)] });
      } catch (err) {
        // 降级：普通消息签名
        try {
          signature = await signer.signMessage(JSON.stringify({ type: 'Approve', ...message }));
        } catch (e) {
          return { success: false, error: (e as any)?.message || '签名失败' };
        }
      }
      return { success: true, signature };
    } catch (err: any) {
      return { success: false, error: err?.message || '多签签名失败' };
    }
  };

  const contextValue: WalletContextType = {
    ...walletState,
    connectWallet,
    disconnectWallet,
    formatAddress,
    detectWallets,
    identifyWalletType,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
    refreshBalance: () => _refreshBalance(),
  };

  if (!mounted) {
    return null;
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
