import { db } from "../db";
import { newId } from "./id";
import type {
  Attachment,
  AuditEvent,
  Equipment,
  Invoice,
  InvoiceItem,
  Job,
  JobNote,
  Message,
  Part,
  Payment,
  Promotion,
  Quote,
  QuoteOption,
  TechnicianProfile,
  TimeEntry,
  TruckInventory,
  User,
} from "../types";
import { applyCompletionAutomations, getAutomationSettings } from "./automation";
import { calcPromoDiscount, computeInvoicePayments, computeInvoiceTotals, createNotification, ensureInvoiceForJob, promoApplies } from "./domain";
import { buildTechnicianSuggestions, findConflictsForTech } from "./scheduling";

export async function createAuditEvent(input: Omit<AuditEvent, "id" | "at"> & { at?: string }): Promise<AuditEvent> {
  const e: AuditEvent = {
    id: newId("aud"),
    at: input.at ?? new Date().toISOString(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityType: input.entityType,
    entityId: input.entityId,
    jobId: input.jobId,
    action: input.action,
    title: input.title,
    details: input.details,
  };
  await db.auditEvents.put(e);
  return e;
}

export async function listAuditEventsForJob(jobId: string, limit = 50): Promise<AuditEvent[]> {
  const list = await db.auditEvents.where("jobId").equals(jobId).toArray();
  return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export async function listJobsForUser(user: User): Promise<Job[]> {
  if (user.role === "admin") return db.jobs.orderBy("scheduledStart").reverse().toArray();
  if (user.role === "technician") return db.jobs.where("technicianId").equals(user.id).toArray();
  return db.jobs.where("customerId").equals(user.id).toArray();
}

export function defaultChecklist(serviceType: Job["serviceType"]) {
  if (serviceType === "maintenance") {
    return [
      { id: newId("chk"), label: "Inspect system", done: false },
      { id: newId("chk"), label: "Replace filter (if needed)", done: false },
      { id: newId("chk"), label: "Check safety controls", done: false },
      { id: newId("chk"), label: "Test thermostat + run cycle", done: false },
    ];
  }
  if (serviceType === "repair") {
    return [
      { id: newId("chk"), label: "Verify symptom with customer", done: false },
      { id: newId("chk"), label: "Run diagnostics", done: false },
      { id: newId("chk"), label: "Perform repair", done: false },
      { id: newId("chk"), label: "Verify normal operation", done: false },
    ];
  }
  if (serviceType === "installation") {
    return [
      { id: newId("chk"), label: "Confirm equipment specs", done: false },
      { id: newId("chk"), label: "Install equipment", done: false },
      { id: newId("chk"), label: "Commission + safety checks", done: false },
      { id: newId("chk"), label: "Customer walkthrough", done: false },
    ];
  }
  return [
    { id: newId("chk"), label: "Confirm emergency details", done: false },
    { id: newId("chk"), label: "Stabilize system / safety", done: false },
    { id: newId("chk"), label: "Repair or temporary fix", done: false },
    { id: newId("chk"), label: "Document findings", done: false },
  ];
}

export function defaultPreChecklist() {
  return [
    { id: newId("chk"), label: "Review equipment history", done: false },
    { id: newId("chk"), label: "Confirm site access and arrival window", done: false },
    { id: newId("chk"), label: "Confirm required truck stock", done: false },
  ];
}

export function defaultSafetyChecklist() {
  return [
    { id: newId("chk"), label: "PPE ready", done: false },
    { id: newId("chk"), label: "Electrical / gas isolation verified", done: false },
    { id: newId("chk"), label: "Safe work area established", done: false },
  ];
}

export function defaultPostChecklist() {
  return [
    { id: newId("chk"), label: "System running at departure", done: false },
    { id: newId("chk"), label: "Work area cleaned", done: false },
    { id: newId("chk"), label: "Customer walk-through completed", done: false },
  ];
}

export async function createJobByCustomer(input: {
  customer: User;
  title: string;
  description: string;
  serviceType: Job["serviceType"];
  priority: Job["priority"];
  scheduledStart: string;
  durationMinutes: number;
  promoCode?: string;
  equipmentId?: string;
  bookingWindow?: Job["bookingWindow"];
}): Promise<Job> {
  const now = new Date().toISOString();
  const priority = input.serviceType === "emergency" ? "emergency" : input.customer.membershipPlan === "platinum" && input.priority === "medium" ? "high" : input.priority;
  const job: Job = {
    id: newId("job"),
    customerId: input.customer.id,
    equipmentId: input.equipmentId,
    title: input.title.trim(),
    description: input.description.trim(),
    serviceType: input.serviceType,
    priority,
    status: "scheduled",
    bookingWindow: input.bookingWindow ?? "flex",
    routeStatus: "scheduled",
    scheduledStart: input.scheduledStart,
    durationMinutes: input.durationMinutes,
    customerAddress: input.customer.address,
    customerPhone: input.customer.phone,
    checklist: defaultChecklist(input.serviceType),
    preJobChecklist: defaultPreChecklist(),
    safetyChecklist: defaultSafetyChecklist(),
    postJobChecklist: defaultPostChecklist(),
    diagnostics: { notes: "", warrantyChecked: false },
    partsUsed: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.jobs.add(job);

  await createNotification(
    input.customer.id,
    "Booking confirmed",
    `Your booking "${job.title}" is scheduled for ${new Date(job.scheduledStart).toLocaleString()}${job.bookingWindow ? ` (${job.bookingWindow})` : ""} (Job ${job.id}).`,
    "job"
  );

  let promoCode = input.promoCode?.trim().toUpperCase();
  if (!promoCode && getAutomationSettings().autoApplyPromotions) {
    const promos = await db.promotions.toArray();
    const active = promos.find((p) => promoApplies(p, job.serviceType, now));
    if (active) promoCode = active.code;
  }

  if (promoCode) {
    const promo = await db.promotions.where("code").equals(promoCode).first();
    if (promo && promoApplies(promo, job.serviceType, now)) {
      promo.uses += 1;
      await db.promotions.put(promo);

      await db.jobNotes.add({
        id: newId("note"),
        jobId: job.id,
        authorId: input.customer.id,
        createdAt: now,
        text: `Promo applied: ${promo.code} (${promo.title}).`,
        visibility: "shared",
      });

      const estimate = job.serviceType === "installation" ? 450 : job.serviceType === "emergency" ? 225 : 150;
      const discount = calcPromoDiscount(promo, estimate);
      const inv = await ensureInvoiceForJob(job.id);
      inv.promoCode = promo.code;
      inv.discountAmount = discount;
      await db.invoices.put(inv);
    }
  }

  return job;
}

export async function assignJob(jobId: string, technicianId: string, actor: User): Promise<Job> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found");
  const allJobs = await db.jobs.toArray();
  const conflicts = findConflictsForTech(job, technicianId, allJobs);
  if (conflicts.length > 0 && job.priority !== "emergency") {
    throw new Error(`Scheduling conflict with ${conflicts.length} overlapping job(s). Move the job or mark it emergency.`);
  }
  job.technicianId = technicianId;
  job.status = "assigned";
  job.updatedAt = new Date().toISOString();
  await db.jobs.put(job);

  await createNotification(technicianId, "New job assigned", `You were assigned: "${job.title}" (Job ${job.id}).`, "job");
  await createNotification(job.customerId, "Technician assigned", `A technician was assigned to your job "${job.title}".`, "job");

  await createAuditEvent({
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "job",
    entityId: job.id,
    jobId: job.id,
    action: "job.assigned",
    title: "Technician assigned",
    details: `Assigned technician ${technicianId}${conflicts.length ? ` with ${conflicts.length} overlap(s)` : ""}`,
  });

  return job;
}

export async function autoAssignJob(jobId: string, actor: User): Promise<Job> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found");
  const techs = await listTechnicians();
  const jobs = await db.jobs.toArray();
  const suggestions = buildTechnicianSuggestions(job, techs, jobs);
  const best = suggestions.find((s) => s.isAvailable && (job.priority === "emergency" || s.conflicts === 0)) ?? suggestions[0];
  if (!best) throw new Error("No technicians available");
  return assignJob(jobId, best.technicianId, actor);
}

export async function moveJobSchedule(jobId: string, scheduledStart: string, actor: User): Promise<Job> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found");
  job.scheduledStart = scheduledStart;
  job.updatedAt = new Date().toISOString();
  await db.jobs.put(job);
  await createAuditEvent({
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "job",
    entityId: job.id,
    jobId: job.id,
    action: "job.rescheduled",
    title: "Job rescheduled",
    details: new Date(scheduledStart).toLocaleString(),
  });
  return job;
}

export async function updateJob(jobId: string, patch: Partial<Job>, actor?: User): Promise<Job> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found");
  const prev = { ...job };
  const next = { ...job, ...patch, updatedAt: new Date().toISOString() } as Job;
  if (patch.status === "completed") next.routeStatus = "completed";
  await db.jobs.put(next);

  if (actor) {
    if (patch.status && patch.status !== prev.status) {
      await createAuditEvent({
        actorId: actor.id,
        actorRole: actor.role,
        entityType: "job",
        entityId: next.id,
        jobId: next.id,
        action: "job.status_changed",
        title: `Status → ${patch.status}`,
        details: `${prev.status} → ${patch.status}`,
      });
    }

    if (patch.routeStatus && patch.routeStatus !== prev.routeStatus) {
      await createAuditEvent({
        actorId: actor.id,
        actorRole: actor.role,
        entityType: "job",
        entityId: next.id,
        jobId: next.id,
        action: "job.route_status",
        title: `Route status → ${patch.routeStatus}`,
      });

      if (patch.routeStatus === "en_route") {
        await createNotification(next.customerId, "Technician on the way", `Your technician is on the way for "${next.title}".`, "job");
      }
      if (patch.routeStatus === "arrived") {
        await createNotification(next.customerId, "Technician arrived", `Your technician has arrived for "${next.title}".`, "job");
      }
    }

    if (patch.checklist) {
      const beforeDone = (prev.checklist ?? []).filter((c) => c.done).length;
      const afterDone = (next.checklist ?? []).filter((c) => c.done).length;
      if (beforeDone !== afterDone) {
        await createAuditEvent({
          actorId: actor.id,
          actorRole: actor.role,
          entityType: "job",
          entityId: next.id,
          jobId: next.id,
          action: "job.checklist_progress",
          title: `Checklist ${afterDone}/${(next.checklist ?? []).length}`,
        });
      }
    }

    if (patch.diagnostics) {
      await createAuditEvent({
        actorId: actor.id,
        actorRole: actor.role,
        entityType: "job",
        entityId: next.id,
        jobId: next.id,
        action: "job.diagnostics_updated",
        title: "Diagnostics updated",
      });
    }
  }

  if (patch.status === "completed" && prev.status !== "completed") {
    await applyCompletionAutomations(next.id);
  }

  return next;
}

export async function addJobNote(input: { jobId: string; authorId: string; text: string; visibility: JobNote["visibility"] }) {
  const note: JobNote = {
    id: newId("note"),
    jobId: input.jobId,
    authorId: input.authorId,
    createdAt: new Date().toISOString(),
    text: input.text.trim(),
    visibility: input.visibility,
  };
  await db.jobNotes.add(note);
}

export async function listJobNotes(jobId: string): Promise<JobNote[]> {
  return db.jobNotes.where("jobId").equals(jobId).sortBy("createdAt");
}

export async function addAttachment(input: Omit<Attachment, "id" | "createdAt">) {
  const a: Attachment = { ...input, id: newId("att"), createdAt: new Date().toISOString() };
  await db.attachments.add(a);
}

export async function listAttachments(jobId: string): Promise<Attachment[]> {
  return db.attachments.where("jobId").equals(jobId).sortBy("createdAt");
}

export async function listEquipmentAttachments(equipmentId: string): Promise<Attachment[]> {
  const all = await db.attachments.toArray();
  return all.filter((a) => a.equipmentId === equipmentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function startTime(jobId: string, techId: string) {
  const open = await db.timeEntries.where({ jobId, technicianId: techId }).and((t) => !t.endedAt).first();
  if (open) return;
  const t: TimeEntry = { id: newId("time"), jobId, technicianId: techId, startedAt: new Date().toISOString() };
  await db.timeEntries.add(t);
}

export async function stopTime(jobId: string, techId: string) {
  const open = await db.timeEntries.where({ jobId, technicianId: techId }).and((t) => !t.endedAt).first();
  if (!open) return;
  open.endedAt = new Date().toISOString();
  await db.timeEntries.put(open);
}

export async function listTimeEntries(jobId: string): Promise<TimeEntry[]> {
  return db.timeEntries.where("jobId").equals(jobId).sortBy("startedAt");
}

export async function listInvoicesForUser(user: User): Promise<Invoice[]> {
  if (user.role === "admin" || user.role === "technician") return db.invoices.orderBy("createdAt").reverse().toArray();
  return db.invoices.where("customerId").equals(user.id).toArray();
}

export async function listInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  return db.invoiceItems.where("invoiceId").equals(invoiceId).toArray();
}

export async function upsertInvoiceItem(item: InvoiceItem): Promise<void> {
  await db.invoiceItems.put(item);
}

export async function deleteInvoiceItem(itemId: string) {
  await db.invoiceItems.delete(itemId);
}

export async function markInvoiceSent(invoiceId: string, actor?: User) {
  const inv = await db.invoices.get(invoiceId);
  if (!inv) throw new Error("Invoice not found");
  inv.status = "sent";
  await db.invoices.put(inv);
  await createNotification(inv.customerId, "Invoice sent", `Invoice ${inv.id} is ready to view and pay.`, "invoice");
  if (actor) {
    await createAuditEvent({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "invoice",
      entityId: inv.id,
      jobId: inv.jobId,
      action: "invoice.sent",
      title: "Invoice sent",
      details: inv.id,
    });
  }
}

export async function recordPayment(
  invoiceId: string,
  customer: User,
  input: { method: Payment["method"]; amount: number; paymentType?: Payment["paymentType"]; note?: string; tipAmount?: number }
) {
  const inv = await db.invoices.get(invoiceId);
  if (!inv) throw new Error("Invoice not found");
  if (inv.customerId !== customer.id && customer.role !== "admin") throw new Error("Not allowed");
  if ((input.paymentType ?? "payment") !== "refund") {
    const balances = await computeInvoicePayments(inv.id);
    if (input.amount > balances.balance + 0.01 && input.paymentType !== "tip") throw new Error("Amount exceeds balance due");
  }

  const p: Payment = {
    id: newId("pay"),
    invoiceId: inv.id,
    customerId: inv.customerId,
    createdAt: new Date().toISOString(),
    method: input.method,
    amount: Math.max(0, Number(input.amount) || 0),
    status: "completed",
    reference: `RCPT-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
    paymentType: input.paymentType ?? "payment",
    note: input.note?.trim() || undefined,
    tipAmount: input.tipAmount ? Number(input.tipAmount) : undefined,
  };
  if (p.amount <= 0) throw new Error("Enter a payment amount");
  await db.payments.add(p);

  const balance = await computeInvoicePayments(inv.id);
  inv.status = balance.balance <= 0 ? "paid" : inv.status === "draft" ? "sent" : inv.status;
  await db.invoices.put(inv);

  await createAuditEvent({
    actorId: customer.id,
    actorRole: customer.role,
    entityType: "invoice",
    entityId: inv.id,
    jobId: inv.jobId,
    action: "invoice.payment",
    title: `${p.paymentType ?? "payment"} recorded`,
    details: `${p.method} $${p.amount.toFixed(2)}`,
  });

  await createNotification(inv.customerId, "Payment recorded", `${p.paymentType ?? "payment"} received for invoice ${inv.id}. Receipt ${p.reference}.`, "invoice");
  return p;
}

export async function payInvoice(invoiceId: string, customer: User, method: Payment["method"]) {
  const totals = await computeInvoiceTotals(invoiceId);
  return recordPayment(invoiceId, customer, { method, amount: totals.total, paymentType: "payment" });
}

export async function refundPayment(paymentId: string, actor: User, amount?: number) {
  const original = await db.payments.get(paymentId);
  if (!original) throw new Error("Payment not found");
  const inv = await db.invoices.get(original.invoiceId);
  if (!inv) throw new Error("Invoice not found");
  const refund: Payment = {
    id: newId("pay"),
    invoiceId: original.invoiceId,
    customerId: original.customerId,
    createdAt: new Date().toISOString(),
    method: original.method,
    amount: Math.max(0, Math.min(original.amount, amount ?? original.amount)),
    status: "completed",
    reference: `REF-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
    paymentType: "refund",
    refundedPaymentId: original.id,
  };
  await db.payments.add(refund);
  inv.status = "sent";
  await db.invoices.put(inv);
  await createAuditEvent({
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "invoice",
    entityId: inv.id,
    jobId: inv.jobId,
    action: "invoice.refund",
    title: "Refund recorded",
    details: `$${refund.amount.toFixed(2)}`,
  });
}

export async function listPayments(customerId: string): Promise<Payment[]> {
  const items = await db.payments.where("customerId").equals(customerId).sortBy("createdAt");
  return items.reverse();
}

export async function listPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
  const items = await db.payments.where("invoiceId").equals(invoiceId).toArray();
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listCustomers(): Promise<User[]> {
  return db.users.where("role").equals("customer").toArray();
}

export async function upsertCustomer(u: User) {
  await db.users.put(u);
}

export async function listEquipment(customerId: string): Promise<Equipment[]> {
  return db.equipment.where("customerId").equals(customerId).toArray();
}

export async function upsertEquipment(e: Equipment) {
  await db.equipment.put(e);
}

export async function deleteEquipment(equipmentId: string) {
  await db.equipment.delete(equipmentId);
}

export async function listTechnicians(): Promise<Array<{ user: User; profile: TechnicianProfile }>> {
  const techUsers = await db.users.where("role").equals("technician").toArray();
  const profiles = await db.techProfiles.toArray();
  return techUsers
    .map((u) => ({ user: u, profile: profiles.find((p) => p.userId === u.id)! }))
    .filter((x) => x.profile);
}

export async function upsertTechProfile(p: TechnicianProfile) {
  await db.techProfiles.put(p);
}

export async function listPromotions(): Promise<Promotion[]> {
  return db.promotions.orderBy("code").toArray();
}

export async function upsertPromotion(p: Promotion) {
  await db.promotions.put(p);
}

export async function deletePromotion(id: string) {
  await db.promotions.delete(id);
}

export async function listParts(): Promise<Part[]> {
  return db.parts.orderBy("name").toArray();
}

export async function upsertPart(p: Part) {
  await db.parts.put(p);
}

export async function adjustPartStock(partId: string, delta: number) {
  const p = await db.parts.get(partId);
  if (!p) throw new Error("Part not found");
  p.stockQty = Math.max(0, p.stockQty + delta);
  await db.parts.put(p);
}

export async function listTruckInventory(technicianId: string): Promise<Array<{ part: Part; qty: number; rowId: string }>> {
  const rows = await db.truckInventory.where("technicianId").equals(technicianId).toArray();
  const parts = await db.parts.toArray();
  return rows
    .map((r) => ({ rowId: r.id, part: parts.find((p) => p.id === r.partId)!, qty: r.qty }))
    .filter((x) => x.part);
}

export async function setTruckPartQty(technicianId: string, partId: string, qty: number) {
  const existing = await db.truckInventory.where({ technicianId, partId }).first();
  if (existing) {
    existing.qty = Math.max(0, qty);
    await db.truckInventory.put(existing);
    return;
  }
  const row: TruckInventory = { id: newId("truck"), technicianId, partId, qty: Math.max(0, qty) };
  await db.truckInventory.add(row);
}

export async function addPartUsedToJob(jobId: string, partId: string, qty: number, actor?: User) {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found");
  const part = await db.parts.get(partId);
  if (!part) throw new Error("Part not found");

  const q = Math.max(1, Math.floor(qty));
  if (part.stockQty < q) throw new Error("Not enough stock");

  part.stockQty -= q;
  await db.parts.put(part);

  const existing = job.partsUsed.find((x) => x.partId === partId);
  if (existing) existing.qty += q;
  else job.partsUsed.push({
    id: newId("used"),
    partId,
    name: part.name,
    qty: q,
    unitCost: part.unitCost,
    unitPrice: part.unitPrice,
  });

  job.updatedAt = new Date().toISOString();
  await db.jobs.put(job);

  if (actor) {
    await createAuditEvent({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "job",
      entityId: job.id,
      jobId: job.id,
      action: "job.part_used",
      title: "Part used",
      details: `${part.name} x${q}`,
    });
  }
}

export async function createQuote(input: { customerId: string; title: string; options: Array<Omit<QuoteOption, "id" | "quoteId">> }): Promise<Quote> {
  const q: Quote = { id: newId("quote"), customerId: input.customerId, title: input.title.trim(), status: "draft", createdAt: new Date().toISOString(), options: [] };
  await db.quotes.add(q);

  const opts: QuoteOption[] = input.options.map((o) => ({ id: newId("qopt"), quoteId: q.id, tier: o.tier, title: o.title, description: o.description, price: o.price, equipmentSpecs: o.equipmentSpecs }));
  await db.quoteOptions.bulkAdd(opts);
  return q;
}

export async function listQuotesForUser(user: User): Promise<Array<{ quote: Quote; options: QuoteOption[] }>> {
  const qs =
    user.role === "customer"
      ? (await db.quotes.where("customerId").equals(user.id).sortBy("createdAt")).reverse()
      : await db.quotes.orderBy("createdAt").reverse().toArray();
  const allOpts = await db.quoteOptions.toArray();
  return qs.map((q: Quote) => ({ quote: q, options: allOpts.filter((o) => o.quoteId === q.id) }));
}

export async function setQuoteStatus(quoteId: string, status: Quote["status"]) {
  const q = await db.quotes.get(quoteId);
  if (!q) throw new Error("Quote not found");
  q.status = status;
  await db.quotes.put(q);
  await createNotification(q.customerId, "Quote update", `Quote "${q.title}" status: ${status}`, "system");
}

export async function approveQuoteToJob(quoteId: string, customer: User) {
  const q = await db.quotes.get(quoteId);
  if (!q) throw new Error("Quote not found");
  if (q.customerId !== customer.id) throw new Error("Not allowed");
  q.status = "approved";
  await db.quotes.put(q);

  const options = await db.quoteOptions.where("quoteId").equals(quoteId).toArray();
  const best = options.find((o) => o.tier === "best") ?? options[0];

  const job = await createJobByCustomer({
    customer,
    title: `Install: ${best.title}`,
    description: `Approved quote: ${q.title}\n${best.description}`,
    serviceType: "installation",
    priority: "medium",
    scheduledStart: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 180,
    bookingWindow: "8-12",
  });

  const inv = await ensureInvoiceForJob(job.id);
  await db.invoiceItems.add({ id: newId("item"), invoiceId: inv.id, description: `Quote option: ${best.title}`, qty: 1, unitPrice: best.price });

  await createNotification(customer.id, "Quote approved", `We created a job from your approved quote. Job ${job.id}.`, "job");
}

export async function addMessage(jobId: string, senderId: string, text: string) {
  await db.messages.add({ id: newId("msg"), threadType: "job", threadId: jobId, senderId, text: text.trim(), createdAt: new Date().toISOString() });
}

export async function listMessages(jobId: string) {
  return db.messages.where({ threadType: "job", threadId: jobId }).sortBy("createdAt");
}

export async function listNotifications(userId: string) {
  const items = await db.notifications.where("userId").equals(userId).sortBy("createdAt");
  return items.reverse();
}

export async function markNotificationRead(id: string) {
  const n = await db.notifications.get(id);
  if (!n) return;
  n.read = true;
  await db.notifications.put(n);
}

export type ActivityItem = {
  id: string;
  kind: "job" | "invoice" | "payment" | "message";
  title: string;
  subtitle?: string;
  at: string;
  route: string;
};

export async function listRecentActivityForUser(user: User, limit = 15): Promise<ActivityItem[]> {
  const jobs =
    user.role === "admin"
      ? await db.jobs.orderBy("updatedAt").reverse().limit(limit).toArray()
      : user.role === "technician"
        ? await db.jobs.where("technicianId").equals(user.id).toArray()
        : await db.jobs.where("customerId").equals(user.id).toArray();

  const jobItems: ActivityItem[] = jobs
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((j) => ({
      id: j.id,
      kind: "job",
      title: `Job: ${j.title}`,
      subtitle: `${j.status} • ${j.serviceType}${j.bookingWindow ? ` • ${j.bookingWindow}` : ""}`,
      at: j.updatedAt,
      route: `/app/jobs/${j.id}`,
    }));

  let invoices: Invoice[] = [];
  if (user.role === "admin") invoices = await db.invoices.orderBy("createdAt").reverse().limit(limit).toArray();
  else if (user.role === "customer") invoices = await db.invoices.where("customerId").equals(user.id).toArray();
  else {
    const jobIds = jobs.map((j) => j.id);
    invoices = jobIds.length ? await db.invoices.where("jobId").anyOf(jobIds).toArray() : [];
  }

  const invoiceItems: ActivityItem[] = invoices
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((inv) => ({
      id: inv.id,
      kind: "invoice",
      title: `Invoice: ${inv.id}`,
      subtitle: inv.status,
      at: inv.createdAt,
      route: "/app/invoices",
    }));

  const payments =
    user.role === "customer"
      ? await db.payments.where("customerId").equals(user.id).toArray()
      : await db.payments.orderBy("createdAt").reverse().limit(limit).toArray();

  const paymentItems: ActivityItem[] = payments
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      kind: "payment",
      title: `${p.paymentType ?? "payment"}: $${Number(p.amount).toFixed(2)}`,
      subtitle: p.method,
      at: p.createdAt,
      route: "/app/invoices",
    }));

  let messages: Message[] = [];
  if (user.role === "admin") messages = await db.messages.orderBy("createdAt").reverse().limit(limit).toArray();
  else {
    const jobIds = jobs.map((j) => j.id);
    messages = jobIds.length ? await db.messages.where("threadId").anyOf(jobIds).toArray() : [];
  }

  const messageItems: ActivityItem[] = messages
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((m) => ({
      id: m.id,
      kind: "message",
      title: "New message",
      subtitle: m.text,
      at: m.createdAt,
      route: `/app/jobs/${m.threadId}`,
    }));

  const merged = [...jobItems, ...invoiceItems, ...paymentItems, ...messageItems].sort((a, b) => b.at.localeCompare(a.at));
  const seen = new Set<string>();
  const out: ActivityItem[] = [];
  for (const item of merged) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
