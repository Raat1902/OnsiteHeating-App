import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import type { User } from "../types";
import { Modal } from "./ui/Modal";
import { Badge } from "./ui/Badge";
import { buildSearchIndex, filterSearch, type SearchResult } from "../lib/search";

function toneForKind(kind: SearchResult["kind"]) {
  if (kind === "job") return "blue";
  if (kind === "invoice") return "yellow";
  if (kind === "customer") return "green";
  if (kind === "quote") return "purple";
  return "gray";
}

export function CommandPalette(props: { user: User; open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!props.open) return;
      const idx = await buildSearchIndex(props.user);
      if (alive) setIndex(idx);
    })();
    return () => {
      alive = false;
    };
  }, [props.open, props.user]);

  useEffect(() => {
    if (props.open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [props.open]);

  const results = useMemo(() => filterSearch(index, query, 40), [index, query]);

  function choose(r: SearchResult) {
    props.onClose();
    nav(r.route);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!props.open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((p) => Math.min(results.length - 1, p + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((p) => Math.max(0, p - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[active];
        if (r) choose(r);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, results, active]);

  return (
    <Modal title="Search anything" open={props.open} onClose={props.onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <Search size={18} className="text-gray-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type: customer, job, invoice, quote…"
            className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none"
          />
          <div className="text-[11px] font-bold text-gray-500">Esc</div>
        </div>

        <div className="max-h-[420px] overflow-auto rounded-2xl border border-gray-200">
          {results.length === 0 ? (
            <div className="p-3 text-sm font-semibold text-gray-500">No matches.</div>
          ) : (
            results.map((r, idx) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => choose(r)}
                className={`w-full border-b border-gray-100 p-3 text-left hover:bg-gray-50 ${
                  idx === active ? "bg-gray-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-gray-900">{r.title}</div>
                  <Badge tone={toneForKind(r.kind)}>{r.kind}</Badge>
                </div>
                {r.subtitle ? <div className="mt-1 text-xs font-semibold text-gray-600">{r.subtitle}</div> : null}
              </button>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-600">
          <span className="rounded-xl bg-gray-50 px-2 py-1">↑/↓ navigate</span>
          <span className="rounded-xl bg-gray-50 px-2 py-1">Enter open</span>
          <span className="rounded-xl bg-gray-50 px-2 py-1">Esc close</span>
          <span className="rounded-xl bg-gray-50 px-2 py-1">Ctrl/Cmd + K</span>
        </div>
      </div>
    </Modal>
  );
}
