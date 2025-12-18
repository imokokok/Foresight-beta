"use client";

import { Toaster } from "sonner";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      expand={true}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "glass-card backdrop-blur-2xl border-white/50 shadow-brand",
          title: "font-bold text-gray-900",
          description: "text-gray-600 text-sm",
          actionButton: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold",
          cancelButton: "bg-gray-200 text-gray-700",
          closeButton: "bg-white/80 border-white/60",
        },
        style: {
          borderRadius: "1rem",
        },
        duration: 4000,
      }}
    />
  );
}
