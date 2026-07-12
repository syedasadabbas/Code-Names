"use client";

import { useEffect } from "react";
import clsx from "clsx";

/** Accessible-ish overlay modal: click backdrop or press Escape to close. */
export default function Modal({
  onClose,
  children,
  className,
  labelledBy,
}: {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className={clsx(
          "surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5 shadow-2xl thin-scroll",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
