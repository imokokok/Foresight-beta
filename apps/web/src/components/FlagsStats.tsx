import { motion } from "framer-motion";
import { Flag, Zap, Trophy, TrendingUp, Target, Star } from "lucide-react";

interface FlagsStatsProps {
  flags: any[];
  username?: string;
}

export function FlagsStats({ flags, username }: FlagsStatsProps) {
  const activeCount = flags.filter((f) => f.status === "active").length;
  const successCount = flags.filter((f) => f.status === "success").length;
  const total = flags.length;

  // Calculate a "Focus Score" based on ratio of active+success / total
  const focusScore =
    total > 0 ? Math.round(((activeCount + successCount) / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
      {/* Active Flags Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white to-purple-50/50 p-6 shadow-sm border border-purple-100/50 group hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-500"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-start justify-between mb-4">
             <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
              <Flag className="w-6 h-6" />
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-100/50 text-purple-700 text-xs font-bold uppercase tracking-wider border border-purple-100">
              Ongoing
            </span>
          </div>
          
          <div>
            <div className="flex items-baseline gap-2">
              <div className="text-5xl font-black text-gray-900 tracking-tighter">
                {activeCount}
              </div>
              <span className="text-lg text-gray-400 font-bold">Flags</span>
            </div>
             <p className="text-sm text-gray-500 font-medium mt-1">当前正在进行的挑战</p>
          </div>
        </div>
      </motion.div>

      {/* Success Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-sm border border-blue-100/50 group hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-500"
      >
         <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
              <Trophy className="w-6 h-6" />
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-100/50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-100">
              Achieved
            </span>
          </div>
          
           <div>
            <div className="flex items-baseline gap-2">
              <div className="text-5xl font-black text-gray-900 tracking-tighter">
                {successCount}
              </div>
              <span className="text-lg text-gray-400 font-bold">Goals</span>
            </div>
            <p className="text-sm text-gray-500 font-medium mt-1">已成功达成的目标</p>
          </div>
        </div>
      </motion.div>

      {/* Focus Score Card (Dark) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative overflow-hidden rounded-[2rem] bg-gray-900 p-6 shadow-xl shadow-gray-900/10 group hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-500"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500" />

        <div className="relative z-10 text-white h-full flex flex-col justify-between">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-6 h-6 text-yellow-400" />
            </div>
             <span className="px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-bold uppercase tracking-wider border border-white/10">
              Score
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2 mb-3">
              <div className="text-5xl font-black tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                {focusScore}
              </div>
              <span className="text-2xl font-thin text-gray-500">%</span>
            </div>
            
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${focusScore}%` }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              />
            </div>
             <div className="mt-2 flex justify-between items-center text-xs font-medium text-gray-400">
              <span>完成率</span>
              <TrendingUp className="w-3 h-3 text-green-400" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
