import React from "react";
import { CheckCircle, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useWallet } from "@/contexts/WalletContext";

type TrendingLoginModalProps = {
  open: boolean;
  onClose: () => void;
  tTrending: (key: string) => string;
};

export function TrendingLoginModal({ open, onClose, tTrending }: TrendingLoginModalProps) {
  const { connect } = useWallet();
  const primaryButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const handleLoginNow = async () => {
    try {
      await connect();
    } finally {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabelledby="trending-login-modal-title"
      ariaDescribedby="trending-login-modal-description"
      containerClassName="flex items-center justify-center p-4"
      initialFocusRef={primaryButtonRef as React.RefObject<HTMLElement>}
    >
      <div
        className="relative max-w-md w-full bg-gradient-to-br from-white via-white to-purple-50 rounded-3xl shadow-2xl border border-white/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-6">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h3
            id="trending-login-modal-title"
            className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4"
          >
            {tTrending("login.title")}
          </h3>
          <p id="trending-login-modal-description" className="text-gray-600 mb-6">
            {tTrending("login.description")}
          </p>
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-4 mb-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">
              {tTrending("login.benefitsTitle")}
            </h4>
            <ul className="text-gray-600 space-y-2 text-left">
              <li className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                {tTrending("login.benefitFollow")}
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                {tTrending("login.benefitParticipate")}
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                {tTrending("login.benefitRewards")}
              </li>
            </ul>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200"
            >
              {tTrending("login.later")}
            </button>
            <button
              ref={primaryButtonRef}
              onClick={handleLoginNow}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-md"
            >
              {tTrending("login.now")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
