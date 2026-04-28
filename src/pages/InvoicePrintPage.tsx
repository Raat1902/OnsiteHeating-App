import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Invoice, InvoiceItem, User } from "../types";
import { db } from "../db";
import { computeInvoiceTotals } from "../lib/domain";

export function InvoicePrintPage(props: { user: User }) {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [totals, setTotals] = useState<{ subtotal: number; tax: number; total: number } | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!invoiceId) return;
      const inv = await db.invoices.get(invoiceId);
      if (!alive) return;
      setInvoice(inv ?? null);
      if (!inv) return;

      const [its, tots, cust] = await Promise.all([
        db.invoiceItems.where("invoiceId").equals(inv.id).toArray(),
        computeInvoiceTotals(inv.id),
        db.users.get(inv.customerId),
      ]);
      if (!alive) return;
      setItems(its);
      setTotals(tots);
      setCustomer(cust ?? null);

      setTimeout(() => window.print(), 150);
    })();
    return () => {
      alive = false;
    };
  }, [invoiceId]);

  const issuedAt = useMemo(() => (invoice ? new Date(invoice.createdAt).toLocaleDateString() : ""), [invoice]);
  const dueAt = useMemo(() => (invoice ? new Date(invoice.dueDate).toLocaleDateString() : ""), [invoice]);

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-extrabold text-gray-900">Invoice not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <img src="/onsite-logo.png" alt="OnSite logo" className="h-14 w-auto" />
            <div className="mt-3 text-2xl font-extrabold text-gray-900">Invoice</div>
            <div className="mt-1 text-sm font-semibold text-gray-600">Invoice ID: {invoice.id}</div>
            <div className="text-sm font-semibold text-gray-600">Job: {invoice.jobId}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-700">Issued: {issuedAt}</div>
            <div className="text-sm font-semibold text-gray-700">Due: {dueAt}</div>
            <div className="mt-1 text-xs font-bold text-gray-500">Status: {invoice.status}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-extrabold text-gray-900">Bill to</div>
            <div className="mt-2 text-sm font-semibold text-gray-800">{customer?.name ?? "Customer"}</div>
            {customer?.email ? <div className="text-sm font-semibold text-gray-700">{customer.email}</div> : null}
            {customer?.phone ? <div className="text-sm font-semibold text-gray-700">{customer.phone}</div> : null}
            {customer?.address ? <div className="mt-2 text-xs font-semibold text-gray-600 whitespace-pre-wrap">{customer.address}</div> : null}
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-extrabold text-gray-900">Company</div>
            <div className="mt-2 text-sm font-semibold text-gray-800">OnSite Heating • Cooling • Plumbing • Electrical</div>
            <div className="text-sm font-semibold text-gray-700">Field service command center</div>
            <div className="mt-2 text-xs font-semibold text-gray-600">
              Demo invoice template. Customize company details in this component.
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
          <div className="grid grid-cols-12 gap-2 bg-gray-50 p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
            <div className="col-span-7">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-3 text-right">Line</div>
          </div>

          <div className="divide-y divide-gray-100">
            {items.map((it) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 p-3">
                <div className="col-span-7 text-sm font-semibold text-gray-900">{it.description}</div>
                <div className="col-span-2 text-right text-sm font-semibold text-gray-700">{it.qty}</div>
                <div className="col-span-3 text-right text-sm font-semibold text-gray-700">
                  ${(it.qty * it.unitPrice).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 p-4">
            <Row label="Subtotal" value={totals ? `$${totals.subtotal.toFixed(2)}` : "—"} />
            <Row label="Tax" value={totals ? `$${totals.tax.toFixed(2)}` : "—"} />
            <div className="my-3 h-px bg-gray-200" />
            <Row label="Total" value={totals ? `$${totals.total.toFixed(2)}` : "—"} strong />
          </div>
        </div>

        <div className="mt-6 print:hidden">
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-gray-800"
            onClick={() => window.print()}
          >
            Print again
          </button>
        </div>
      </div>
    </div>
  );
}

function Row(props: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className={`text-sm font-semibold ${props.strong ? "text-gray-900" : "text-gray-700"}`}>{props.label}</div>
      <div className={`text-sm ${props.strong ? "font-extrabold text-gray-900" : "font-semibold text-gray-800"}`}>
        {props.value}
      </div>
    </div>
  );
}
