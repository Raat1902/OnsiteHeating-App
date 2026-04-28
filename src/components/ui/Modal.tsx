import React, { useEffect } from "react";
import { X } from "lucide-react";

export function Modal(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    if (props.open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/40" aria-label="Close overlay" onClick={props.onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="text-base font-extrabold text-gray-900">{props.title}</div>
          <button className="rounded-xl p-2 hover:bg-gray-100" onClick={props.onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{props.children}</div>
        {props.footer ? <div className="border-t border-gray-100 p-4">{props.footer}</div> : null}
      </div>
    </div>
  );
}
