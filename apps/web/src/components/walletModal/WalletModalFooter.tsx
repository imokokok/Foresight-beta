import React from "react";

export type WalletModalFooterProps = {
  tLogin: (key: string) => string;
};

export function WalletModalFooter({ tLogin }: WalletModalFooterProps) {
  return (
    <div className="relative px-6 pb-6">
      <div className="text-sm text-gray-500 text-center leading-relaxed">
        {tLogin("agreePrefix")}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 hover:text-purple-700 font-medium transition-colors duration-200 mx-1"
        >
          {tLogin("terms")}
        </a>
        <span className="mx-1">{tLogin("and")}</span>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 hover:text-purple-700 font-medium transition-colors duration-200 mx-1"
        >
          {tLogin("privacy")}
        </a>
        <span className="mx-1">{tLogin("agreeSuffix")}</span>
      </div>
    </div>
  );
}
