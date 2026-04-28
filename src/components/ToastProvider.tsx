import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type ToastTone = "info" | "success" | "warning" | "error";

export type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type Toast = Required<ToastInput> & { id: string };

type ToastContextValue = {
  toast: (t: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function nowId() {
  return `t_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function ToastProvider(props: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setItems((p) => p.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nowId();
      const next: Toast = {
        id,
        title: input.title,
        message: input.message ?? "",
        tone: input.tone ?? "info",
        durationMs: input.durationMs ?? 3500,
      };
      setItems((p) => [next, ...p].slice(0, 4));

      const handle = window.setTimeout(() => dismiss(id), next.durationMs);
      timers.current.set(id, handle);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function toneClasses(tone: ToastTone) {
  if (tone === "success") return "border-green-200 bg-green-50 text-green-800";
  if (tone === "warning") return "border-yellow-200 bg-yellow-50 text-yellow-900";
  if (tone === "error") return "border-red-200 bg-red-50 text-red-800";
  return "border-gray-200 bg-white text-gray-900";
}

function ToastViewport(props: { items: Toast[]; onDismiss: (id: string) => void }) {
  if (props.items.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] space-y-2">
      {props.items.map((t) => (
        <div key={t.id} className={`rounded-2xl border p-3 shadow-xl ${toneClasses(t.tone)}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold">{t.title}</div>
              {t.message ? <div className="mt-1 text-xs font-semibold opacity-80">{t.message}</div> : null}
            </div>
            <button
              className="rounded-xl px-2 py-1 text-xs font-extrabold hover:bg-black/5"
              onClick={() => props.onDismiss(t.id)}
              aria-label="Dismiss toast"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
