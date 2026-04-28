import React, { useEffect, useState } from "react";
import type { QuoteOption, User } from "../types";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { approveQuoteToJob, createQuote, listCustomers, listQuotesForUser, setQuoteStatus } from "../lib/data";

function tierTone(t: string) {
  if (t === "good") return "gray";
  if (t === "better") return "blue";
  return "green";
}

export function QuotesPage(props: { user: User }) {
  const [rows, setRows] = useState<Array<{ quote: any; options: any[] }>>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    customerId: "",
    title: "",
    goodTitle: "Good",
    goodDesc: "Budget-friendly option",
    goodPrice: "199",
    goodSpecs: "Specs…",
    betterTitle: "Better",
    betterDesc: "Better efficiency and warranty",
    betterPrice: "349",
    betterSpecs: "Specs…",
    bestTitle: "Best",
    bestDesc: "Top tier with premium features",
    bestPrice: "499",
    bestSpecs: "Specs…",
  });

  async function refresh() {
    setRows(await listQuotesForUser(props.user));
    if (props.user.role !== "customer") setCustomers(await listCustomers());
  }

  useEffect(() => { refresh(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await createQuote({
      customerId: form.customerId,
      title: form.title,
      options: [
        { tier: "good", title: form.goodTitle, description: form.goodDesc, price: Number(form.goodPrice) || 0, equipmentSpecs: form.goodSpecs, energySavingsAnnual: 40, rebateAmount: 0, financingMonthly: Math.round((Number(form.goodPrice) || 0) / 12) },
        { tier: "better", title: form.betterTitle, description: form.betterDesc, price: Number(form.betterPrice) || 0, equipmentSpecs: form.betterSpecs, energySavingsAnnual: 95, rebateAmount: 150, financingMonthly: Math.round((Number(form.betterPrice) || 0) / 18) },
        { tier: "best", title: form.bestTitle, description: form.bestDesc, price: Number(form.bestPrice) || 0, equipmentSpecs: form.bestSpecs, energySavingsAnnual: 165, rebateAmount: 350, financingMonthly: Math.round((Number(form.bestPrice) || 0) / 24) },
      ],
    });
    setOpen(false);
    await refresh();
  }

  async function sendQuote(id: string) {
    await setQuoteStatus(id, "sent");
    await refresh();
  }

  async function approve(id: string) {
    await approveQuoteToJob(id, props.user);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-gray-900">Quotes & Estimates</div>
          <div className="text-sm font-semibold text-gray-500">Good/Better/Best packages, approvals, convert to job.</div>
        </div>
        {props.user.role !== "customer" ? <Button onClick={() => setOpen(true)}>New quote</Button> : null}
      </div>

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-500 shadow-sm">No quotes yet.</div>
        ) : (
          rows.map((r) => (
            <div key={r.quote.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold text-gray-900">{r.quote.title}</div>
                  <div className="text-sm font-semibold text-gray-600">
                    Status: <Badge tone={r.quote.status === "approved" ? "green" : r.quote.status === "sent" ? "blue" : "gray"}>{r.quote.status}</Badge>
                  </div>
                  <div className="text-xs font-semibold text-gray-500">Created: {new Date(r.quote.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  {props.user.role !== "customer" && r.quote.status === "draft" ? <Button onClick={() => sendQuote(r.quote.id)}>Send to customer</Button> : null}
                  {props.user.role === "customer" && r.quote.status === "sent" ? <Button onClick={() => approve(r.quote.id)}>Approve (creates job)</Button> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {r.options.map((o: QuoteOption) => (
                  <div key={o.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-gray-900">{o.title}</div>
                      <Badge tone={tierTone(o.tier) as any}>{o.tier}</Badge>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-600">${Number(o.price).toFixed(2)}</div>
                    <div className="mt-2 text-sm font-semibold text-gray-700">{o.description}</div>
                    <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-gray-50 p-2 text-xs font-semibold text-gray-600">{o.equipmentSpecs}</pre>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        title="New quote"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="quoteForm">Create</Button>
          </div>
        }
      >
        <form id="quoteForm" className="space-y-3" onSubmit={submit}>
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Customer</div>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              value={form.customerId}
              onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
              required
            >
              <option value="" disabled>Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </label>

          <Input label="Quote title" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} required />

          <div className="grid gap-3 md:grid-cols-3">
            <Tier title="Good">
              <Input label="Title" value={form.goodTitle} onChange={(v) => setForm((p) => ({ ...p, goodTitle: v }))} />
              <Input label="Price" type="number" step={1} value={form.goodPrice} onChange={(v) => setForm((p) => ({ ...p, goodPrice: v }))} />
              <Text label="Description" value={form.goodDesc} onChange={(v) => setForm((p) => ({ ...p, goodDesc: v }))} rows={2} />
              <Text label="Equipment specs" value={form.goodSpecs} onChange={(v) => setForm((p) => ({ ...p, goodSpecs: v }))} rows={3} />
            </Tier>

            <Tier title="Better">
              <Input label="Title" value={form.betterTitle} onChange={(v) => setForm((p) => ({ ...p, betterTitle: v }))} />
              <Input label="Price" type="number" step={1} value={form.betterPrice} onChange={(v) => setForm((p) => ({ ...p, betterPrice: v }))} />
              <Text label="Description" value={form.betterDesc} onChange={(v) => setForm((p) => ({ ...p, betterDesc: v }))} rows={2} />
              <Text label="Equipment specs" value={form.betterSpecs} onChange={(v) => setForm((p) => ({ ...p, betterSpecs: v }))} rows={3} />
            </Tier>

            <Tier title="Best">
              <Input label="Title" value={form.bestTitle} onChange={(v) => setForm((p) => ({ ...p, bestTitle: v }))} />
              <Input label="Price" type="number" step={1} value={form.bestPrice} onChange={(v) => setForm((p) => ({ ...p, bestPrice: v }))} />
              <Text label="Description" value={form.bestDesc} onChange={(v) => setForm((p) => ({ ...p, bestDesc: v }))} rows={2} />
              <Text label="Equipment specs" value={form.bestSpecs} onChange={(v) => setForm((p) => ({ ...p, bestSpecs: v }))} rows={3} />
            </Tier>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Tier(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="text-sm font-extrabold text-gray-900">{props.title}</div>
      <div className="mt-2 space-y-2">{props.children}</div>
    </div>
  );
}

function Text(props: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-semibold text-gray-800">{props.label}</div>
      <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" rows={props.rows} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}
