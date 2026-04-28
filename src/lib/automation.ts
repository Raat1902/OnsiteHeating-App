import { addDays, addHours, isAfter, isBefore } from "date-fns";
import { db } from "../db";
import { newId } from "./id";
import { createNotification, ensureInvoiceForJob } from "./domain";
import type { Equipment, Invoice, Job, User } from "../types";

const SETTINGS_KEY = "onsite.automation.v1";

export type AutomationSettings = {
  autoMaintenanceJobs: boolean;
  autoSendInvoice: boolean;
  autoAppointmentReminders: boolean;
  autoUnpaidInvoiceAlerts: boolean;
  autoWarrantyAlerts: boolean;
  autoApplyPromotions: boolean;
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  autoMaintenanceJobs: true,
  autoSendInvoice: true,
  autoAppointmentReminders: true,
  autoUnpaidInvoiceAlerts: true,
  autoWarrantyAlerts: true,
  autoApplyPromotions: true,
};

export function getAutomationSettings(): AutomationSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_AUTOMATION_SETTINGS;
  try {
    return { ...DEFAULT_AUTOMATION_SETTINGS, ...(JSON.parse(raw) as Partial<AutomationSettings>) };
  } catch {
    return DEFAULT_AUTOMATION_SETTINGS;
  }
}

export function setAutomationSettings(next: AutomationSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

async function notificationExists(userId: string, bodyIncludes: string, type: "invoice" | "reminder" | "job" | "system") {
  const list = await db.notifications.where("userId").equals(userId).toArray();
  return list.some((n) => n.type === type && n.body.includes(bodyIncludes));
}

async function maybeCreateMaintenanceReminder(equipment: Equipment) {
  const interval = equipment.maintenanceIntervalMonths ?? 12;
  const anchor = new Date(equipment.lastServiceDate ?? equipment.installDate);
  const due = new Date(anchor);
  due.setMonth(due.getMonth() + interval);
  const existing = await db.reminders
    .where("equipmentId")
    .equals(equipment.id)
    .and((r) => r.status !== "dismissed")
    .first();
  if (existing) return existing;
  await db.reminders.add({
    id: newId("rem"),
    customerId: equipment.customerId,
    equipmentId: equipment.id,
    dueDate: due.toISOString(),
    title: `${equipment.type} maintenance due`,
    status: "due",
    createdAt: new Date().toISOString(),
  });
  return null;
}

async function maybeCreateMaintenanceJob(equipment: Equipment) {
  const now = new Date();
  const dueSoon = addDays(now, 21);
  const reminders = await db.reminders.where("equipmentId").equals(equipment.id).toArray();
  const due = reminders.find((r) => r.status === "due" && isBefore(new Date(r.dueDate), dueSoon));
  if (!due) return;
  const existing = await db.jobs
    .where("customerId")
    .equals(equipment.customerId)
    .and((j) => j.equipmentId === equipment.id && j.serviceType === "maintenance" && new Date(j.scheduledStart) >= addDays(now, -30))
    .first();
  if (existing) return;

  const customer = await db.users.get(equipment.customerId);
  if (!customer) return;
  const when = addDays(now, 7);
  when.setHours(8, 0, 0, 0);

  const job: Job = {
    id: newId("job"),
    customerId: customer.id,
    equipmentId: equipment.id,
    title: `${equipment.brand} ${equipment.model} maintenance`,
    description: "Auto-generated maintenance visit from reminder/membership plan.",
    serviceType: "maintenance",
    priority: customer.membershipPlan === "platinum" ? "high" : "medium",
    status: "scheduled",
    bookingWindow: "8-12",
    routeStatus: "scheduled",
    scheduledStart: when.toISOString(),
    durationMinutes: 90,
    customerAddress: customer.address,
    customerPhone: customer.phone,
    checklist: [
      { id: newId("chk"), label: "Inspect overall system", done: false },
      { id: newId("chk"), label: "Check filter and airflow", done: false },
      { id: newId("chk"), label: "Run safety checks", done: false },
      { id: newId("chk"), label: "Review findings with customer", done: false },
    ],
    preJobChecklist: [
      { id: newId("chk"), label: "Confirm access / parking", done: false },
      { id: newId("chk"), label: "Review equipment history", done: false },
    ],
    safetyChecklist: [
      { id: newId("chk"), label: "PPE ready", done: false },
      { id: newId("chk"), label: "Combustion / electrical isolation verified", done: false },
    ],
    postJobChecklist: [
      { id: newId("chk"), label: "Area clean", done: false },
      { id: newId("chk"), label: "Customer advised", done: false },
    ],
    diagnostics: { notes: "Auto-created maintenance visit." },
    partsUsed: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.jobs.add(job);
  await createNotification(customer.id, "Maintenance visit scheduled", `We scheduled a maintenance visit for ${new Date(job.scheduledStart).toLocaleString()} (${job.id}).`, "job");
}

async function processInvoiceAutomations(inv: Invoice) {
  if (inv.status === "sent" && new Date(inv.dueDate) < new Date()) {
    inv.status = "overdue";
    await db.invoices.put(inv);
    const exists = await notificationExists(inv.customerId, inv.id, "invoice");
    if (!exists) await createNotification(inv.customerId, "Invoice overdue", `Invoice ${inv.id} is now overdue.`, "invoice");
  }
}

export async function runAutomationSweep(_user?: User | null): Promise<void> {
  const settings = getAutomationSettings();

  if (settings.autoMaintenanceJobs || settings.autoWarrantyAlerts) {
    const equipment = await db.equipment.toArray();
    for (const eq of equipment) {
      await maybeCreateMaintenanceReminder(eq);
      if (settings.autoMaintenanceJobs) await maybeCreateMaintenanceJob(eq);

      if (settings.autoWarrantyAlerts) {
        const expiry = new Date(eq.warrantyExpiry);
        const soon = addDays(new Date(), 60);
        if (isAfter(expiry, new Date()) && isBefore(expiry, soon)) {
          const exists = await notificationExists(eq.customerId, eq.id, "reminder");
          if (!exists) {
            await createNotification(eq.customerId, "Warranty review due", `${eq.brand} ${eq.model} warranty expires on ${expiry.toLocaleDateString()} (${eq.id}).`, "reminder");
          }
        }
      }
    }
  }

  if (settings.autoUnpaidInvoiceAlerts) {
    const invoices = await db.invoices.toArray();
    for (const inv of invoices) await processInvoiceAutomations(inv);
  }
}

export async function applyCompletionAutomations(jobId: string): Promise<void> {
  const settings = getAutomationSettings();
  const job = await db.jobs.get(jobId);
  if (!job) return;
  if (settings.autoSendInvoice) {
    const inv = await ensureInvoiceForJob(job.id);
    if (inv.status === "draft") {
      inv.status = "sent";
      inv.autoSentAt = new Date().toISOString();
      await db.invoices.put(inv);
      await createNotification(job.customerId, "Invoice ready", `Invoice ${inv.id} was auto-sent after job completion.`, "invoice");
      const customer = await db.users.get(job.customerId);
      if (customer?.phone) {
        await db.smsLogs.add({
          id: newId("sms"),
          createdAt: new Date().toISOString(),
          toPhone: customer.phone,
          body: `Your service for ${job.title} is complete. Invoice ${inv.id} is ready.`,
        });
      }
    }
  }
}
