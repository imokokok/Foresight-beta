"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import Button from "@/components/ui/Button";
import DatePicker from "@/components/ui/DatePicker";
import { fetchUsernamesByAddresses } from "@/lib/userProfiles";

interface ForumSectionProps {
  eventId: number;
}

interface ThreadView {
  id: number;
  event_id: number;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  comments?: CommentView[];
}

interface CommentView {
  id: number;
  thread_id: number;
  event_id: number;
  user_id: string;
  content: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  parent_id?: number | null;
}

export default function ForumSection({ eventId }: ForumSectionProps) {
  const {
    account,
    connectWallet,
    formatAddress,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
  } = useWallet();
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [posting, setPosting] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const [subjectName, setSubjectName] = useState("");
  const [actionVerb, setActionVerb] = useState("价格达到");
  const [targetValue, setTargetValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState("科技");

  const titlePreview = useMemo(() => {
    const name = String(subjectName || "").trim();
    const act = String(actionVerb || "").trim();
    const target = String(targetValue || "").trim();
    const dl = String(deadline || "").trim();
    if (!name || !act || !target || !dl) return "";
    const when = new Date(dl);
    const iso = when.toISOString().replace(".000Z", "Z");
    if (act === "价格达到") return `${name}价格在${iso}前达到${target}`;
    if (act === "将会赢得") return `${name}将在${iso}前赢得${target}`;
    if (act === "将会发生") return `${name}将在${iso}前发生${target}`;
    return `${name}将在${iso}前${act}${target}`;
  }, [subjectName, actionVerb, targetValue, deadline]);
  const criteriaPreview = useMemo(() => {
    const act = String(actionVerb || "").trim();
    if (act === "价格达到") return "以权威价格数据源为准，在截止时间前达到或超过目标值视为达成";
    if (act === "将会赢得") return "以赛事官方结果为准，在截止时间前确认夺冠视为达成";
    if (act === "将会发生") return "以官方公告或权威媒体报道为准，事件在截止时间前发生视为达成";
    return "以客观可验证来源为准，截止前满足条件视为达成";
  }, [actionVerb]);
  const formError = useMemo(() => {
    const name = String(subjectName || "").trim();
    const target = String(targetValue || "").trim();
    const dl = String(deadline || "").trim();
    const cat = String(category || "").trim();
    if (!name) return "请填写主体名称";
    if (!target) return "请填写目标值/条件";
    if (!dl) return "请填写截止时间";
    const d = new Date(dl);
    if (Number.isNaN(d.getTime())) return "截止时间格式不正确";
    if (d.getTime() <= Date.now()) return "截止时间需晚于当前时间";
    if (!cat) return "请选择分类";
    return "";
  }, [subjectName, targetValue, deadline, category]);
  const canSubmit = useMemo(() => {
    return !!titlePreview && !formError;
  }, [titlePreview, formError]);
  const displayName = (addr: string) => {
    const key = String(addr || "").toLowerCase();
    return nameMap[key] || formatAddress(addr);
  };
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [userVoteTypes, setUserVoteTypes] = useState<Record<string, "up" | "down">>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forum?eventId=${eventId}`);
      const data = await res.json();
      setThreads(Array.isArray(data?.threads) ? data.threads : []);
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const fetchVotes = async () => {
      try {
        if (!account) {
          setUserVotes(new Set());
          return;
        }
        const res = await fetch(`/api/forum/user-votes?eventId=${eventId}`);
        const j = await res.json();
        const set = new Set<string>();
        const types: Record<string, "up" | "down"> = {};
        (Array.isArray(j?.votes) ? j.votes : []).forEach((v: any) => {
          const key = `${String(v.content_type)}:${String(v.content_id)}`;
          set.add(key);
          const vt = String(v.vote_type) === "down" ? "down" : "up";
          types[key] = vt;
        });
        setUserVotes(set);
        setUserVoteTypes(types);
      } catch {}
    };
    fetchVotes();
  }, [eventId, account]);

  useEffect(() => {
    const run = async () => {
      const addrs = new Set<string>();
      threads.forEach((t) => {
        if (t.user_id) addrs.add(String(t.user_id));
        (t.comments || []).forEach((c) => {
          if (c.user_id) addrs.add(String(c.user_id));
        });
      });
      if (account) addrs.add(String(account));
      const unknown = Array.from(addrs).filter((a) => !nameMap[String(a || "").toLowerCase()]);
      if (unknown.length === 0) return;
      const next = await fetchUsernamesByAddresses(unknown);
      if (Object.keys(next).length === 0) return;
      setNameMap((prev) => ({ ...prev, ...next }));
    };
    run();
  }, [threads, account, nameMap]);

  const postThread = async () => {
    if (!account) {
      setError("请先连接钱包");
      return;
    }
    const t = titlePreview;
    if (!t.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          title: t,
          content: "",
          walletAddress: account,
          subjectName: subjectName,
          actionVerb: actionVerb,
          targetValue: targetValue,
          category: category,
          deadline: deadline,
          titlePreview: titlePreview,
          criteriaPreview: criteriaPreview,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle("");
      await load();
    } catch (e: any) {
      setError(e?.message || "创建失败");
    } finally {
      setPosting(false);
    }
  };

  const postComment = async (threadId: number, text: string, parentId?: number | null) => {
    if (!account) {
      setError("请先连接钱包");
      return;
    }
    if (!text.trim()) return;
    try {
      const res = await fetch("/api/forum/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          threadId,
          content: text,
          walletAddress: account,
          parentId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      setError(e?.message || "评论失败");
    }
  };

  const vote = async (type: "thread" | "comment", id: number, dir: "up" | "down") => {
    try {
      if (!account) {
        setError("请先连接钱包再投票");
        return;
      }
      const key = `${type}:${id}`;
      if (userVotes.has(key)) {
        setError("您已经投过票了");
        return;
      }
      const res = await fetch("/api/forum/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, dir }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "投票失败");
      }
      setUserVotes((prev) => new Set([...prev, key]));
      setUserVoteTypes((prev) => ({ ...prev, [key]: dir }));
      await load();
    } catch (e: any) {
      setError(e?.message || "投票失败");
    }
  };

  // 将评论按 parent_id 构建简单树
  const buildTree = (comments: CommentView[] = []) => {
    const byParent: Record<string, CommentView[]> = {};
    comments.forEach((c) => {
      const key = String(c.parent_id ?? "root");
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(c);
    });
    const renderBranch = (parentId: number | null, depth = 0): React.ReactNode[] => {
      const key = String(parentId ?? "root");
      const nodes = byParent[key] || [];
      return nodes.flatMap((node) => [
        <div key={node.id} className="mt-3 pl-0" style={{ marginLeft: depth * 16 }}>
          <div className="text-sm text-gray-800">
            <span className="text-purple-700 font-medium mr-2">{displayName(node.user_id)}</span>
            <span className="text-gray-400">{new Date(node.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-1 text-gray-700 break-words">{node.content}</div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <button
              onClick={() => vote("comment", node.id, "up")}
              disabled={userVotes.has(`comment:${node.id}`)}
              className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white disabled:opacity-50"
            >
              ▲ {node.upvotes}
            </button>
            {account && (
              <ReplyBox onSubmit={(text) => postComment(node.thread_id, text, node.id)} />
            )}
          </div>
        </div>,
        ...renderBranch(node.id, depth + 1),
      ]);
    };
    return renderBranch(null, 0);
  };

  return (
    <div className="rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/50">
        <div className="font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          社区讨论
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-white/40 rounded-xl border border-white/60 p-4 shadow-sm">
          {!account ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 font-medium">发帖需连接钱包</div>
              <Button
                size="sm"
                variant="cta"
                onClick={async () => {
                  await connectWallet();
                  await requestWalletPermissions();
                  await siweLogin();
                  await multisigSign();
                }}
              >
                连接并签名
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="主体名称"
                  className="w-full px-3 py-2 border border-white/60 rounded-xl bg-white/50 focus:bg-white/90 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-800"
                />
                <select
                  value={actionVerb}
                  onChange={(e) => setActionVerb(e.target.value)}
                  className="w-full px-3 py-2 border border-white/60 rounded-xl bg-white/50 focus:bg-white/90 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-800"
                >
                  <option value="价格达到">价格达到</option>
                  <option value="将会赢得">将会赢得</option>
                  <option value="将会发生">将会发生</option>
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="目标值/条件"
                  className="w-full px-3 py-2 border border-white/60 rounded-xl bg-white/50 focus:bg-white/90 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-800"
                />
                <DatePicker
                  value={deadline}
                  onChange={setDeadline}
                  includeTime={true}
                  placeholder="截止时间"
                  className="w-full"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-white/60 rounded-xl bg-white/50 focus:bg-white/90 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-800"
                >
                  <option value="科技">科技</option>
                  <option value="娱乐">娱乐</option>
                  <option value="时政">时政</option>
                  <option value="天气">天气</option>
                  <option value="体育">体育</option>
                  <option value="商业">商业</option>
                  <option value="加密货币">加密货币</option>
                  <option value="更多">更多</option>
                </select>
              </div>
              <div className="bg-white/40 border border-white/60 rounded-xl p-3 text-sm text-gray-800">
                <div className="font-medium text-indigo-700">标题预览</div>
                <div className="mt-1">{titlePreview || "请完善表单以生成标题"}</div>
                <div className="font-medium text-indigo-700 mt-3">结算标准</div>
                <div className="mt-1">{criteriaPreview || "请完善表单以生成结算标准"}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-600">{formError || ""}</div>
                <Button
                  onClick={postThread}
                  disabled={posting || !canSubmit}
                  size="md"
                  variant="cta"
                >
                  {posting ? "发布中…" : "发布主题"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 主题列表 */}
        <div className="space-y-4">
          {loading && <div className="text-sm text-gray-500">加载中…</div>}
          {!loading && threads.length === 0 && (
            <div className="text-sm text-gray-500">暂无主题</div>
          )}
          {threads.map((t) => (
            <div key={t.id} className="bg-white/40 rounded-xl border border-white/60 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {t.title}
                  </div>
                  {String(t.content || "").trim() && (
                    <div className="text-sm text-gray-600 mt-1">{t.content}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    由 <span className="text-indigo-700 font-medium">{displayName(t.user_id)}</span>{" "}
                    在 {new Date(t.created_at).toLocaleString()} 发布
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Button
                    size="sm"
                    variant="cta"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200/50"
                    onClick={() => vote("thread", t.id, "up")}
                    disabled={userVotes.has(`thread:${t.id}`)}
                  >
                    ▲ {t.upvotes}
                  </Button>
                  <Button
                    size="sm"
                    variant="cta"
                    className="bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-200/50"
                    onClick={() => vote("thread", t.id, "down")}
                    disabled={userVotes.has(`thread:${t.id}`)}
                  >
                    ▼ {t.downvotes}
                  </Button>
                  {userVotes.has(`thread:${t.id}`) && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        userVoteTypes[`thread:${t.id}`] === "down"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {userVoteTypes[`thread:${t.id}`] === "down" ? "已踩" : "已赞"}
                    </span>
                  )}
                </div>
              </div>

              {/* 评论区 */}
              <div className="mt-3">
                <div className="text-sm font-medium text-indigo-700">评论</div>
                <div className="mt-2">{buildTree(t.comments || [])}</div>
                {account && (
                  <div className="mt-2">
                    <ReplyBox onSubmit={(text) => postComment(t.id, text)} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
}

function ReplyBox({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await onSubmit(text);
      setText("");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="写下评论…"
        className="flex-1 px-3 py-2 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white/50 focus:bg-white/90 transition-all text-gray-800"
      />
      <Button onClick={submit} disabled={sending} size="sm" variant="primary">
        {sending ? "发送中…" : "评论"}
      </Button>
    </div>
  );
}
