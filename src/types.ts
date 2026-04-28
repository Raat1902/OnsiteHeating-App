export type Role = "customer" | "technician" | "admin";

export type ServiceType = "installation" | "repair" | "maintenance" | "emergency";
export type JobStatus = "draft" | "scheduled" | "assigned" | "in_progress" | "completed" | "cancelled";
export type Priority = "low" | "medium" | "high" | "emergency";
export type BookingWindow = "8-12" | "12-4" | "flex";
export type RouteStatus = "scheduled" | "en_route" | "arrived" | "completed";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type PaymentMethod = "card" | "cash" | "check" | "etransfer" | "debit" | "apple_pay" | "google_pay" | "ach" | "financing";
export type DiscountType = "percentage" | "fixed";
export type MembershipPlan = "none" | "silver" | "gold" | "platinum";

export type EquipmentType =
  | "furnace"
  | "boiler"
  | "ac_unit"
  | "heat_pump"
  | "water_heater"
  | "thermostat"
  | "ductwork";

export type EquipmentStatus = "active" | "needs_service" | "warranty_expired" | "replaced";

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  tags: string[];
  membershipPlan?: MembershipPlan;
  membershipStartedAt?: string;
  membershipAutoRenew?: boolean;
  referralCode?: string;
  loyaltyTier?: "starter" | "preferred" | "vip";
  passwordHash: string;
  createdAt: string;
}

export interface TechnicianProfile {
  id: string;
  userId: string;
  isAvailable: boolean;
  specialties: string[];
  homeBaseAddress?: string;
  maxDailyJobs?: number;
  workdayStartHour?: number;
  workdayEndHour?: number;
  branchId?: string;
  vehicleInfo?: string;
  vehicleColor?: string;
  rating?: number;
  certifications?: string[];
  warrantyExperience?: string[];
  liveGpsEnabled?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  region: string;
  phone: string;
  managerName?: string;
  emergencyPhone?: string;
}

export interface Equipment {
  id: string;
  customerId: string;
  type: EquipmentType;
  brand: string;
  model: string;
  serialNumber: string;
  installDate: string;
  warrantyExpiry: string;
  status: EquipmentStatus;
  lastServiceDate?: string;
  notes?: string;
  seerRating?: number;
  maintenanceIntervalMonths?: number;
  expectedLifespanYears?: number;
  replacementEstimate?: number;
  annualEnergyCostEstimate?: number;
  manufacturerReliability?: number;
  rebateProgramHint?: string;
}

export interface MaintenanceReminder {
  id: string;
  customerId: string;
  equipmentId: string;
  dueDate: string;
  title: string;
  status: "due" | "done" | "dismissed";
  createdAt: string;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface JobDiagnostics {
  thermostatReadingF?: number;
  supplyTempF?: number;
  returnTempF?: number;
  ambientTempF?: number;
  deltaTF?: number;
  suctionPsi?: number;
  dischargePsi?: number;
  pressurePsi?: number;
  superheatF?: number;
  subcoolF?: number;
  staticPressureInWc?: number;
  refrigerantType?: string;
  refrigerantAddedOz?: number;
  refrigerantRecoveredOz?: number;
  errorCode?: string;
  notes?: string;
  preJobNotes?: string;
  postJobNotes?: string;
  safetyRisks?: string;
  filterCondition?: string;
  warrantyChecked?: boolean;
  customerSignature?: string;
  customerApprovalAt?: string;
  serviceSummary?: string;
  coReadingPpm?: number;
  combustionEfficiencyPct?: number;
  aiLikelyCauses?: string[];
  aiRecommendedActions?: string[];
  arrivalProofNote?: string;
}

export interface JobPartUsed {
  id: string;
  partId: string;
  name: string;
  qty: number;
  unitCost: number;
  unitPrice: number;
}

export interface TimeEntry {
  id: string;
  jobId: string;
  technicianId: string;
  startedAt: string;
  endedAt?: string;
}

export interface Job {
  id: string;
  customerId: string;
  technicianId?: string;
  equipmentId?: string;
  branchId?: string;

  title: string;
  description: string;
  serviceType: ServiceType;
  priority: Priority;
  status: JobStatus;
  bookingWindow?: BookingWindow;
  routeStatus?: RouteStatus;

  scheduledStart: string;
  durationMinutes: number;

  customerAddress?: string;
  customerPhone?: string;

  checklist: JobChecklistItem[];
  preJobChecklist?: JobChecklistItem[];
  safetyChecklist?: JobChecklistItem[];
  postJobChecklist?: JobChecklistItem[];
  diagnostics?: JobDiagnostics;
  partsUsed: JobPartUsed[];

  createdAt: string;
  updatedAt: string;
  completionCertificateIssuedAt?: string;
  customerSignatureName?: string;
  completionNotes?: string;
  etaMinutes?: number;
  travelMinutesEstimate?: number;
  arrivalDetectedAt?: string;
  autoStartedAt?: string;
  issueSummary?: string;
  requestedQuote?: boolean;
  emergencyMode?: boolean;
}

export interface JobNote {
  id: string;
  jobId: string;
  authorId: string;
  createdAt: string;
  text: string;
  visibility: "internal" | "shared";
}

export interface Attachment {
  id: string;
  jobId: string;
  uploaderId: string;
  createdAt: string;
  filename: string;
  mime: string;
  kind: "photo" | "voice" | "document";
  blob: Blob;
  equipmentId?: string;
  photoStage?: "before" | "after" | "general";
  annotation?: string;
  compressed?: boolean;
}

export interface Promotion {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  validFrom: string;
  validTo: string;
  active: boolean;
  maxUses?: number;
  uses: number;
  serviceTypes: ServiceType[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  jobId: string;
  customerId: string;
  status: InvoiceStatus;
  createdAt: string;
  dueDate: string;
  promoCode?: string;
  discountAmount: number;
  taxRate: number;
  autoSentAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  createdAt: string;
  method: PaymentMethod;
  amount: number;
  status: "completed" | "failed";
  reference: string;
  paymentType?: "payment" | "deposit" | "tip" | "refund";
  note?: string;
  tipAmount?: number;
  refundedPaymentId?: string;
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  unitCost: number;
  unitPrice: number;
  stockQty: number;
  reorderLevel: number;
  supplier: string;
  barcode?: string;
  warehouseQty?: number;
  reservedQty?: number;
  manufacturer?: string;
}

export interface TruckInventory {
  id: string;
  technicianId: string;
  partId: string;
  qty: number;
}

export interface QuoteOption {
  id: string;
  quoteId: string;
  tier: "good" | "better" | "best";
  title: string;
  description: string;
  price: number;
  equipmentSpecs: string;
  energySavingsAnnual?: number;
  rebateAmount?: number;
  financingMonthly?: number;
  brochureUrl?: string;
}

export interface Quote {
  id: string;
  customerId: string;
  title: string;
  status: "draft" | "sent" | "approved" | "rejected";
  createdAt: string;
  options: QuoteOption[];
  signatureName?: string;
  signatureAt?: string;
}

export interface Message {
  id: string;
  threadType: "job";
  threadId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  createdAt: string;
  title: string;
  body: string;
  type: "job" | "invoice" | "reminder" | "system";
  read: boolean;
}

export interface SmsLog {
  id: string;
  createdAt: string;
  toPhone: string;
  body: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  actorRole: Role;
  entityType: "job" | "invoice" | "customer" | "system";
  entityId: string;
  jobId?: string;
  action: string;
  title: string;
  details?: string;
}

export interface TechnicianLocation {
  id: string;
  technicianId: string;
  at: string;
  lat: number;
  lng: number;
  status: "idle" | "driving" | "on_site";
  routeJobId?: string;
  speedKph?: number;
  mileageKm?: number;
  etaMinutes?: number;
  proofPhotoNote?: string;
}

export interface CustomerReview {
  id: string;
  jobId: string;
  customerId: string;
  technicianId?: string;
  rating: number;
  comment: string;
  createdAt: string;
  public: boolean;
}

export interface LoyaltyEvent {
  id: string;
  customerId: string;
  createdAt: string;
  points: number;
  reason: string;
  referralCode?: string;
}

export interface TrainingResource {
  id: string;
  title: string;
  category: string;
  kind: "manual" | "video" | "guide";
  description: string;
  durationMinutes?: number;
  url?: string;
}

export interface MarketingCampaign {
  id: string;
  title: string;
  segment: string;
  channel: "email" | "sms" | "in_app";
  status: "draft" | "scheduled" | "sent";
  message: string;
  createdAt: string;
  scheduledFor?: string;
}

export interface IntegrationSetting {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  notes?: string;
  lastSyncAt?: string;
}
