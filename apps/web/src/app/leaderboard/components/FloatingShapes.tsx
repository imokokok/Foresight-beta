"use client";
import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Star } from "lucide-react";

export function FloatingShapes() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <motion.div
        animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-10 text-purple-200 opacity-40"
      >
        <Star className="w-16 h-16 fill-current" />
      </motion.div>
      <motion.div
        animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-40 right-20 text-indigo-200 opacity-40"
      >
        <div className="w-12 h-12 rounded-full bg-current blur-sm" />
      </motion.div>
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-40 left-1/4 text-pink-200 opacity-40"
      >
        <Sparkles className="w-20 h-20" />
      </motion.div>
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-20 right-1/3 text-blue-200 opacity-30"
      >
        <div className="w-32 h-32 border-[6px] border-dashed border-current rounded-full" />
      </motion.div>
    </div>
  );
}
