import React, { useEffect, useMemo, useState } from "react";
import type { Invoice, InvoiceItem, Payment, PaymentMethod, User } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { computeInvoicePayments, computeInvoiceTotals, quickbooksRows } from "../lib/domain";
import {
  deleteInvoiceItem,
  listInvoiceItems,
  listInvoicesForUser,
  listPaymentsForInvoice,
  markInvoiceSent,
  recordPayment,
  refundPayment,
  upsertInvoiceItem,
} from "../lib/data";
import { newId } from "../lib/id";
import { downloadCsv } from "../lib/export";
import { useToast } from "../components/ToastProvider";
import { db } from "../db";

function toneForStatus(s: Invoice["status"]) {
  if (s === "paid") return "green";
  if (s === "overdue") return "red";
  if (s === "sent") return "blue";
  return "gray";
}

export function InvoicesPage(props: { user: User }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totals, setTotals] = useState<{ subtotal: number; tax: number; total: number } | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<{ paid: number; deposits: number; refunds: number; tips: number; balance: number } | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Invoice["status"] | "all">("all");

  const [open, setOpen] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: "", qty: "1", unitPrice: "0" });

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    method: "card" as PaymentMethod,
    amount: "",
    paymentType: "payment" as NonNullable<Payment["paymentType"]>,
    note: "",
  });

  async function refresh() {
    setInvoices(await listInvoicesForUser(props.user));
  }

  async function refreshSelected(invoiceId: string) {
    const inv = (await listInvoicesForUser(props.user)).find((x) => x.id === invoiceId) ?? null;
    setSelected(inv);
    if (!inv) return;
    const [its, tots, pays, summary, customer] = await Promise.all([
      listInvoiceItems(inv.id),
      computeInvoiceTotals(inv.id),
      listPaymentsForInvoice(inv.id),
      computeInvoicePayments(inv.id),
      db.users.get(inv.customerId),
    ]);
    setItems(its);
    setTotals(tots);
    setPayments(pays);
    setPaymentSummary(summary);
    setCustomerName(customer?.name ?? inv.customerId);
  }

  useEffect(() => {
    refresh();
  }, [props.user]);

  const filtered = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().trim();
    const qn = norm(q);
    return invoices
      .filter((i) => {
        if (statusFilter !== "all" && i.status !== statusFilter) return false;
        if (!qn) return true;
        return norm(`${i.id} ${i.jobId} ${i.status}`).includes(qn);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices, q, statusFilter]);

  function exportCsv() {
    const rows = filtered.map((i) => ({
      id: i.id,
      jobId: i.jobId,
      customerId: i.customerId,
      status: i.status,
      createdAt: i.createdAt,
      dueDate: i.dueDate,
      discountAmount: i.discountAmount,
      taxRate: i.taxRate,
    }));
    downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast({ title: "Exported CSV", message: `Downloaded ${rows.length} invoices`, tone: "success" });
  }

  async function exportQuickBooks() {
    const rows: Record<string, string | number>[] = [];
    for (const inv of filtered) {
      const totals = await computeInvoiceTotals(inv.id);
      const customer = await db.users.get(inv.customerId);
      rows.push(...quickbooksRows({ invoice: inv, totals, customerName: customer?.name }));
    }
    downloadCsv(`quickbooks-invoices-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast({ title: "Exported QuickBooks CSV", message: `${rows.length} rows`, tone: "success" });
  }

  async function openInvoice(inv: Invoice) {
    setOpen(true);
    setSelected(inv);
    setEditMode(false);
    setEditingId(null);
    await refreshSelected(inv.id);
  }

  function close() {
    setOpen(false);
    setSelected(null);
    setItems([]);
    setTotals(null);
    setPayments([]);
    setPaymentSummary(null);
    setError(null);
    setEditMode(false);
    setEditingId(null);
  }

  function beginNewItem() {
    setEditMode(true);
    setEditingId(null);
    setEditForm({ description: "", qty: "1", unitPrice: "0" });
  }

  function beginEditItem(i: InvoiceItem) {
    setEditMode(true);
    setEditingId(i.id);
    setEditForm({ description: i.description, qty: String(i.qty), unitPrice: String(i.unitPrice) });
  }

  async function saveItem() {
    if (!selected) return;
    const item: InvoiceItem = {
      id: editingId ?? newId("item"),
      invoiceId: selected.id,
      description: editForm.description.trim(),
      qty: Math.max(1, Number(editForm.qty) || 1),
      unitPrice: Number(editForm.unitPrice) || 0,
    };
    await upsertInvoiceItem(item);
    await refreshSelected(selected.id);
    setEditMode(false);
    setEditingId(null);
  }

  async function removeItem(id: string) {
    if (!selected) return;
    await deleteInvoiceItem(id);
    await refreshSelected(selected.id);
  }

  async function sendInvoice() {
    if (!selected) return;
    await markInvoiceSent(selected.id, props.user);
    toast({ title: "Invoice sent", message: selected.id, tone: "success" });
    await refresh();
    await refreshSelected(selected.id);
  }

  async function submitPayment() {
    if (!selected) return;
    setError(null);
    try {
      await recordPayment(selected.id, props.user, {
        method: payForm.method,
        amount: Number(payForm.amount) || 0,
        paymentType: payForm.paymentType,
        note: payForm.note || undefined,
      });
      await refresh();
      await refreshSelected(selected.id);
      setPayOpen(false);
      setPayForm({ method: "card", amount: "", paymentType: "payment", note: "" });
      toast({ title: "Payment recorded", message: selected.id, tone: "success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    }
  }

  async function runRefund(payment: Payment) {
    if (!selected) return;
    try {
      await refundPayment(payment.id, props.user);
      await refresh();
      await refreshSelected(selected.id);
      toast({ title: "Refund recorded", message: payment.reference, tone: "warning" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <div className="text-2xl font-extrabold text-gray-900">Invoices & Payments</div>
        <div className="text-sm font-semibold text-gray-500">Partial payments, deposits, tips, refunds, and accounting exports.</div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex-1 min-w-[220px]">
          <Input label="Search" value={q} onChange={setQ} placeholder="Invoice ID, job ID, status…" />
        </div>
        <label className="block">
          <div className="mb-1 text-sm font-semibold text-gray-800">Status</div>
          <select
            className="w-full min-w-[160px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="draft">draft</option>
            <option value="sent">sent</option>
            <option value="paid">paid</option>
            <option value="overdue">overdue</option>
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => { setQ(""); setStatusFilter("all"); }}>Clear</Button>
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <Button variant="secondary" onClick={exportQuickBooks}>QuickBooks CSV</Button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
          <div className="col-span-3">Invoice</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-2">Due</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3 text-right">Open</div>
        </div>
        <div className="divide-y divide-gray-100">
          {filtered.length === 0 ? <div className="p-4 text-sm font-semibold text-gray-500">No invoices.</div> : filtered.map((inv) => (
            <div key={inv.id} className="grid grid-cols-12 gap-2 p-3">
              <div className="col-span-3">
                <div className="font-extrabold text-gray-900">{inv.id}</div>
                <div className="text-sm font-semibold text-gray-600">Job {inv.jobId}</div>
              </div>
              <div className="col-span-2 text-sm font-semibold text-gray-700">{new Date(inv.createdAt).toLocaleDateString()}</div>
              <div className="col-span-2 text-sm font-semibold text-gray-700">{new Date(inv.dueDate).toLocaleDateString()}</div>
              <div className="col-span-2"><Badge tone={toneForStatus(inv.status)}>{inv.status}</Badge></div>
              <div className="col-span-3 flex justify-end">
                <Button onClick={() => openInvoice(inv)}>Details</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        title={selected ? `Invoice ${selected.id}` : "Invoice"}
        open={open}
        onClose={close}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              {selected ? <Button variant="secondary" onClick={() => window.open(`/app/invoices/${selected.id}/print`, "_blank")}>Print</Button> : null}
              {selected && props.user.role !== "customer" ? <Button variant="secondary" onClick={sendInvoice}>Send</Button> : null}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>Close</Button>
              {selected && props.user.role === "customer" ? <Button onClick={() => { setPayForm((p) => ({ ...p, amount: paymentSummary ? String(paymentSummary.balance) : "" })); setPayOpen(true); }}>Pay / deposit</Button> : null}
            </div>
          </div>
        }
      >
        {!selected || !totals || !paymentSummary ? (
          <div className="text-sm font-semibold text-gray-500">Loading invoice…</div>
        ) : (
          <div className="space-y-4">
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 p-3">
                <div className="text-xs font-bold text-gray-500">Customer</div>
                <div className="text-sm font-extrabold text-gray-900">{customerName}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 p-3">
                <div className="text-xs font-bold text-gray-500">Invoice total</div>
                <div className="text-sm font-extrabold text-gray-900">${totals.total.toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 p-3">
                <div className="text-xs font-bold text-gray-500">Collected</div>
                <div className="text-sm font-extrabold text-gray-900">${(paymentSummary.paid + paymentSummary.deposits).toFixed(2)}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 p-3">
                <div className="text-xs font-bold text-gray-500">Balance due</div>
                <div className="text-sm font-extrabold text-gray-900">${paymentSummary.balance.toFixed(2)}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="grid grid-cols-12 gap-2 bg-gray-50 p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit</div>
                <div className="col-span-2 text-right">Line</div>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map((it) => (
                  <div key={it.id} className="grid grid-cols-12 gap-2 p-3">
                    <div className="col-span-6 text-sm font-semibold text-gray-900">{it.description}</div>
                    <div className="col-span-2 text-right text-sm font-semibold text-gray-700">{it.qty}</div>
                    <div className="col-span-2 text-right text-sm font-semibold text-gray-700">${it.unitPrice.toFixed(2)}</div>
                    <div className="col-span-2 text-right text-sm font-semibold text-gray-700">${(it.qty * it.unitPrice).toFixed(2)}</div>
                    {props.user.role !== "customer" ? (
                      <div className="col-span-12 flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => beginEditItem(it)}>Edit</Button>
                        <Button variant="danger" onClick={() => removeItem(it.id)}>Delete</Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {props.user.role !== "customer" ? <div className="border-t border-gray-100 p-3"><Button onClick={beginNewItem}>Add line item</Button></div> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="text-sm font-extrabold text-gray-900">Accounting</div>
                <div className="mt-3 space-y-1 text-sm font-semibold text-gray-700">
                  <div>Subtotal: ${totals.subtotal.toFixed(2)}</div>
                  <div>Tax: ${totals.tax.toFixed(2)}</div>
                  <div>Total: ${totals.total.toFixed(2)}</div>
                  <div>Deposits: ${paymentSummary.deposits.toFixed(2)}</div>
                  <div>Payments: ${paymentSummary.paid.toFixed(2)}</div>
                  <div>Tips: ${paymentSummary.tips.toFixed(2)}</div>
                  <div>Refunds: ${paymentSummary.refunds.toFixed(2)}</div>
                  <div className="font-extrabold text-gray-900">Balance: ${paymentSummary.balance.toFixed(2)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="text-sm font-extrabold text-gray-900">Payment history</div>
                <div className="mt-3 space-y-2">
                  {payments.length === 0 ? <div className="text-sm font-semibold text-gray-500">No payments yet.</div> : payments.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-extrabold text-gray-900">{p.paymentType ?? "payment"} • ${p.amount.toFixed(2)}</div>
                        <div className="text-xs font-semibold text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-gray-600">{p.method} • {p.reference}</div>
                      {p.note ? <div className="mt-1 text-xs font-semibold text-gray-600">{p.note}</div> : null}
                      {props.user.role === "admin" && (p.paymentType ?? "payment") !== "refund" ? (
                        <div className="mt-2 flex justify-end">
                          <Button variant="secondary" onClick={() => runRefund(p)}>Refund</Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {editMode ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <Input label="Description" value={editForm.description} onChange={(v) => setEditForm((p) => ({ ...p, description: v }))} />
                  </div>
                  <Input label="Qty" type="number" value={editForm.qty} onChange={(v) => setEditForm((p) => ({ ...p, qty: v }))} />
                  <Input label="Unit price" type="number" step={0.01} value={editForm.unitPrice} onChange={(v) => setEditForm((p) => ({ ...p, unitPrice: v }))} />
                  <div className="flex items-end gap-2">
                    <Button onClick={saveItem}>Save</Button>
                    <Button variant="secondary" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal
        title="Record payment / deposit / tip"
        open={payOpen}
        onClose={() => setPayOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitPayment}>Save</Button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Type</div>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
              value={payForm.paymentType}
              onChange={(e) => setPayForm((p) => ({ ...p, paymentType: e.target.value as any }))}
            >
              <option value="payment">Payment</option>
              <option value="deposit">Deposit</option>
              <option value="tip">Tip</option>
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Method</div>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
              value={payForm.method}
              onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value as PaymentMethod }))}
            >
              <option value="card">card</option>
              <option value="debit">debit</option>
              <option value="apple_pay">apple pay</option>
              <option value="google_pay">google pay</option>
              <option value="ach">ACH</option>
              <option value="financing">financing</option>
              <option value="cash">cash</option>
              <option value="check">check</option>
              <option value="etransfer">etransfer</option>
            </select>
          </label>
          <Input label="Amount" type="number" step={0.01} value={payForm.amount} onChange={(v) => setPayForm((p) => ({ ...p, amount: v }))} />
          <Input label="Note" value={payForm.note} onChange={(v) => setPayForm((p) => ({ ...p, note: v }))} placeholder="Optional" />
        </div>
      </Modal>
    </div>
  );
}
