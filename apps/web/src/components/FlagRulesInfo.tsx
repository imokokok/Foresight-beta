"use client";

import React from "react";
import { Trophy } from "lucide-react";

type FlagRulesInfoProps = {
  tFlags: (key: string) => string;
};

export function FlagRulesInfo({ tFlags }: FlagRulesInfoProps) {
  return (
    <div className="p-5 bg-gray-50 rounded-[2rem] space-y-3">
      <div className="flex items-center gap-2 text-sm font-black text-gray-700">
        <Trophy className="w-4 h-4 text-amber-500" />
        {tFlags("rules.title")}
      </div>
      <div className="space-y-2 text-xs font-bold text-gray-500">
        <div className="grid grid-cols-1 gap-1.5">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            {tFlags("rules.light")}
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            {tFlags("rules.standard")}
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
            {tFlags("rules.intense")}
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
            {tFlags("rules.hardcore")}
          </p>
        </div>
      </div>
    </div>
  );
}
