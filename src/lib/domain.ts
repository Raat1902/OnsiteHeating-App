import { addHours, differenceInMinutes, isAfter, isBefore } from "date-fns";
import { db } from "../db";
import { newId } from "./id";
import type { Invoice, InvoiceItem, Notification, Payment, Promotion, ServiceType } from "../types";

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function promoApplies(p: Promotion, serviceType: ServiceType, atIso: string): boolean {
  if (!p.active) return false;
  if (!p.serviceTypes.includes(serviceType)) return false;
  const at = new Date(atIso);
  if (at < new Date(p.validFrom)) return false;
  if (at > new Date(p.validTo)) return false;
  if (p.maxUses != null && p.uses >= p.maxUses) return false;
  return true;
}

export function calcPromoDiscount(p: Promotion, baseAmount: number): number {
  if (p.discountType === "fixed") return Math.min(baseAmount, p.discountValue);
  return Math.min(baseAmount, (baseAmount * p.discountValue) / 100);
}

export async function computeInvoiceTotals(invoiceId: string): Promise<{ subtotal: number; tax: number; total: number }> {
  const inv = await db.invoices.get(invoiceId);
  if (!inv) throw new Error("Invoice not found");
  const items = await db.invoiceItems.where("invoiceId").equals(invoiceId).toArray();
  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.unitPrice, 0) - inv.discountAmount);
  const tax = round2(Math.max(0, subtotal) * inv.taxRate);
  const total = round2(Math.max(0, subtotal) + tax);
  return { subtotal, tax, total };
}

export async function computeInvoicePayments(invoiceId: string): Promise<{ paid: number; deposits: number; refunds: number; tips: number; balance: number }> {
  const totals = await computeInvoiceTotals(invoiceId);
  const payments = await db.payments.where("invoiceId").equals(invoiceId).toArray();
  let paid = 0;
  let deposits = 0;
  let refunds = 0;
  let tips = 0;
  for (const p of payments) {
    const type = p.paymentType ?? "payment";
    if (type === "refund") refunds += p.amount;
    else if (type === "deposit") deposits += p.amount;
    else if (type === "tip") tips += p.amount;
    else paid += p.amount;
  }
  const collected = paid + deposits - refunds;
  return { paid: round2(paid), deposits: round2(deposits), refunds: round2(refunds), tips: round2(tips), balance: round2(Math.max(0, totals.total - collected)) };
}

export async function ensureInvoiceForJob(jobId: string): Promise<Invoice> {
  const existing = await db.invoices.where("jobId").equals(jobId).first();
  if (existing) return existing;

  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found");

  const inv: Invoice = {
    id: newId("inv"),
    jobId,
    customerId: job.customerId,
    status: "draft",
    createdAt: new Date().toISOString(),
    dueDate: addHours(new Date(), 24 * 14).toISOString(),
    discountAmount: 0,
    taxRate: job.serviceType === "maintenance" ? 0.05 : 0.07,
  };

  const baseItems: InvoiceItem[] = [
    { id: newId("item"), invoiceId: inv.id, description: `Labor - ${job.title}`, qty: 1, unitPrice: job.serviceType === "installation" ? 450 : job.serviceType === "emergency" ? 225 : 150 },
    { id: newId("item"), invoiceId: inv.id, description: "Materials", qty: 1, unitPrice: job.partsUsed.reduce((s, p) => s + p.qty * p.unitPrice, 0) },
  ];

  await db.invoices.add(inv);
  await db.invoiceItems.bulkAdd(baseItems);
  return inv;
}

export async function createNotification(userId: string, title: string, body: string, type: Notification["type"]) {
  const n: Notification = {
    id: newId("noti"),
    userId,
    createdAt: new Date().toISOString(),
    title,
    body,
    type,
    read: false,
  };
  await db.notifications.add(n);
}

export async function runAppointmentReminders() {
  const now = new Date();
  const soon = addHours(now, 24);
  const jobs = await db.jobs.where("status").anyOf(["scheduled", "assigned", "in_progress"]).toArray();

  for (const job of jobs) {
    const start = new Date(job.scheduledStart);
    if (isBefore(start, now) || isAfter(start, soon)) continue;

    const label = job.bookingWindow ? ` (${job.bookingWindow})` : "";
    const existing = await db.notifications
      .where("type")
      .equals("reminder")
      .and((n) => n.userId === job.customerId && n.body.includes(job.id) && differenceInMinutes(now, new Date(n.createdAt)) < 24 * 60)
      .first();

    if (!existing) {
      await createNotification(job.customerId, "Upcoming appointment reminder", `You have an upcoming appointment: "${job.title}" at ${start.toLocaleString()}${label} (Job ${job.id}).`, "reminder");

      const customer = await db.users.get(job.customerId);
      if (customer?.phone) {
        await db.smsLogs.add({
          id: newId("sms"),
          createdAt: new Date().toISOString(),
          toPhone: customer.phone,
          body: `Reminder: appointment "${job.title}" at ${start.toLocaleString()}${label}.`,
        });
      }
    }

    if (job.technicianId) {
      const techExisting = await db.notifications
        .where("type")
        .equals("reminder")
        .and((n) => n.userId === job.technicianId && n.body.includes(job.id) && differenceInMinutes(now, new Date(n.createdAt)) < 24 * 60)
        .first();
      if (!techExisting) {
        await createNotification(job.technicianId, "Upcoming job reminder", `Job "${job.title}" is scheduled at ${start.toLocaleString()}${label} (Job ${job.id}).`, "reminder");
      }
    }
  }
}

export async function customerLifetimeValue(customerId: string): Promise<number> {
  const paid = await db.payments.where("customerId").equals(customerId).toArray();
  return round2(
    paid.reduce((s, p) => {
      const sign = (p.paymentType ?? "payment") === "refund" ? -1 : 1;
      return s + p.amount * sign;
    }, 0)
  );
}

export function googleMapsLink(address: string): string {
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function quickbooksRows(input: { invoice: Invoice; totals: { subtotal: number; tax: number; total: number }; customerName?: string | null }) {
  return [
    {
      invoiceId: input.invoice.id,
      customer: input.customerName ?? input.invoice.customerId,
      invoiceDate: input.invoice.createdAt.slice(0, 10),
      dueDate: input.invoice.dueDate.slice(0, 10),
      status: input.invoice.status,
      subtotal: input.totals.subtotal,
      tax: input.totals.tax,
      total: input.totals.total,
    },
  ];
}
