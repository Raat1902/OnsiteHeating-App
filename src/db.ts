import Dexie, { type Table } from "dexie";
import type {
  Attachment,
  AuditEvent,
  Branch,
  CustomerReview,
  Equipment,
  IntegrationSetting,
  Invoice,
  InvoiceItem,
  Job,
  JobNote,
  LoyaltyEvent,
  MaintenanceReminder,
  MarketingCampaign,
  Message,
  Notification,
  Part,
  Payment,
  Promotion,
  Quote,
  QuoteOption,
  SmsLog,
  TechnicianLocation,
  TechnicianProfile,
  TimeEntry,
  TrainingResource,
  TruckInventory,
  User,
} from "./types";

export class AppDb extends Dexie {
  users!: Table<User, string>;
  techProfiles!: Table<TechnicianProfile, string>;
  branches!: Table<Branch, string>;
  equipment!: Table<Equipment, string>;
  reminders!: Table<MaintenanceReminder, string>;

  jobs!: Table<Job, string>;
  jobNotes!: Table<JobNote, string>;
  timeEntries!: Table<TimeEntry, string>;
  attachments!: Table<Attachment, string>;

  promotions!: Table<Promotion, string>;

  invoices!: Table<Invoice, string>;
  invoiceItems!: Table<InvoiceItem, string>;
  payments!: Table<Payment, string>;

  parts!: Table<Part, string>;
  truckInventory!: Table<TruckInventory, string>;

  quotes!: Table<Quote, string>;
  quoteOptions!: Table<QuoteOption, string>;

  messages!: Table<Message, string>;
  notifications!: Table<Notification, string>;
  smsLogs!: Table<SmsLog, string>;
  auditEvents!: Table<AuditEvent, string>;

  technicianLocations!: Table<TechnicianLocation, string>;
  customerReviews!: Table<CustomerReview, string>;
  loyaltyEvents!: Table<LoyaltyEvent, string>;
  trainingResources!: Table<TrainingResource, string>;
  marketingCampaigns!: Table<MarketingCampaign, string>;
  integrationSettings!: Table<IntegrationSetting, string>;

  constructor() {
    super("onsiteheating.pro.db.v1");

    this.version(1).stores({
      users: "id, email, role, createdAt",
      techProfiles: "id, userId, isAvailable",
      equipment: "id, customerId, type, warrantyExpiry",
      reminders: "id, customerId, equipmentId, dueDate, status",

      jobs: "id, customerId, technicianId, status, scheduledStart, priority",
      jobNotes: "id, jobId, authorId, createdAt, visibility",
      timeEntries: "id, jobId, technicianId, startedAt",
      attachments: "id, jobId, uploaderId, createdAt, kind",

      promotions: "id, code, active, validFrom, validTo",

      invoices: "id, jobId, customerId, status, createdAt",
      invoiceItems: "id, invoiceId",
      payments: "id, invoiceId, customerId, createdAt",

      parts: "id, sku, stockQty",
      truckInventory: "id, technicianId, partId",

      quotes: "id, customerId, status, createdAt",
      quoteOptions: "id, quoteId, tier",

      messages: "id, threadType, threadId, createdAt",
      notifications: "id, userId, createdAt, read, type",
      smsLogs: "id, createdAt, toPhone",
    });

    this.version(2).stores({
      users: "id, email, role, createdAt",
      techProfiles: "id, userId, isAvailable",
      equipment: "id, customerId, type, warrantyExpiry",
      reminders: "id, customerId, equipmentId, dueDate, status",

      jobs: "id, customerId, technicianId, status, scheduledStart, priority",
      jobNotes: "id, jobId, authorId, createdAt, visibility",
      timeEntries: "id, jobId, technicianId, startedAt",
      attachments: "id, jobId, uploaderId, createdAt, kind",

      promotions: "id, code, active, validFrom, validTo",

      invoices: "id, jobId, customerId, status, createdAt",
      invoiceItems: "id, invoiceId",
      payments: "id, invoiceId, customerId, createdAt",

      parts: "id, sku, stockQty",
      truckInventory: "id, technicianId, partId",

      quotes: "id, customerId, status, createdAt",
      quoteOptions: "id, quoteId, tier",

      messages: "id, threadType, threadId, createdAt",
      notifications: "id, userId, createdAt, read, type",
      smsLogs: "id, createdAt, toPhone",

      auditEvents: "id, at, actorId, actorRole, entityType, entityId, jobId, action",
    });

    this.version(3).stores({
      users: "id, email, role, createdAt",
      techProfiles: "id, userId, isAvailable, branchId",
      branches: "id, region, name",
      equipment: "id, customerId, type, warrantyExpiry",
      reminders: "id, customerId, equipmentId, dueDate, status",

      jobs: "id, customerId, technicianId, status, scheduledStart, priority, branchId, bookingWindow",
      jobNotes: "id, jobId, authorId, createdAt, visibility",
      timeEntries: "id, jobId, technicianId, startedAt",
      attachments: "id, jobId, uploaderId, createdAt, kind, equipmentId",

      promotions: "id, code, active, validFrom, validTo",

      invoices: "id, jobId, customerId, status, createdAt",
      invoiceItems: "id, invoiceId",
      payments: "id, invoiceId, customerId, createdAt",

      parts: "id, sku, stockQty, barcode",
      truckInventory: "id, technicianId, partId",

      quotes: "id, customerId, status, createdAt",
      quoteOptions: "id, quoteId, tier",

      messages: "id, threadType, threadId, createdAt",
      notifications: "id, userId, createdAt, read, type",
      smsLogs: "id, createdAt, toPhone",

      auditEvents: "id, at, actorId, actorRole, entityType, entityId, jobId, action",

      technicianLocations: "id, technicianId, at, status, routeJobId",
      customerReviews: "id, jobId, customerId, technicianId, createdAt",
      loyaltyEvents: "id, customerId, createdAt",
      trainingResources: "id, category, kind",
      marketingCampaigns: "id, channel, status, createdAt",
      integrationSettings: "id, key, enabled",
    });
  }
}

export const db = new AppDb();
