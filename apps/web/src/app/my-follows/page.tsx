"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ArrowLeft,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  X
} from "lucide-react";
 
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";

interface FollowedEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  image_url?: string;
  deadline: string;
  min_stake: number;
  followers_count: number;
  status: 'active' | 'ended' | 'settled';
  created_at: string;
}

export default function MyFollowsPage() {
  const { account, hasProvider } = useWallet();
  const [followedEvents, setFollowedEvents] = useState<FollowedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const categories = [
    { value: "all", label: "全部分类" },
    { value: "科技", label: "科技" },
    { value: "体育", label: "体育" },
    { value: "娱乐", label: "娱乐" },
    { value: "经济", label: "经济" },
    { value: "政治", label: "政治" }
  ];

  const statusOptions = [
    { value: "all", label: "全部状态" },
    { value: "active", label: "进行中" },
    { value: "ended", label: "已结束" },
    { value: "settled", label: "已结算" }
  ];

  // 获取用户关注的事件
  const fetchFollowedEvents = async () => {
    if (!account) {
      setError("请先连接钱包");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/user-follows?address=${account.toLowerCase()}`);
      if (!response.ok) {
        throw new Error("获取关注数据失败");
      }
      
      const data = await response.json();
      setFollowedEvents(data.follows || []);
    } catch (err) {
      console.error("获取关注数据失败:", err);
      setError(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 取消关注事件
  const handleUnfollow = async (eventId: string) => {
    if (!account) return;

    try {
      const response = await fetch("/api/follows", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          predictionId: Number(eventId),
          walletAddress: account.toLowerCase(),
        }),
      });

      if (!response.ok) {
        throw new Error("取消关注失败");
      }

      // 从列表中移除该事件
      setFollowedEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (err) {
      console.error("取消关注失败:", err);
    }
  };

  useEffect(() => {
    fetchFollowedEvents();
  }, [account]);

  // 过滤事件
  const filteredEvents = followedEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;
    const matchesStatus = selectedStatus === "all" || event.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'ended': return 'text-orange-600 bg-orange-100';
      case 'settled': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '进行中';
      case 'ended': return '已结束';
      case 'settled': return '已结算';
      default: return '未知';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      
      
      <div className="container mx-auto px-4 py-8 pt-24">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link href="/trending">
              <motion.button
                className="mr-4 p-2 rounded-full bg-white shadow-md hover:shadow-lg transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </motion.button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                <Heart className="w-8 h-8 text-red-500 mr-3" />
                我的关注
              </h1>
              <p className="text-gray-600 mt-1">管理您关注的预测事件</p>
            </div>
          </div>
          
          <motion.button
            onClick={fetchFollowedEvents}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </motion.button>
        </div>

        {/* 搜索和筛选 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 搜索框 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索关注的事件..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            {/* 筛选按钮 */}
            <motion.button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Filter className="w-5 h-5 mr-2" />
              筛选
              <ChevronDown className={`w-4 h-4 ml-2 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
            </motion.button>
          </div>

          {/* 筛选选项 */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-gray-200"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 分类筛选 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {categories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* 状态筛选 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {statusOptions.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 内容区域 */}
        {!account ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md mx-auto">
              <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">请先连接钱包</h3>
              <p className="text-gray-600 mb-6">需要连接钱包才能查看您的关注列表</p>
              <button className="px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all duration-300">
                连接钱包
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md mx-auto">
              <RefreshCw className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">加载中...</h3>
              <p className="text-gray-600">正在获取您的关注列表</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md mx-auto">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">加载失败</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={fetchFollowedEvents}
                className="px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all duration-300"
              >
                重试
              </button>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md mx-auto">
              <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {followedEvents.length === 0 ? "暂无关注的事件" : "没有找到匹配的事件"}
              </h3>
              <p className="text-gray-600 mb-6">
                {followedEvents.length === 0 
                  ? "去热门页面关注一些感兴趣的预测事件吧！" 
                  : "尝试调整搜索条件或筛选选项"
                }
              </p>
              <Link href="/trending">
                <button className="px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all duration-300">
                  {followedEvents.length === 0 ? "去发现事件" : "返回热门页面"}
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 统计信息 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{followedEvents.length}</div>
                  <div className="text-gray-600">总关注数</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {followedEvents.filter(e => e.status === 'active').length}
                  </div>
                  <div className="text-gray-600">进行中</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {followedEvents.filter(e => e.status === 'settled').length}
                  </div>
                  <div className="text-gray-600">已结算</div>
                </div>
              </div>
            </div>

            {/* 事件列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <motion.div
                  key={event.id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="relative h-48 overflow-hidden bg-white">
                    <img
                      src={event.image_url && event.image_url.trim() ? event.image_url : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(event.title)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`}
                      alt={event.title}
                      loading="lazy"
                      decoding="async"
                      width={800}
                      height={384}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement
                        img.onerror = null
                        img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(event.title)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`
                      }}
                    />
                    
                    {/* 状态标签 */}
                    <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                      {getStatusText(event.status)}
                    </div>
                    
                    {/* 取消关注按钮 */}
                    <motion.button
                      onClick={() => handleUnfollow(event.id)}
                      className="absolute top-4 right-4 p-2 bg-white/90 rounded-full hover:bg-white transition-all duration-300"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </motion.button>
                  </div>

                  {/* 事件信息 */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
                        {event.category}
                      </span>
                      <div className="flex items-center text-gray-500 text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {event.followers_count}
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-lg text-gray-800 mb-2 line-clamp-2">
                      {event.title}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {event.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(event.deadline).toLocaleDateString()}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(event.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-gray-600">起投：</span>
                        <span className="font-bold text-purple-600">{event.min_stake} USDT</span>
                      </div>
                      
                      <Link href={`/prediction/${event.id}`}>
                        <motion.button
                          className="btn-base btn-sm btn-cta rounded-full"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          查看详情
                        </motion.button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
