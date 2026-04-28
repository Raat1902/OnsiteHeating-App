import { db } from "../db";

type BackupAttachment = {
  id: string;
  jobId: string;
  uploaderId: string;
  createdAt: string;
  filename: string;
  mime: string;
  kind: "photo" | "voice" | "document";
  equipmentId?: string;
  photoStage?: "before" | "after" | "general";
  annotation?: string;
  compressed?: boolean;
  blobBase64: string;
};

export type BackupV2 = {
  formatVersion: 2;
  exportedAt: string;
  app: "onsite-heating-pro";
  tables: {
    users: any[];
    techProfiles: any[];
    equipment: any[];
    reminders: any[];
    jobs: any[];
    jobNotes: any[];
    timeEntries: any[];
    attachments: BackupAttachment[];
    promotions: any[];
    invoices: any[];
    invoiceItems: any[];
    payments: any[];
    parts: any[];
    truckInventory: any[];
    quotes: any[];
    quoteOptions: any[];
    messages: any[];
    notifications: any[];
    smsLogs: any[];
    auditEvents: any[];
  };
};

async function blobToBase64(blob: Blob): Promise<string> {
  const reader = new FileReader();
  const p = new Promise<string>((resolve, reject) => {
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.onload = () => resolve(String(reader.result ?? ""));
  });
  reader.readAsDataURL(blob);
  const dataUrl = await p;
  // "data:<mime>;base64,...."
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup(): Promise<BackupV2> {
  const [
    users,
    techProfiles,
    equipment,
    reminders,
    jobs,
    jobNotes,
    timeEntries,
    attachmentsRaw,
    promotions,
    invoices,
    invoiceItems,
    payments,
    parts,
    truckInventory,
    quotes,
    quoteOptions,
    messages,
    notifications,
    smsLogs,
    auditEvents,
  ] = await Promise.all([
    db.users.toArray(),
    db.techProfiles.toArray(),
    db.equipment.toArray(),
    db.reminders.toArray(),
    db.jobs.toArray(),
    db.jobNotes.toArray(),
    db.timeEntries.toArray(),
    db.attachments.toArray(),
    db.promotions.toArray(),
    db.invoices.toArray(),
    db.invoiceItems.toArray(),
    db.payments.toArray(),
    db.parts.toArray(),
    db.truckInventory.toArray(),
    db.quotes.toArray(),
    db.quoteOptions.toArray(),
    db.messages.toArray(),
    db.notifications.toArray(),
    db.smsLogs.toArray(),
    db.auditEvents.toArray(),
  ]);

  const attachments: BackupAttachment[] = [];
  for (const a of attachmentsRaw) {
    attachments.push({
      id: a.id,
      jobId: a.jobId,
      uploaderId: a.uploaderId,
      createdAt: a.createdAt,
      filename: a.filename,
      mime: a.mime,
      kind: a.kind,
      equipmentId: a.equipmentId,
      photoStage: a.photoStage,
      annotation: a.annotation,
      compressed: a.compressed,
      blobBase64: await blobToBase64(a.blob),
    });
  }

  return {
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    app: "onsite-heating-pro",
    tables: {
      users,
      techProfiles,
      equipment,
      reminders,
      jobs,
      jobNotes,
      timeEntries,
      attachments,
      promotions,
      invoices,
      invoiceItems,
      payments,
      parts,
      truckInventory,
      quotes,
      quoteOptions,
      messages,
      notifications,
      smsLogs,
      auditEvents,
    },
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `onsite-heating-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function assertBackupAny(data: any): any {
  if (!data || typeof data !== "object") throw new Error("Invalid backup file");
  if (data.app !== "onsite-heating-pro") throw new Error("Not an Onsite Heating Pro backup");
  if (data.formatVersion !== 1 && data.formatVersion !== 2) throw new Error("Unsupported backup version");
  if (!data.tables || typeof data.tables !== "object") throw new Error("Invalid backup content");
  return data;
}

export async function restoreBackupFromFile(file: File, opts?: { mode?: "replace" | "merge" }): Promise<void> {
  const mode = opts?.mode ?? "replace";
  const text = await file.text();
  const parsed = assertBackupAny(JSON.parse(text));

  await db.transaction("rw", db.tables, async () => {
      if (mode === "replace") {
        await Promise.all([
          db.users.clear(),
          db.techProfiles.clear(),
          db.equipment.clear(),
          db.reminders.clear(),
          db.jobs.clear(),
          db.jobNotes.clear(),
          db.timeEntries.clear(),
          db.attachments.clear(),
          db.promotions.clear(),
          db.invoices.clear(),
          db.invoiceItems.clear(),
          db.payments.clear(),
          db.parts.clear(),
          db.truckInventory.clear(),
          db.quotes.clear(),
          db.quoteOptions.clear(),
          db.messages.clear(),
          db.notifications.clear(),
          db.smsLogs.clear(),
        ]);
      }

      await Promise.all([
        db.users.bulkPut(parsed.tables.users),
        db.techProfiles.bulkPut(parsed.tables.techProfiles),
        db.equipment.bulkPut(parsed.tables.equipment),
        db.reminders.bulkPut(parsed.tables.reminders),
        db.jobs.bulkPut(parsed.tables.jobs),
        db.jobNotes.bulkPut(parsed.tables.jobNotes),
        db.timeEntries.bulkPut(parsed.tables.timeEntries),
        db.promotions.bulkPut(parsed.tables.promotions),
        db.invoices.bulkPut(parsed.tables.invoices),
        db.invoiceItems.bulkPut(parsed.tables.invoiceItems),
        db.payments.bulkPut(parsed.tables.payments),
        db.parts.bulkPut(parsed.tables.parts),
        db.truckInventory.bulkPut(parsed.tables.truckInventory),
        db.quotes.bulkPut(parsed.tables.quotes),
        db.quoteOptions.bulkPut(parsed.tables.quoteOptions),
        db.messages.bulkPut(parsed.tables.messages),
        db.notifications.bulkPut(parsed.tables.notifications),
        db.smsLogs.bulkPut(parsed.tables.smsLogs),
        db.auditEvents.bulkPut((parsed.tables.auditEvents ?? []) as any[]),
      ]);

      const att = parsed.tables.attachments.map((a: BackupAttachment) => ({
        id: a.id,
        jobId: a.jobId,
        uploaderId: a.uploaderId,
        createdAt: a.createdAt,
        filename: a.filename,
        mime: a.mime,
        kind: a.kind,
        equipmentId: a.equipmentId,
        photoStage: a.photoStage,
        annotation: a.annotation,
        compressed: a.compressed,
        blob: base64ToBlob(a.blobBase64, a.mime),
      }));
      if (att.length) await db.attachments.bulkPut(att as any[]);
    }
  );
}
