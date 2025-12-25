import React from "react";
import { Loader2 } from "lucide-react";

export type WalletModalStepperProps = {
  tWalletModal: (key: string) => string;
  stepHint: string;
  step1Active: boolean;
  step2Active: boolean;
  step3Active: boolean;
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
};

export function WalletModalStepper({
  tWalletModal,
  stepHint,
  step1Active,
  step2Active,
  step3Active,
  step1Done,
  step2Done,
  step3Done,
}: WalletModalStepperProps) {
  return (
    <div className="relative px-6 pt-3 pb-4 border-b border-purple-50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center flex-1">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full border-2 text-[11px] ${
              step1Done
                ? "border-purple-500 bg-purple-500 text-white"
                : step1Active
                  ? "border-purple-500 text-purple-600"
                  : "border-gray-200 text-gray-400"
            }`}
          >
            {step1Done ? "✓" : step1Active ? <Loader2 className="w-3 h-3 animate-spin" /> : "1"}
          </div>
          <div
            className={`ml-2 text-[11px] ${
              step1Done ? "text-purple-600" : step1Active ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {tWalletModal("steps.connectWallet")}
          </div>
          <div
            className={`flex-1 h-px mx-2 ${
              step2Done || step2Active
                ? "bg-gradient-to-r from-purple-400 to-pink-400"
                : "bg-gray-200"
            }`}
          />
        </div>
        <div className="flex items-center flex-1">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full border-2 text-[11px] ${
              step2Done
                ? "border-purple-500 bg-purple-500 text-white"
                : step2Active
                  ? "border-purple-500 text-purple-600"
                  : "border-gray-200 text-gray-400"
            }`}
          >
            {step2Done ? "✓" : step2Active ? <Loader2 className="w-3 h-3 animate-spin" /> : "2"}
          </div>
          <div
            className={`ml-2 text-[11px] ${
              step2Done ? "text-purple-600" : step2Active ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {tWalletModal("steps.signIn")}
          </div>
          <div
            className={`flex-1 h-px mx-2 ${
              step3Done || step3Active
                ? "bg-gradient-to-r from-purple-400 to-pink-400"
                : "bg-gray-200"
            }`}
          />
        </div>
        <div className="flex items-center">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full border-2 text-[11px] ${
              step3Done
                ? "border-purple-500 bg-purple-500 text-white"
                : step3Active
                  ? "border-purple-500 text-purple-600"
                  : "border-gray-200 text-gray-400"
            }`}
          >
            {step3Done ? "✓" : step3Active ? <Loader2 className="w-3 h-3 animate-spin" /> : "3"}
          </div>
          <div
            className={`ml-2 text-[11px] ${
              step3Done ? "text-purple-600" : step3Active ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {tWalletModal("steps.completeProfile")}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">{stepHint}</div>
    </div>
  );
}
