"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, ArrowUp, MessageSquare, ArrowRightCircle } from "lucide-react";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { getFollowStatus, toggleFollowPrediction } from "@/lib/follows";
import { supabase } from "@/lib/supabase";
import ChatPanel from "@/components/ChatPanel";
import ForumSection from "@/components/ForumSection";


interface PredictionDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  deadline: string;
  minStake: number;
  criteria: string;
  referenceUrl: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  stats: {
    yesAmount: number;
    noAmount: number;
    totalAmount: number;
    participantCount: number;
    yesProbability: number;
    noProbability: number;
    betCount: number;
  };
  timeInfo: {
    createdAgo: string;
    deadlineIn: string;
    isExpired: boolean;
  };
}

export default function PredictionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [entered, setEntered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [staking, setStaking] = useState(false);
  const [stakeError, setStakeError] = useState<string | null>(null);
  const [stakeSuccess, setStakeSuccess] = useState<string | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guideVariant, setGuideVariant] = useState<'A' | 'B'>('A');
  const [market, setMarket] = useState<{ market: string; chain_id: number; collateral_token?: string; tick_size?: number } | null>(null);
  const [manualMarket, setManualMarket] = useState<string>('');
  const [manualChainId, setManualChainId] = useState<string>('');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [tradeOutcome, setTradeOutcome] = useState<number>(0);
  const [priceInput, setPriceInput] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [expiryInput, setExpiryInput] = useState<string>('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [depthBuy, setDepthBuy] = useState<Array<{ price: string; qty: string }>>([]);
  const [depthSell, setDepthSell] = useState<Array<{ price: string; qty: string }>>([]);
  const [selectedPrice, setSelectedPrice] = useState<string | null>(null);
  const [queueRows, setQueueRows] = useState<any[]>([]);
  const [orderMode, setOrderMode] = useState<'limit' | 'best'>('limit');
  const [bestBid, setBestBid] = useState<string>('');
  const [bestAsk, setBestAsk] = useState<string>('');
  const [midPrice, setMidPrice] = useState<string>('');
  const [openOrders, setOpenOrders] = useState<any[]>([]);

  // 关注功能相关状态
  const { account, connectWallet, siweLogin } = useWallet();
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPredictionDetail = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/predictions/${params.id}?includeStats=0`);
        const contentType = response.headers.get("content-type") || "";
        let result: any = null;
        try {
          if (contentType.includes("application/json")) {
            result = await response.json();
          } else {
            throw new Error(`Unexpected content-type: ${contentType}`);
          }
        } catch (e) {
          console.error("解析响应失败:", e);
          setError("数据解析失败");
          return;
        }

        if (result.success) {
          setPrediction(result.data);
          (async () => {
            try {
              const resp2 = await fetch(`/api/predictions/${params.id}?includeStats=1`);
              if (!resp2.ok) return;
              const res2 = await resp2.json();
              if (res2?.success && res2?.data?.stats) {
                setPrediction(prev => prev ? {
                  ...prev,
                  stats: res2.data.stats,
                  timeInfo: res2.data.timeInfo || prev.timeInfo
                } : prev);
              }
            } catch {}
          })();
        } else {
          setError(result.message || "获取预测事件详情失败");
        }
      } catch (err) {
        setError("网络请求失败");
        console.error("获取预测事件详情失败:", err);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchPredictionDetail();
    }
  }, [params.id]);

  useEffect(() => {
    const loadMarket = async () => {
      try {
        const resp = await fetch(`/api/markets/map?id=${params.id}`)
        if (!resp.ok) return
        const j = await resp.json()
        if (j?.success && j?.data) setMarket(j.data)
      } catch {}
    }
    loadMarket()
  }, [params.id])

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const m = market || (manualMarket && manualChainId ? { market: manualMarket, chain_id: Number(manualChainId) } as any : null)
        if (!m) return
        const base = process.env.NEXT_PUBLIC_RELAYER_URL || ''
        if (!base) return
        const u1 = `${base}/orderbook/depth?contract=${m.market}&chainId=${m.chain_id}&outcome=${tradeOutcome}&side=${true}&levels=10`
        const u2 = `${base}/orderbook/depth?contract=${m.market}&chainId=${m.chain_id}&outcome=${tradeOutcome}&side=${false}&levels=10`
        const r1 = await fetch(u1)
        const r2 = await fetch(u2)
        const j1 = await r1.json().catch(() => ({}))
        const j2 = await r2.json().catch(() => ({}))
        if (j1?.data) setDepthBuy(j1.data)
        if (j2?.data) setDepthSell(j2.data)
        const bb = (j1?.data && j1.data.length) ? j1.data[0].price : ''
        const ba = (j2?.data && j2.data.length) ? j2.data[0].price : ''
        setBestBid(bb || '')
        setBestAsk(ba || '')
        if (bb && ba) {
          const mid = (BigInt(bb) + BigInt(ba)) / BigInt(2)
          setMidPrice(mid.toString())
        } else {
          setMidPrice('')
        }
      } catch {}
    }, 2000)
    return () => clearInterval(t)
  }, [market?.market, market?.chain_id, manualMarket, manualChainId])
  
  // 渲染选项切换（根据详情接口 includeOutcomes 返回）
  useEffect(() => {
    // 初始 outcome 兜底：若存在 outcomes，则设为 0
    if (prediction && (prediction as any)?.outcomes && Array.isArray((prediction as any).outcomes)) {
      setTradeOutcome(0)
    }
  }, [prediction?.id])

  useEffect(() => {
    const loadQueue = async () => {
      try {
        const m = market || (manualMarket && manualChainId ? { market: manualMarket, chain_id: Number(manualChainId) } as any : null)
        if (!m || !selectedPrice) return
        const base = process.env.NEXT_PUBLIC_RELAYER_URL || ''
        if (!base) return
        const u = `${base}/orderbook/queue?contract=${m.market}&chainId=${m.chain_id}&outcome=${tradeOutcome}&side=${tradeSide === 'buy'}&price=${selectedPrice}&limit=50&offset=0`
        const r = await fetch(u)
        const j = await r.json().catch(() => ({}))
        if (j?.data) setQueueRows(j.data)
      } catch {}
    }
    loadQueue()
  }, [market?.market, market?.chain_id, manualMarket, manualChainId, selectedPrice, tradeOutcome, tradeSide])

  useEffect(() => {
    const loadOpenOrders = async () => {
      try {
        const m = market || (manualMarket && manualChainId ? { market: manualMarket, chain_id: Number(manualChainId) } as any : null)
        if (!m || !account) return
        if (!supabase) return
        const { data, error } = await (supabase as any)
          .from('orders')
          .select('id, maker_salt, price, remaining, outcome_index, is_buy, status, created_at')
          .eq('verifying_contract', String(m.market).toLowerCase())
          .eq('chain_id', Number(m.chain_id))
          .eq('maker_address', String(account).toLowerCase())
          .in('status', ['open', 'filled_partial'])
          .order('created_at', { ascending: false })
        if (!error && Array.isArray(data)) setOpenOrders(data)
      } catch {}
    }
    loadOpenOrders()
  }, [market?.market, market?.chain_id, manualMarket, manualChainId, account])

  // 将当前查看的事件写入最近浏览（供热门页侧边栏展示）
  useEffect(() => {
    if (!prediction) return;
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("recent_events")
          : null;
      const arr = raw ? JSON.parse(raw) : [];
      const item = {
        id: prediction.id,
        title: prediction.title,
        category: prediction.category,
        seen_at: new Date().toISOString(),
      };
      const dedup = Array.isArray(arr)
        ? arr.filter((x: any) => Number(x?.id) !== Number(prediction.id))
        : [];
      const next = [item, ...dedup].slice(0, 10);
      window.localStorage.setItem("recent_events", JSON.stringify(next));
    } catch {}
  }, [prediction?.id]);

  useEffect(() => {
    // 设置页面进入动画状态
    setEntered(true);

    const onScroll = () => {
      if (typeof window !== "undefined") {
        setShowScrollTop(window.scrollY > 200);
      }
    };
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    router.prefetch("/trending");
  }, [router]);

  useEffect(() => {
    try {
      const key = 'guide_variant';
      const cached = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (cached === 'A' || cached === 'B') {
        setGuideVariant(cached as 'A' | 'B');
      } else {
        const v = Math.random() < 0.5 ? 'A' : 'B';
        setGuideVariant(v);
        if (typeof window !== 'undefined') window.localStorage.setItem(key, v);
      }
    } catch {}
  }, []);

  const handleGuideClick = async () => {
    try {
      setGuideLoading(true);
      setGuideError(null);
      const eventId = Number(params.id);
      const url = `/forum?id=${eventId}`;
      try {
        const payload = JSON.stringify({ eventId, variant: guideVariant, ts: Date.now() });
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/analytics/guide-click', blob);
        } else {
          await fetch('/api/analytics/guide-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        }
      } catch {}
      router.push(url);
    } catch (e: any) {
      setGuideError(String(e?.message || e || '跳转失败'));
    } finally {
      setGuideLoading(false);
    }
  };

  // 获取关注状态和数量
  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (!params.id) return;

      try {
        setFollowError(null);
        // 添加错误处理和重试逻辑
        let retries = 3;
        let status;

        while (retries > 0) {
          try {
            status = await getFollowStatus(
              Number(params.id),
              account || undefined
            );
            break;
          } catch (err) {
            console.warn(
              `获取关注状态尝试失败，剩余重试次数: ${retries - 1}`,
              err
            );
            retries--;
            if (retries === 0) throw err;
            await new Promise((r) => setTimeout(r, 500)); // 重试前等待500ms
          }
        }

        if (status) {
          setFollowing(!!status.following);
          setFollowersCount(status.followersCount);
        }
      } catch (error) {
        console.error("获取关注状态失败:", error);
        setFollowError("获取关注状态失败");
        // 设置默认值，避免UI显示错误
        setFollowing(false);
        setFollowersCount(0);
      }
    };

    fetchFollowStatus();
  }, [params.id, account]);

  // Supabase Realtime 订阅：针对当前预测事件的关注插入/删除，实时更新 followersCount 与 following
  useEffect(() => {
    const eid = Number(params.id);
    if (!Number.isFinite(eid)) return;
    if (!supabase || typeof (supabase as any).channel !== 'function') return;

    const filterEq = `event_id=eq.${eid}`;
    const channel = (supabase as any).channel(`event_follows_detail_${eid}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_follows",
          filter: filterEq,
        },
        (payload: any) => {
          const uid = String((payload?.new || {}).user_id || "");
          // 非当前用户的插入，计数 +1；当前用户则同步 following 状态（避免与本地乐观重复叠加）
          if (!account || uid !== account) {
            setFollowersCount((c) => c + 1);
          }
          if (account && uid === account) {
            setFollowing(true);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "event_follows",
          filter: filterEq,
        },
        (payload: any) => {
          const uid = String((payload?.old || {}).user_id || "");
          if (!account || uid !== account) {
            setFollowersCount((c) => Math.max(0, c - 1));
          }
          if (account && uid === account) {
            setFollowing(false);
          }
        }
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [params.id, account]);

  // 处理关注/取消关注
  const handleToggleFollow = async () => {
    if (!account) {
      try {
        await connectWallet();
        await siweLogin();
      } catch (error) {
        setFollowError("钱包连接失败");
      }
      return;
    }

    setFollowLoading(true);
    setFollowError(null);

    try {
      const addr = account.toLowerCase();
      const newFollowing = await toggleFollowPrediction(
        following,
        Number(params.id),
        addr
      );
      setFollowing(newFollowing);

      // 重新获取关注数量
      const status = await getFollowStatus(Number(params.id), addr);
      setFollowersCount(status.followersCount);
    } catch (error) {
      console.error("关注操作失败:", error);
      const msg =
        error instanceof Error
          ? error.message || "操作失败，请重试"
          : "操作失败，请重试";
      setFollowError(msg);
    } finally {
      setFollowLoading(false);
    }
  };

  // ERC20/合约 ABI（最小化）
  const erc20Abi = [
    "function decimals() view returns (uint8)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 value) returns (bool)",
  ];
  const foresightAbi = [
    "function getPredictionCount() view returns (uint256)",
    "function stake(uint256 _predictionId, uint256 _option, uint256 amount)",
  ];

  // 地址解析（基于 chainId）
  function resolveAddresses(chainId: number): {
    foresight: string;
    usdt: string;
  } {
    const env = process.env as Record<string, string | undefined>;

    const defaultForesight = (env.NEXT_PUBLIC_FORESIGHT_ADDRESS || "").trim();
    const defaultUsdt = (env.NEXT_PUBLIC_USDT_ADDRESS || "").trim();

    const map: Record<number, { foresight?: string; usdt?: string }> = {
      137: {
        foresight: env.NEXT_PUBLIC_FORESIGHT_ADDRESS_POLYGON,
        usdt: env.NEXT_PUBLIC_USDT_ADDRESS_POLYGON,
      },
      80002: {
        foresight: env.NEXT_PUBLIC_FORESIGHT_ADDRESS_AMOY,
        usdt: env.NEXT_PUBLIC_USDT_ADDRESS_AMOY,
      },
      11155111: {
        foresight: env.NEXT_PUBLIC_FORESIGHT_ADDRESS_SEPOLIA,
        usdt: env.NEXT_PUBLIC_USDT_ADDRESS_SEPOLIA,
      },
      31337: {
        foresight: env.NEXT_PUBLIC_FORESIGHT_ADDRESS_LOCALHOST,
        usdt: env.NEXT_PUBLIC_USDT_ADDRESS_LOCALHOST,
      },
    };

    const fromMap = map[chainId] || {};
    const foresight = (fromMap.foresight || defaultForesight || "").trim();
    const usdt = (fromMap.usdt || defaultUsdt || "").trim();

    return { foresight, usdt };
  }

  // 将任意小数按指定 decimals 转为最小单位 BigInt
  function parseUnitsByDecimals(
    value: number | string,
    decimals: number
  ): bigint {
    const str = typeof value === "number" ? String(value) : value;
    try {
      return ethers.parseUnits(str, decimals);
    } catch {
      // 兜底处理，避免浮点误差
      const parts = str.split(".");
      if (parts.length === 1) {
        return BigInt(parts[0]) * BigInt(10) ** BigInt(decimals);
      }
      const [intPart, fracRaw] = parts;
      const frac = (fracRaw || "").slice(0, decimals).padEnd(decimals, "0");
      return (
        BigInt(intPart || "0") * BigInt(10) ** BigInt(decimals) +
        BigInt(frac || "0")
      );
    }
  }

  async function submitOrder() {
    try {
      setOrderMsg(null)
      setOrderSubmitting(true)
      const m = market || (manualMarket && manualChainId ? { market: manualMarket, chain_id: Number(manualChainId) } as any : null)
      if (!m) throw new Error('未配置市场')
      if (!prediction) throw new Error('预测事件未加载')
      if (typeof window === 'undefined' || !(window as any).ethereum) throw new Error('请先连接钱包')
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const accountAddr = await signer.getAddress()
      const net = await provider.getNetwork()
      const chainIdNum = Number(net.chainId)
      const outcomeIndex = tradeOutcome
      const isBuy = tradeSide === 'buy'
      let priceDec = Number(priceInput || '0')
      if (orderMode === 'best') {
        const target = tradeSide === 'buy' ? bestAsk : bestBid
        if (!target) throw new Error('缺少盘口数据')
        priceDec = Number(ethers.formatUnits(BigInt(target), 6))
      }
      const amountDec = Number(amountInput || '0')
      if (!Number.isFinite(priceDec) || priceDec <= 0) throw new Error('价格不合法')
      if (!Number.isFinite(amountDec) || amountDec <= 0) throw new Error('数量不合法')
      const { usdt } = resolveAddresses(chainIdNum)
      if (!usdt) throw new Error('未配置USDT地址')
      const token = new ethers.Contract(usdt, erc20Abi, signer)
      let decimals = 6
      try { decimals = await token.decimals() } catch {}
      const price = parseUnitsByDecimals(priceDec, Number(decimals))
      const amount = BigInt(Math.floor(amountDec))
      const expirySec = expiryInput ? BigInt(Math.floor(Number(expiryInput))) : BigInt(0)
      const salt = BigInt(String(Date.now()))
      const domain = { name: 'CLOBMarket', version: '1', chainId: chainIdNum, verifyingContract: m.market }
      const types = { OrderRequest: [
        { name: 'maker', type: 'address' },
        { name: 'outcomeIndex', type: 'uint256' },
        { name: 'isBuy', type: 'bool' },
        { name: 'price', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
        { name: 'salt', type: 'uint256' },
      ] } as const
      const message = { maker: accountAddr, outcomeIndex, isBuy, price, amount, expiry: expirySec, salt }
      const signature = await signer.signTypedData(domain as any, types as any, message as any)
      const base = process.env.NEXT_PUBLIC_RELAYER_URL || ''
      if (!base) throw new Error('未配置撮合服务')
      const body = { chainId: chainIdNum, verifyingContract: m.market, order: { maker: accountAddr, outcomeIndex, isBuy, price: price.toString(), amount: amount.toString(), expiry: expirySec.toString(), salt: salt.toString() }, signature }
      const resp = await fetch(`${base}/orderbook/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(j?.detail || j?.message || '下单失败')
      setOrderMsg('下单成功')
    } catch (e: any) {
      setOrderMsg(e?.message || '下单失败')
    } finally {
      setOrderSubmitting(false)
    }
  }

  async function fillOrder(row: any) {
    try {
      setOrderMsg(null)
      const m = market || (manualMarket && manualChainId ? { market: manualMarket, chain_id: Number(manualChainId) } as any : null)
      if (!m) throw new Error('未配置市场')
      if (typeof window === 'undefined' || !(window as any).ethereum) throw new Error('请先连接钱包')
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const base = process.env.NEXT_PUBLIC_RELAYER_URL || ''
      const d = await fetch(`/api/orderbook/order?id=${row.id}`)
      const j = await d.json()
      const ord = j?.data
      if (!ord) throw new Error('订单不存在')
      const types = { OrderRequest: [
        { name: 'maker', type: 'address' },
        { name: 'outcomeIndex', type: 'uint256' },
        { name: 'isBuy', type: 'bool' },
        { name: 'price', type: 'uint256' },
        { name: 'amount', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
        { name: 'salt', type: 'uint256' },
      ] } as const
      const marketContract = new ethers.Contract(m.market, [
        'function fillOrderSigned((address,uint256,bool,uint256,uint256,uint256,uint256),bytes,uint256)'
      ], signer)
      const req = [
        ord.maker_address,
        Number(ord.outcome_index),
        Boolean(ord.is_buy),
        BigInt(ord.price),
        BigInt(ord.amount),
        ord.expiry ? BigInt(Math.floor(new Date(String(ord.expiry)).getTime() / 1000)) : BigInt(0),
        BigInt(ord.maker_salt)
      ]
      const desired = amountInput ? BigInt(Math.floor(Number(amountInput))) : BigInt(0)
      const remaining = BigInt(ord.remaining)
      const fillAmount = desired > BigInt(0) ? (desired > remaining ? remaining : desired) : remaining
      if (!Boolean(ord.is_buy)) {
        const { usdt } = resolveAddresses(Number(ord.chain_id))
        if (!usdt) throw new Error('未配置USDT地址')
        const token = new ethers.Contract(usdt, erc20Abi, signer)
        const accountAddr = await signer.getAddress()
        const price = BigInt(ord.price)
        const need = fillAmount * price
        const allowance: bigint = await token.allowance(accountAddr, m.market)
        if (allowance < need) {
          const tx = await token.approve(m.market, need)
          await tx.wait()
        }
      }
      const tx = await marketContract.fillOrderSigned(req as any, ord.signature, fillAmount)
      await tx.wait()
      setOrderMsg('成交成功')
    } catch (e: any) {
      setOrderMsg(e?.message || '成交失败')
    }
  }

  async function cancelOrderSalt(row: any) {
    try {
      setOrderMsg(null)
      const m = market || (manualMarket && manualChainId ? { market: manualMarket, chain_id: Number(manualChainId) } as any : null)
      if (!m) throw new Error('未配置市场')
      if (typeof window === 'undefined' || !(window as any).ethereum) throw new Error('请先连接钱包')
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      const chain = await provider.getNetwork()
      const chainIdNum = Number(chain.chainId)
      const base = process.env.NEXT_PUBLIC_RELAYER_URL || ''
      const typesResp = await fetch(`${base}/orderbook/types`)
      const typesJson = await typesResp.json().catch(()=>({}))
      const types = typesJson?.types || { CancelSaltRequest: [ { name: 'maker', type: 'address' }, { name: 'salt', type: 'uint256' } ] }
      const domain = { name: 'CLOBMarket', version: '1', chainId: chainIdNum, verifyingContract: m.market }
      const message = { maker: addr, salt: BigInt(row.maker_salt) }
      const signature = await signer.signTypedData(domain as any, { CancelSaltRequest: types.CancelSaltRequest } as any, message as any)
      const payload = { chainId: chainIdNum, verifyingContract: m.market, maker: addr, salt: BigInt(row.maker_salt).toString(), signature }
      const resp = await fetch(`${base}/orderbook/cancel-salt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await resp.json().catch(()=>({}))
      if (!resp.ok) throw new Error(j?.detail || j?.message || '取消失败')
      setOrderMsg('取消成功')
      const fresh = openOrders.filter((x)=> String(x.maker_salt) !== String(row.maker_salt))
      setOpenOrders(fresh)
    } catch (e: any) {
      setOrderMsg(e?.message || '取消失败')
    }
  }

  const handleStake = async (option: "yes" | "no") => {
    try {
      setStakeError(null);
      setStakeSuccess(null);
      setStaking(true);

      if (!prediction) throw new Error("预测事件未加载");
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("请先连接钱包");
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const chainIdNum = Number(network.chainId);
      const { foresight, usdt } = resolveAddresses(chainIdNum);
      if (!foresight || !usdt) {
        throw new Error("未配置当前网络的合约或USDT地址");
      }

      const account = await signer.getAddress();
      const token = new ethers.Contract(usdt, erc20Abi, signer);
      let decimals = 6;
      try {
        decimals = await token.decimals();
      } catch {}
      const amount = parseUnitsByDecimals(
        prediction.minStake,
        Number(decimals)
      );

      // 先检查并授权
      const allowance: bigint = await token.allowance(account, foresight);
      if (allowance < amount) {
        const txApprove = await token.approve(foresight, amount);
        await txApprove.wait();
      }

      // 确认链上预测是否存在（默认使用 off-chain 的 id 作为链上 id）
      const foresightContract = new ethers.Contract(
        foresight,
        foresightAbi,
        signer
      );
      const count: bigint = await foresightContract.getPredictionCount();
      if (BigInt(prediction.id) >= count) {
        throw new Error("该事件尚未在链上创建，暂不可押注");
      }

      // 选项映射：yes -> 1, no -> 0
      const optionIndex = option === "yes" ? 1 : 0;
      const txStake = await foresightContract.stake(
        prediction.id,
        optionIndex,
        amount
      );
      const receipt = await txStake.wait();

      setStakeSuccess(`押注成功，交易哈希：${receipt?.hash || ""}`);
    } catch (e: any) {
      setStakeError(e?.message || "押注失败");
    } finally {
      setStaking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载预测事件详情中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">加载失败</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            预测事件不存在
          </h2>
          <p className="text-gray-600">请检查事件ID是否正确</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
        <div
          className={`max-w-4xl mx-auto transition-all duration-200 ease-out ${
            entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
          }`}
        >
          {/* 返回按钮 */}
          <button
            type="button"
            aria-label="返回上一页"
            title="返回上一页"
            onClick={() => {
              const hasHistory =
                typeof window !== "undefined" &&
                window.history &&
                window.history.length > 1;
              const sameOriginReferrer =
                typeof document !== "undefined" &&
                document.referrer &&
                (() => {
                  try {
                    const ref = new URL(document.referrer);
                    return ref.origin === window.location.origin;
                  } catch {
                    return false;
                  }
                })();
              startTransition(() => {
                if (hasHistory && sameOriginReferrer) {
                  router.back();
                } else {
                  router.push("/trending");
                }
              });
            }}
            disabled={isPending}
            className="mb-6 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/60 backdrop-blur-md border border-gray-200 text-gray-700 hover:text-gray-800 hover:bg-white/75 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
            <span className="text-sm font-medium">
              {isPending ? "返回中…" : "返回"}
            </span>
          </button>

          {/* 预测事件卡片 - 与creating预览保持一致 */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 overflow-hidden">
            {/* 卡片头部 - 渐变背景 */}
            <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">
                      {prediction.category === "科技"
                        ? "🚀"
                        : prediction.category === "娱乐"
                        ? "🎬"
                        : prediction.category === "时政"
                        ? "🏛️"
                        : prediction.category === "天气"
                        ? "🌤️"
                        : "📊"}
                    </span>
                    <span className="text-sm font-medium bg-white/20 px-2 py-1 rounded-full">
                      {prediction.category}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      prediction.status === "active"
                        ? "bg-green-100/20 text-green-100"
                        : prediction.status === "completed"
                        ? "bg-blue-100/20 text-blue-100"
                        : "bg-gray-100/20 text-gray-100"
                    }`}
                  >
                    {prediction.status === "active"
                      ? "进行中"
                      : prediction.status === "completed"
                      ? "已结束"
                      : "已取消"}
                  </span>
                </div>
                <h1 className="text-2xl font-bold leading-tight">
                  {prediction.title}
                </h1>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm text-white/90">
                    关注数 {followersCount}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className="px-2.5 py-1 rounded-full text-sm font-medium bg-white/20 hover:bg-white/30 text-white disabled:opacity-60"
                  >
                    {followLoading ? "处理中…" : following ? "已关注" : "关注"}
                  </button>
                  {followError && (
                    <span className="text-xs text-yellow-200">
                      {followError}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 卡片内容 */}
            <div className="p-6">
              {/* 时间信息 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center text-sm text-gray-600">
                  <svg
                    className="w-4 h-4 mr-2 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>创建于 {prediction.timeInfo.createdAgo}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <svg
                    className="w-4 h-4 mr-2 text-yellow-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                  <span
                    className={
                      prediction.timeInfo.isExpired
                        ? "text-red-600"
                        : "text-orange-600"
                    }
                  >
                    {prediction.timeInfo.deadlineIn}
                  </span>
                </div>
              </div>

              {/* 描述 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">
                  事件描述
                </h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {prediction.description}
                </p>
              </div>

              {/* 判断标准 */}
              <div className="p-4 bg-gray-50 rounded-lg mb-6">
                <div className="flex items-center mb-2">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-gray-600">
                    判断标准
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {prediction.criteria}
                </p>
              </div>

              {/* 参考链接 */}
              {prediction.referenceUrl && (
                <div className="mb-6">
                  <a
                    href={prediction.referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    参考链接
                  </a>
                </div>
              )}

              {/* 押注统计 */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">
                  押注统计
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {prediction.stats.participantCount}
                    </div>
                    <div className="text-sm text-gray-600">参与人数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {prediction.stats.betCount}
                    </div>
                    <div className="text-sm text-gray-600">押注次数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {prediction.stats.totalAmount.toFixed(2)} USDT
                    </div>
                    <div className="text-sm text-gray-600">总押注金额</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {prediction.minStake} USDT
                    </div>
                    <div className="text-sm text-gray-600">最小押注</div>
                  </div>
                </div>

                {/* 概率分布 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>是 ({prediction.stats.yesProbability * 100}%)</span>
                    <span>否 ({prediction.stats.noProbability * 100}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${prediction.stats.yesProbability * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* 金额分布 */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>
                      是: {prediction.stats.yesAmount.toFixed(2)} USDT
                    </span>
                    <span>否: {prediction.stats.noAmount.toFixed(2)} USDT</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          prediction.stats.totalAmount > 0
                            ? (prediction.stats.yesAmount /
                                prediction.stats.totalAmount) *
                              100
                            : 50
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 押注操作区域 */}
          {prediction.status === "active" && !prediction.timeInfo.isExpired && (
            <div className="mt-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                参与押注
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => handleStake("yes")}
                  disabled={staking}
                  className="flex-1 py-3 px-4 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  {staking ? "处理中…" : "支持 (预测达成)"}
                </button>
                <button
                  onClick={() => handleStake("no")}
                  disabled={staking}
                  className="flex-1 py-3 px-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                >
                  {staking ? "处理中…" : "反对 (预测不达成)"}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                最小押注金额: {prediction.minStake} USDT
              </p>
              {stakeError && (
                <p className="text-sm text-red-600 mt-2">{stakeError}</p>
              )}
              {stakeSuccess && (
                <p className="text-sm text-green-600 mt-2">{stakeSuccess}</p>
              )}
            </div>
          )}

          {(market || (manualMarket && manualChainId)) && (
            <div className="mt-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">交易</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  {!market && (
                    <div className="mb-3 p-2 border rounded text-sm">
                      <div className="mb-2">手动配置市场地址与链ID</div>
                      <input value={manualMarket} onChange={(e)=>setManualMarket(e.target.value)} placeholder="市场合约地址" className="px-2 py-1 border rounded w-full mb-2" />
                      <input value={manualChainId} onChange={(e)=>setManualChainId(e.target.value)} placeholder="链ID" className="px-2 py-1 border rounded w-full" />
                    </div>
                  )}
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setTradeSide('buy')} className={`px-3 py-1 rounded ${tradeSide==='buy'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700'}`}>买入</button>
                    <button onClick={() => setTradeSide('sell')} className={`px-3 py-1 rounded ${tradeSide==='sell'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}`}>卖出</button>
                    <button onClick={() => setTradeOutcome(1)} className={`px-3 py-1 rounded ${tradeOutcome===1?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-700'}`}>是</button>
                    <button onClick={() => setTradeOutcome(0)} className={`px-3 py-1 rounded ${tradeOutcome===0?'bg-orange-100 text-orange-700':'bg-gray-100 text-gray-700'}`}>否</button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button onClick={()=>setOrderMode('limit')} className={`px-3 py-1 rounded ${orderMode==='limit'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-700'}`}>限价</button>
                    <button onClick={()=>setOrderMode('best')} className={`px-3 py-1 rounded ${orderMode==='best'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-700'}`}>按最佳价</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={priceInput} onChange={(e)=>setPriceInput(e.target.value)} placeholder="价格(USDT)" className="px-3 py-2 border rounded" />
                    <input value={amountInput} onChange={(e)=>setAmountInput(e.target.value)} placeholder="数量" className="px-3 py-2 border rounded" />
                    <input value={expiryInput} onChange={(e)=>setExpiryInput(e.target.value)} placeholder="过期时间(秒,可选)" className="px-3 py-2 border rounded col-span-2" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <button onClick={()=>setAmountInput('1')} className="px-2 py-1 rounded border">+1</button>
                    <button onClick={()=>setAmountInput('5')} className="px-2 py-1 rounded border">+5</button>
                    <button onClick={()=>setAmountInput('10')} className="px-2 py-1 rounded border">+10</button>
                  </div>
                  <div className="mt-3 text-sm text-gray-700">
                    <div>最佳买价: {bestBid? Number(ethers.formatUnits(BigInt(bestBid), 6)).toFixed(4): '-'}</div>
                    <div>最佳卖价: {bestAsk? Number(ethers.formatUnits(BigInt(bestAsk), 6)).toFixed(4): '-'}</div>
                    <div>中间价: {midPrice? Number(ethers.formatUnits(BigInt(midPrice), 6)).toFixed(4): '-'}</div>
                    <div>概率: {priceInput? (Number(priceInput)*100).toFixed(2): midPrice? (Number(ethers.formatUnits(BigInt(midPrice), 6))*100).toFixed(2): '-'}%</div>
                    <div>预计资金: {priceInput && amountInput? (Number(priceInput)*Number(amountInput)).toFixed(4): '-'}</div>
                  </div>
                  <div className="mt-3">
                    <button onClick={submitOrder} disabled={orderSubmitting} className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50">{orderSubmitting?'提交中…':'提交订单'}</button>
                  </div>
                  {orderMsg && <div className="mt-2 text-sm text-gray-700">{orderMsg}</div>}
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">盘口(是)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      {depthBuy.map((d,i)=> (
                        <div key={i} className="flex justify-between text-sm">
                          <button onClick={()=>{setSelectedPrice(d.price); setPriceInput(Number(ethers.formatUnits(BigInt(d.price), 6)).toFixed(6))}} className="text-green-700">{Number(ethers.formatUnits(BigInt(d.price), 6)).toFixed(4)}</button>
                          <span className="text-gray-600">{d.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      {depthSell.map((d,i)=> (
                        <div key={i} className="flex justify-between text-sm">
                          <button onClick={()=>{setSelectedPrice(d.price); setPriceInput(Number(ethers.formatUnits(BigInt(d.price), 6)).toFixed(6))}} className="text-red-700">{Number(ethers.formatUnits(BigInt(d.price), 6)).toFixed(4)}</button>
                          <span className="text-gray-600">{d.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-sm">队列(价格: {selectedPrice ? Number(ethers.formatUnits(BigInt(selectedPrice), 6)).toFixed(4) : '-'})</div>
                    <div className="space-y-2 mt-2">
                      {queueRows.map((r)=> (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="mr-3">剩余 {String(r.remaining)}</span>
                            <span className="mr-3">盐 {String(r.maker_salt)}</span>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={()=>fillOrder(r)} className="px-2 py-1 rounded bg-blue-600 text-white">填单</button>
                            <button onClick={()=>cancelOrderSalt(r)} className="px-2 py-1 rounded bg-gray-200 text-gray-800">取消</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-sm font-medium mb-2">我的挂单</div>
                    <div className="space-y-2">
                      {openOrders.map((r)=> (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="mr-3">{r.is_buy? '买': '卖'}/{r.outcome_index===1?'是':'否'}</span>
                            <span className="mr-3">价格 {Number(ethers.formatUnits(BigInt(r.price), 6)).toFixed(4)}</span>
                            <span className="mr-3">剩余 {String(r.remaining)}</span>
                          </div>
                          <button onClick={()=>cancelOrderSalt(r)} className="px-2 py-1 rounded bg-gray-200 text-gray-800">取消</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 交流与社区 */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <ChatPanel eventId={Number(params.id)} />
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={handleGuideClick}
                  className={`inline-flex items-center gap-2 h-11 px-5 rounded-2xl font-medium text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-white/40 transition-all duration-300 ${guideVariant === 'A' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600' : 'bg-gradient-to-r from-sky-500 to-emerald-500 text-white hover:from-sky-600 hover:to-emerald-600'} ${guideLoading ? 'opacity-80 cursor-wait' : ''}`}
                  aria-label="前往论坛聊天室"
                  title="前往论坛聊天室"
                  style={{ minWidth: 176 }}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-[14px]">前往论坛聊天室</span>
                  <ArrowRightCircle className="w-5 h-5" />
                </button>
              </div>
              {guideError && (
                <div className="mt-2 text-center text-xs text-red-600">
                  {guideError}
                </div>
              )}
            </div>
            <ForumSection eventId={Number(params.id)} />
          </div>
        </div>
        {/* 悬浮回到顶部按钮 */}
        <button
          type="button"
          aria-label="回到顶部"
          title="回到顶部"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className={`${
            showScrollTop
              ? "opacity-100 scale-100"
              : "opacity-0 scale-0 pointer-events-none"
          } fixed bottom-8 right-8 z-50 w-10 h-10 bg-gradient-to-br from-white/90 to-pink-100/90 rounded-full shadow-lg border border-pink-200/50 backdrop-blur-sm overflow-hidden group hover:scale-110 hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-pink-300`}
        >
          {/* 背景质感效果 */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-pink-100/40 group-hover:from-white/60 group-hover:to-pink-100/60 transition-all duration-300"></div>

          {/* 箭头图标 */}
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            <div className="animate-bounce">
              <svg
                className="w-4 h-4 text-gray-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </div>
          </div>

          {/* 悬浮提示 */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            返回顶部
          </div>
        </button>
      </div>
    </div>
  );
}
