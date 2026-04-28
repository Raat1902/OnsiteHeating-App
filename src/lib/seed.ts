import { db } from "../db";
import { newId } from "./id";
import { hashPassword } from "./crypto";
import type {
  Branch,
  CustomerReview,
  Equipment,
  IntegrationSetting,
  Invoice,
  InvoiceItem,
  Job,
  LoyaltyEvent,
  MarketingCampaign,
  Promotion,
  Quote,
  QuoteOption,
  TechnicianLocation,
  TrainingResource,
  User,
} from "../types";

function daysFromNow(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

export async function seedIfNeeded() {
  if ((await db.users.count()) > 0) return;

  const northBranchId = newId("branch");
  const eastBranchId = newId("branch");

  const branches: Branch[] = [
    {
      id: northBranchId,
      name: "North Vancouver Branch",
      address: "100 Main St, Vancouver, BC",
      region: "North Shore",
      phone: "(555) 000-1000",
      managerName: "Rania Atmani",
      emergencyPhone: "(555) 000-9111",
    },
    {
      id: eastBranchId,
      name: "Burnaby Service Hub",
      address: "780 Service Loop, Burnaby, BC",
      region: "Burnaby / East",
      phone: "(555) 000-2000",
      managerName: "Leah Service",
      emergencyPhone: "(555) 000-8111",
    },
  ];

  const adminHash = await hashPassword("admin123");
  const techHash = await hashPassword("tech123");
  const tech2Hash = await hashPassword("tech234");
  const custHash = await hashPassword("cust123");
  const cust2Hash = await hashPassword("cust234");

  const admin: User = {
    id: newId("user"),
    role: "admin",
    name: "Rania Atmani",
    email: "rania@onsiteheating.com",
    phone: "(555) 000-0000",
    address: "100 Main St, Vancouver, BC",
    tags: ["priority", "owner"],
    referralCode: "RANIA10",
    loyaltyTier: "vip",
    passwordHash: adminHash,
    createdAt: new Date().toISOString(),
  };

  const tech: User = {
    id: newId("user"),
    role: "technician",
    name: "Mike Technician",
    email: "tech@onsiteheating.com",
    phone: "(555) 222-3333",
    address: "200 Tech Rd, Vancouver, BC",
    tags: ["furnace", "boiler"],
    passwordHash: techHash,
    createdAt: new Date().toISOString(),
  };

  const tech2: User = {
    id: newId("user"),
    role: "technician",
    name: "Leah Service",
    email: "leah@onsiteheating.com",
    phone: "(555) 444-2323",
    address: "88 Fraser St, Vancouver, BC",
    tags: ["heat-pump", "installation"],
    passwordHash: tech2Hash,
    createdAt: new Date().toISOString(),
  };

  const customer: User = {
    id: newId("user"),
    role: "customer",
    name: "Sarah Customer",
    email: "customer@example.com",
    phone: "(555) 111-2222",
    address: "456 Oak Ave, Vancouver, BC",
    tags: ["residential"],
    membershipPlan: "gold",
    membershipStartedAt: daysFromNow(-280),
    membershipAutoRenew: true,
    referralCode: "SARAH25",
    loyaltyTier: "preferred",
    passwordHash: custHash,
    createdAt: new Date().toISOString(),
  };

  const customer2: User = {
    id: newId("user"),
    role: "customer",
    name: "David Homeowner",
    email: "david@example.com",
    phone: "(555) 888-1212",
    address: "980 Pine St, Burnaby, BC",
    tags: ["vip", "boiler"],
    membershipPlan: "silver",
    membershipStartedAt: daysFromNow(-160),
    membershipAutoRenew: true,
    referralCode: "DAVID15",
    loyaltyTier: "preferred",
    passwordHash: cust2Hash,
    createdAt: new Date().toISOString(),
  };

  await db.branches.bulkAdd(branches);
  await db.users.bulkAdd([admin, tech, tech2, customer, customer2]);

  await db.techProfiles.bulkAdd([
    {
      id: newId("tech"),
      userId: tech.id,
      isAvailable: true,
      specialties: ["furnace", "boiler", "maintenance", "repair"],
      homeBaseAddress: tech.address,
      maxDailyJobs: 5,
      workdayStartHour: 8,
      workdayEndHour: 17,
      branchId: northBranchId,
      vehicleInfo: "Van 12 • Ford Transit",
      vehicleColor: "White/Orange",
      rating: 4.8,
      certifications: ["Gas A", "CO Safety", "Boiler Specialist"],
      warrantyExperience: ["GoodHeat", "BoilMaster"],
      liveGpsEnabled: true,
    },
    {
      id: newId("tech"),
      userId: tech2.id,
      isAvailable: true,
      specialties: ["heat_pump", "ac_unit", "installation", "repair"],
      homeBaseAddress: tech2.address,
      maxDailyJobs: 4,
      workdayStartHour: 8,
      workdayEndHour: 17,
      branchId: eastBranchId,
      vehicleInfo: "Van 7 • Mercedes Sprinter",
      vehicleColor: "Blue/Orange",
      rating: 4.9,
      certifications: ["Heat Pump Pro", "VRF Service", "Electrical"],
      warrantyExperience: ["CoolFlow", "HeatSmart"],
      liveGpsEnabled: true,
    },
  ]);

  const eq1: Equipment = {
    id: newId("eq"),
    customerId: customer.id,
    type: "furnace",
    brand: "GoodHeat",
    model: "GH-92X",
    serialNumber: "GH92X-ABC-123",
    installDate: daysFromNow(-900),
    warrantyExpiry: daysFromNow(2000),
    status: "active",
    lastServiceDate: daysFromNow(-120),
    notes: "High-efficiency furnace. Replace filter every 3 months.",
    seerRating: 16,
    maintenanceIntervalMonths: 12,
    expectedLifespanYears: 18,
    replacementEstimate: 6200,
    annualEnergyCostEstimate: 820,
    manufacturerReliability: 82,
    rebateProgramHint: "BC Hydro comfort heat rebate",
  };

  const eq2: Equipment = {
    id: newId("eq"),
    customerId: customer.id,
    type: "boiler",
    brand: "BoilMaster",
    model: "BM-80",
    serialNumber: "BM80-XYZ-777",
    installDate: daysFromNow(-1500),
    warrantyExpiry: daysFromNow(500),
    status: "active",
    lastServiceDate: daysFromNow(-200),
    notes: "Annual combustion analysis recommended.",
    maintenanceIntervalMonths: 12,
    expectedLifespanYears: 22,
    replacementEstimate: 8900,
    annualEnergyCostEstimate: 1150,
    manufacturerReliability: 73,
    rebateProgramHint: "Municipal boiler efficiency rebate",
  };

  const eq3: Equipment = {
    id: newId("eq"),
    customerId: customer2.id,
    type: "heat_pump",
    brand: "CoolFlow",
    model: "CF-HP18",
    serialNumber: "CF18-HP-5522",
    installDate: daysFromNow(-620),
    warrantyExpiry: daysFromNow(1180),
    status: "needs_service",
    lastServiceDate: daysFromNow(-380),
    notes: "Outdoor coil had debris last visit.",
    seerRating: 19,
    maintenanceIntervalMonths: 6,
    expectedLifespanYears: 15,
    replacementEstimate: 10400,
    annualEnergyCostEstimate: 690,
    manufacturerReliability: 78,
    rebateProgramHint: "Cold-climate heat pump incentive",
  };

  await db.equipment.bulkAdd([eq1, eq2, eq3]);

  await db.reminders.bulkAdd([
    { id: newId("rem"), customerId: customer.id, equipmentId: eq1.id, dueDate: daysFromNow(12), title: "Furnace annual tune-up due", status: "due", createdAt: new Date().toISOString() },
    { id: newId("rem"), customerId: customer.id, equipmentId: eq2.id, dueDate: daysFromNow(30), title: "Boiler combustion inspection", status: "due", createdAt: new Date().toISOString() },
    { id: newId("rem"), customerId: customer2.id, equipmentId: eq3.id, dueDate: daysFromNow(8), title: "Heat pump cooling-season maintenance", status: "due", createdAt: new Date().toISOString() },
  ]);

  const promo: Promotion = {
    id: newId("promo"),
    code: "WINTER15",
    title: "Winter Tune-Up",
    description: "15% off maintenance jobs this month.",
    discountType: "percentage",
    discountValue: 15,
    validFrom: daysFromNow(-14),
    validTo: daysFromNow(21),
    active: true,
    maxUses: 100,
    uses: 2,
    serviceTypes: ["maintenance", "repair"],
  };

  const promo2: Promotion = {
    id: newId("promo"),
    code: "VIP99",
    title: "VIP Repair Credit",
    description: "$99 off approved repair visit for loyalty members.",
    discountType: "fixed",
    discountValue: 99,
    validFrom: daysFromNow(-3),
    validTo: daysFromNow(45),
    active: true,
    maxUses: 40,
    uses: 1,
    serviceTypes: ["repair", "emergency"],
  };

  await db.promotions.bulkAdd([promo, promo2]);

  const jobs: Job[] = [
    {
      id: newId("job"),
      customerId: customer.id,
      technicianId: tech.id,
      equipmentId: eq1.id,
      branchId: northBranchId,
      title: "Annual furnace maintenance",
      description: "Seasonal tune-up and airflow check.",
      serviceType: "maintenance",
      priority: "medium",
      status: "assigned",
      bookingWindow: "8-12",
      routeStatus: "en_route",
      scheduledStart: hoursFromNow(2),
      durationMinutes: 90,
      customerAddress: customer.address,
      customerPhone: customer.phone,
      checklist: [
        { id: newId("chk"), label: "Inspect filter", done: true },
        { id: newId("chk"), label: "Check gas pressure", done: false },
        { id: newId("chk"), label: "Verify thermostat cycle", done: false },
      ],
      preJobChecklist: [
        { id: newId("chk"), label: "Review last service notes", done: true },
        { id: newId("chk"), label: "Confirm truck stock", done: true },
      ],
      safetyChecklist: [
        { id: newId("chk"), label: "Check gas shut-off access", done: false },
        { id: newId("chk"), label: "CO monitor active", done: true },
      ],
      postJobChecklist: [
        { id: newId("chk"), label: "Review findings with customer", done: false },
      ],
      diagnostics: {
        thermostatReadingF: 69,
        supplyTempF: 123,
        returnTempF: 68,
        deltaTF: 55,
        staticPressureInWc: 0.78,
        refrigerantType: "N/A",
        errorCode: "",
        notes: "System operating normally. Slightly dirty filter.",
        preJobNotes: "Customer reports occasional short cycling.",
        coReadingPpm: 4,
        combustionEfficiencyPct: 91,
      },
      partsUsed: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      etaMinutes: 26,
      travelMinutesEstimate: 26,
      issueSummary: "Annual maintenance visit",
    },
    {
      id: newId("job"),
      customerId: customer2.id,
      technicianId: tech2.id,
      equipmentId: eq3.id,
      branchId: eastBranchId,
      title: "Heat pump low cooling investigation",
      description: "Investigate reduced cooling capacity and high humidity complaint.",
      serviceType: "repair",
      priority: "high",
      status: "in_progress",
      bookingWindow: "12-4",
      routeStatus: "arrived",
      scheduledStart: hoursFromNow(-1),
      durationMinutes: 120,
      customerAddress: customer2.address,
      customerPhone: customer2.phone,
      checklist: [
        { id: newId("chk"), label: "Interview customer", done: true },
        { id: newId("chk"), label: "Measure pressures", done: true },
        { id: newId("chk"), label: "Inspect indoor coil", done: false },
      ],
      preJobChecklist: [
        { id: newId("chk"), label: "Confirm warranty serial", done: true },
      ],
      safetyChecklist: [
        { id: newId("chk"), label: "Disconnect verified", done: true },
        { id: newId("chk"), label: "PPE checked", done: true },
      ],
      postJobChecklist: [
        { id: newId("chk"), label: "Capture final photos", done: false },
        { id: newId("chk"), label: "Collect customer signature", done: false },
      ],
      diagnostics: {
        suctionPsi: 98,
        dischargePsi: 295,
        superheatF: 23,
        subcoolF: 4,
        ambientTempF: 84,
        supplyTempF: 58,
        returnTempF: 75,
        deltaTF: 17,
        refrigerantType: "R410A",
        refrigerantAddedOz: 8,
        errorCode: "E23",
        notes: "Possible refrigerant restriction or small leak. Check TXV and braze joints.",
        postJobNotes: "Awaiting leak check and coil cleaning.",
        safetyRisks: "Wet deck outside condenser.",
        coReadingPpm: 0,
        combustionEfficiencyPct: 0,
      },
      partsUsed: [],
      createdAt: daysFromNow(-1),
      updatedAt: new Date().toISOString(),
      etaMinutes: 0,
      travelMinutesEstimate: 31,
      arrivalDetectedAt: hoursFromNow(-1),
      autoStartedAt: hoursFromNow(-1),
      issueSummary: "Warm supply air and humidity complaint",
    },
    {
      id: newId("job"),
      customerId: customer.id,
      technicianId: undefined,
      equipmentId: eq2.id,
      branchId: northBranchId,
      title: "Emergency boiler no-heat call",
      description: "No heat. Customer has infants in home. Needs nearest available technician.",
      serviceType: "emergency",
      priority: "emergency",
      status: "scheduled",
      bookingWindow: "flex",
      routeStatus: "scheduled",
      scheduledStart: hoursFromNow(1),
      durationMinutes: 120,
      customerAddress: customer.address,
      customerPhone: customer.phone,
      checklist: [
        { id: newId("chk"), label: "Confirm safety / gas status", done: false },
        { id: newId("chk"), label: "Stabilize heating", done: false },
        { id: newId("chk"), label: "Document emergency repair", done: false },
      ],
      preJobChecklist: [
        { id: newId("chk"), label: "Check emergency parts kit", done: false },
      ],
      safetyChecklist: [
        { id: newId("chk"), label: "Combustion/CO check", done: false },
      ],
      postJobChecklist: [
        { id: newId("chk"), label: "Customer informed of next steps", done: false },
      ],
      diagnostics: { notes: "Auto-priority sample job." },
      partsUsed: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emergencyMode: true,
      etaMinutes: 18,
      travelMinutesEstimate: 18,
      issueSummary: "No heat emergency",
      requestedQuote: false,
    },
    {
      id: newId("job"),
      customerId: customer2.id,
      technicianId: tech.id,
      equipmentId: eq3.id,
      branchId: eastBranchId,
      title: "Maintenance membership spring tune-up",
      description: "Gold-plan maintenance slot with photo documentation and filter check.",
      serviceType: "maintenance",
      priority: "medium",
      status: "scheduled",
      bookingWindow: "12-4",
      routeStatus: "scheduled",
      scheduledStart: daysFromNow(2).slice(0, 10) + "T13:00:00.000Z",
      durationMinutes: 90,
      customerAddress: customer2.address,
      customerPhone: customer2.phone,
      checklist: [
        { id: newId("chk"), label: "Outdoor unit coil rinse", done: false },
        { id: newId("chk"), label: "Check refrigerant approach", done: false },
      ],
      preJobChecklist: [
        { id: newId("chk"), label: "Load maintenance photo checklist", done: false },
      ],
      safetyChecklist: [
        { id: newId("chk"), label: "Electrical disconnect verified", done: false },
      ],
      postJobChecklist: [
        { id: newId("chk"), label: "Email service report", done: false },
      ],
      diagnostics: { notes: "Membership-generated maintenance visit." },
      partsUsed: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      etaMinutes: 35,
      travelMinutesEstimate: 35,
    },
  ];
  await db.jobs.bulkAdd(jobs);

  const inv: Invoice = {
    id: newId("inv"),
    jobId: jobs[0].id,
    customerId: customer.id,
    status: "sent",
    createdAt: new Date().toISOString(),
    dueDate: daysFromNow(14),
    promoCode: "WINTER15",
    discountAmount: 24,
    taxRate: 0.05,
  };

  const inv2: Invoice = {
    id: newId("inv"),
    jobId: jobs[1].id,
    customerId: customer2.id,
    status: "overdue",
    createdAt: daysFromNow(-20),
    dueDate: daysFromNow(-5),
    discountAmount: 0,
    taxRate: 0.05,
  };

  const items: InvoiceItem[] = [
    { id: newId("item"), invoiceId: inv.id, description: "Labor (maintenance visit)", qty: 1, unitPrice: 120 },
    { id: newId("item"), invoiceId: inv.id, description: "Materials (filter)", qty: 1, unitPrice: 40 },
    { id: newId("item"), invoiceId: inv2.id, description: "Repair labor", qty: 1, unitPrice: 210 },
    { id: newId("item"), invoiceId: inv2.id, description: "Diagnostic fee", qty: 1, unitPrice: 95 },
  ];

  await db.invoices.bulkAdd([inv, inv2]);
  await db.invoiceItems.bulkAdd(items);

  await db.payments.bulkAdd([
    {
      id: newId("pay"),
      invoiceId: inv2.id,
      customerId: customer2.id,
      createdAt: daysFromNow(-18),
      method: "card",
      amount: 100,
      status: "completed",
      reference: "RCPT-SEED01",
      paymentType: "deposit",
    },
    {
      id: newId("pay"),
      invoiceId: inv.id,
      customerId: customer.id,
      createdAt: daysFromNow(-1),
      method: "apple_pay",
      amount: 12,
      status: "completed",
      reference: "RCPT-TIP01",
      paymentType: "tip",
      note: "Tip left through customer portal",
    },
  ]);

  await db.parts.bulkAdd([
    { id: newId("part"), sku: "FLTR-16x25", name: "Air Filter 16x25", unitCost: 8, unitPrice: 20, stockQty: 12, warehouseQty: 40, reservedQty: 2, reorderLevel: 5, supplier: "HVAC Supply Co", barcode: "111222333", manufacturer: "FilterWorks" },
    { id: newId("part"), sku: "IGN-UNI", name: "Universal Igniter", unitCost: 25, unitPrice: 75, stockQty: 3, warehouseQty: 12, reservedQty: 1, reorderLevel: 3, supplier: "HVAC Supply Co", barcode: "222333444", manufacturer: "IgniPro" },
    { id: newId("part"), sku: "CAP-45", name: "Run Capacitor 45uF", unitCost: 12, unitPrice: 45, stockQty: 2, warehouseQty: 14, reservedQty: 0, reorderLevel: 4, supplier: "HVAC Supply Co", barcode: "333444555", manufacturer: "CapMaster" },
    { id: newId("part"), sku: "TXV-HP", name: "Heat pump TXV", unitCost: 74, unitPrice: 185, stockQty: 1, warehouseQty: 5, reservedQty: 1, reorderLevel: 2, supplier: "West Coast Refrigeration", barcode: "444555666", manufacturer: "CoolFlow" },
  ]);

  await db.truckInventory.bulkAdd([
    { id: newId("truck"), technicianId: tech.id, partId: (await db.parts.toArray())[0].id, qty: 4 },
    { id: newId("truck"), technicianId: tech.id, partId: (await db.parts.toArray())[1].id, qty: 2 },
    { id: newId("truck"), technicianId: tech2.id, partId: (await db.parts.toArray())[2].id, qty: 3 },
  ]);

  const quote: Quote = {
    id: newId("quote"),
    customerId: customer.id,
    title: "New Thermostat Upgrade Options",
    status: "sent",
    createdAt: new Date().toISOString(),
    options: [],
  };
  const qopts: QuoteOption[] = [
    {
      id: newId("qopt"),
      quoteId: quote.id,
      tier: "good",
      title: "Programmable Thermostat",
      description: "Basic programmable thermostat installation.",
      price: 199,
      equipmentSpecs: "Brand: HeatSmart Basic\nScheduling: 7-day\nNo Wi-Fi",
      energySavingsAnnual: 35,
      rebateAmount: 0,
      financingMonthly: 18,
      brochureUrl: "Brochure available in app",
    },
    {
      id: newId("qopt"),
      quoteId: quote.id,
      tier: "better",
      title: "Wi-Fi Smart Thermostat",
      description: "Smart thermostat with app control + learning schedule.",
      price: 349,
      equipmentSpecs: "Brand: HeatSmart Wi-Fi\nWi-Fi enabled\nEnergy reports",
      energySavingsAnnual: 85,
      rebateAmount: 40,
      financingMonthly: 29,
      brochureUrl: "Brochure available in app",
    },
    {
      id: newId("qopt"),
      quoteId: quote.id,
      tier: "best",
      title: "Premium Smart Thermostat + Sensor",
      description: "Premium thermostat + 1 remote sensor + advanced automation.",
      price: 499,
      equipmentSpecs: "Brand: HeatSmart Pro\nRemote sensor included\nAdvanced automation",
      energySavingsAnnual: 140,
      rebateAmount: 75,
      financingMonthly: 39,
      brochureUrl: "Brochure available in app",
    },
  ];
  await db.quotes.add(quote);
  await db.quoteOptions.bulkAdd(qopts);

  await db.messages.bulkAdd([
    { id: newId("msg"), threadType: "job", threadId: jobs[0].id, senderId: customer.id, text: "Please ring the side doorbell.", createdAt: daysFromNow(-1) },
    { id: newId("msg"), threadType: "job", threadId: jobs[1].id, senderId: tech2.id, text: "Running 10 minutes behind due to traffic.", createdAt: new Date().toISOString() },
  ]);

  const locations: TechnicianLocation[] = [
    { id: newId("loc"), technicianId: tech.id, at: new Date().toISOString(), lat: 49.31, lng: -123.09, status: "driving", routeJobId: jobs[0].id, speedKph: 34, mileageKm: 11.4, etaMinutes: 26 },
    { id: newId("loc"), technicianId: tech2.id, at: new Date().toISOString(), lat: 49.23, lng: -122.99, status: "on_site", routeJobId: jobs[1].id, speedKph: 0, mileageKm: 18.2, etaMinutes: 0, proofPhotoNote: "Condenser arrival photo captured" },
  ];
  await db.technicianLocations.bulkAdd(locations);

  const reviews: CustomerReview[] = [
    { id: newId("rev"), jobId: jobs[1].id, customerId: customer2.id, technicianId: tech2.id, rating: 5, comment: "Great communication and very thorough repair visit.", createdAt: daysFromNow(-2), public: true },
    { id: newId("rev"), jobId: jobs[0].id, customerId: customer.id, technicianId: tech.id, rating: 4, comment: "Arrived on time and explained the tune-up well.", createdAt: daysFromNow(-12), public: true },
  ];
  await db.customerReviews.bulkAdd(reviews);

  const loyalty: LoyaltyEvent[] = [
    { id: newId("loy"), customerId: customer.id, createdAt: daysFromNow(-20), points: 75, reason: "Gold plan renewal" },
    { id: newId("loy"), customerId: customer.id, createdAt: daysFromNow(-2), points: 15, reason: "Paid invoice online" },
    { id: newId("loy"), customerId: customer2.id, createdAt: daysFromNow(-5), points: 30, reason: "Referral bonus" },
  ];
  await db.loyaltyEvents.bulkAdd(loyalty);

  const training: TrainingResource[] = [
    { id: newId("train"), title: "Furnace No-Heat Playbook", category: "Troubleshooting", kind: "guide", description: "Step-by-step furnace no-heat triage for field technicians.", durationMinutes: 18 },
    { id: newId("train"), title: "Heat Pump Commissioning Basics", category: "Install", kind: "video", description: "Checklist-driven setup for inverter heat pumps.", durationMinutes: 22 },
    { id: newId("train"), title: "Combustion & CO Safety", category: "Safety", kind: "manual", description: "Gas appliance compliance reference and CO action thresholds.", durationMinutes: 12 },
  ];
  await db.trainingResources.bulkAdd(training);

  const campaigns: MarketingCampaign[] = [
    { id: newId("camp"), title: "Spring Tune-Up Push", segment: "members + aging equipment", channel: "email", status: "scheduled", message: "Book your spring tune-up and lock in priority scheduling.", createdAt: new Date().toISOString(), scheduledFor: daysFromNow(3) },
    { id: newId("camp"), title: "Replacement Upgrade Rebate", segment: "replacement watch", channel: "sms", status: "draft", message: "High-efficiency rebates are open this month. Ask us about replacement savings.", createdAt: new Date().toISOString() },
  ];
  await db.marketingCampaigns.bulkAdd(campaigns);

  const integrations: IntegrationSetting[] = [
    { id: newId("int"), key: "quickbooks", label: "QuickBooks export", enabled: true, lastSyncAt: daysFromNow(-1), notes: "CSV + invoice export ready" },
    { id: newId("int"), key: "stripe", label: "Stripe payments", enabled: false, notes: "UI is ready; awaiting API keys" },
    { id: newId("int"), key: "google_calendar", label: "Google Calendar sync", enabled: false, notes: "ICS/Calendar hooks prepared" },
    { id: newId("int"), key: "google_maps", label: "Google Maps routing", enabled: false, notes: "Local map fallback active" },
    { id: newId("int"), key: "twilio", label: "Twilio SMS", enabled: false, notes: "Using local SMS log simulation" },
    { id: newId("int"), key: "email", label: "Email delivery", enabled: false, notes: "mailto fallback active" },
  ];
  await db.integrationSettings.bulkAdd(integrations);
}
