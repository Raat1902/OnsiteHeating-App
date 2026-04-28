import type { Attachment, Equipment, Job, JobNote, User } from "../types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function yearsBetween(iso: string, atIso = new Date().toISOString()): number {
  return Math.max(0, (new Date(atIso).getTime() - new Date(iso).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function equipmentAgeYears(eq: Equipment): number {
  return Number(yearsBetween(eq.installDate).toFixed(1));
}

export function equipmentExpectedLife(eq: Equipment): number {
  if (eq.expectedLifespanYears) return eq.expectedLifespanYears;
  if (eq.type === "furnace") return 18;
  if (eq.type === "boiler") return 22;
  if (eq.type === "heat_pump") return 15;
  if (eq.type === "ac_unit") return 15;
  if (eq.type === "water_heater") return 12;
  if (eq.type === "thermostat") return 10;
  return 20;
}

export function equipmentLifecycleScore(eq: Equipment): number {
  const ageRatio = equipmentAgeYears(eq) / Math.max(1, equipmentExpectedLife(eq));
  const warrantyExpired = new Date(eq.warrantyExpiry) < new Date() ? 15 : 0;
  const serviceLag = eq.lastServiceDate ? Math.max(0, yearsBetween(eq.lastServiceDate) - 1) * 18 : 15;
  const statusPenalty = eq.status === "needs_service" ? 20 : eq.status === "replaced" ? 80 : 0;
  return clamp(Math.round(ageRatio * 55 + warrantyExpired + serviceLag + statusPenalty), 5, 99);
}

export function lifecycleBadge(eq: Equipment): { label: string; tone: "green" | "yellow" | "red" } {
  const score = equipmentLifecycleScore(eq);
  if (score >= 75) return { label: "Replacement watch", tone: "red" };
  if (score >= 45) return { label: "Mid-life attention", tone: "yellow" };
  return { label: "Healthy lifecycle", tone: "green" };
}

export function replacementRecommendation(eq: Equipment): string {
  const age = equipmentAgeYears(eq);
  const life = equipmentExpectedLife(eq);
  const score = equipmentLifecycleScore(eq);
  if (score >= 80 || age >= life) return "Recommend replacement planning within 3-6 months.";
  if (score >= 65) return "Start replacement budgeting and offer high-efficiency upgrade options.";
  if (eq.status === "needs_service") return "Repair is still viable, but monitor closely after this visit.";
  return "Continue maintenance plan and re-evaluate during the next service.";
}

export function energyEfficiencySuggestion(eq: Equipment): string {
  if (eq.type === "ac_unit" || eq.type === "heat_pump") {
    if ((eq.seerRating ?? 0) > 0 && (eq.seerRating ?? 0) < 14) return "Older SEER rating. High-efficiency replacement could reduce seasonal energy cost.";
    return "Keep coils clean, verify airflow, and review thermostat scheduling for best efficiency.";
  }
  if (eq.type === "furnace" || eq.type === "boiler") {
    return "Annual combustion/safety checks and clean filters improve efficiency and reduce callbacks.";
  }
  return "Review control settings and keep records current to support long-term efficiency.";
}

export function manufacturerLookupHint(eq: Equipment): string {
  const brand = eq.brand.trim();
  const model = eq.model.trim();
  return `${brand} ${model} appears in the local equipment register. Verify serial and warranty during the next visit.`;
}

export async function compressImageFile(file: File, maxWidth = 1600, quality = 0.78): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Unable to read image"));
      el.src = imgUrl;
    });
    const ratio = Math.min(1, maxWidth / Math.max(1, img.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return out ?? file;
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

export function buildSmartJobSummary(input: {
  job: Job;
  notes: JobNote[];
  attachments: Attachment[];
  customer?: User | null;
  technician?: User | null;
}): string {
  const { job, notes, attachments, customer, technician } = input;
  const checklistDone = (job.checklist ?? []).filter((x) => x.done).length;
  const preDone = (job.preJobChecklist ?? []).filter((x) => x.done).length;
  const postDone = (job.postJobChecklist ?? []).filter((x) => x.done).length;
  const diag = job.diagnostics ?? {};
  const delta = diag.deltaTF ?? ((diag.supplyTempF ?? 0) - (diag.returnTempF ?? 0));
  const photoCount = attachments.filter((x) => x.kind === "photo").length;
  const lastSharedNote = [...notes].reverse().find((x) => x.visibility === "shared");
  const pieces = [
    `Customer: ${customer?.name ?? "Customer"}`,
    `Service: ${job.serviceType} / ${job.title}`,
    `Status: ${job.status.replaceAll("_", " ")}`,
    `Technician: ${technician?.name ?? "Unassigned"}`,
    `Window: ${job.bookingWindow ?? "flex"}`,
    `Checklist: ${checklistDone}/${job.checklist.length} main, ${preDone}/${job.preJobChecklist?.length ?? 0} pre-job, ${postDone}/${job.postJobChecklist?.length ?? 0} post-job.`,
    delta ? `Measured delta-T: ${Number(delta).toFixed(1)}°F.` : "",
    diag.superheatF != null ? `Superheat ${diag.superheatF}°F.` : "",
    diag.subcoolF != null ? `Subcool ${diag.subcoolF}°F.` : "",
    diag.staticPressureInWc != null ? `Static pressure ${diag.staticPressureInWc} in. w.c.` : "",
    diag.refrigerantType ? `Refrigerant ${diag.refrigerantType}, added ${diag.refrigerantAddedOz ?? 0} oz, recovered ${diag.refrigerantRecoveredOz ?? 0} oz.` : "",
    job.partsUsed.length ? `Parts used: ${job.partsUsed.map((p) => `${p.name} x${p.qty}`).join(", ")}.` : "No parts used.",
    photoCount ? `${photoCount} photos attached.` : "",
    lastSharedNote ? `Customer-facing note: ${lastSharedNote.text}` : "",
    job.completionNotes ? `Completion notes: ${job.completionNotes}` : "",
  ].filter(Boolean);
  return pieces.join("\n");
}

export function buildMailtoReport(job: Job, customer: User | null, summary: string): string {
  const subject = encodeURIComponent(`Service report for ${job.title}`);
  const body = encodeURIComponent(
    `Hello ${customer?.name ?? "customer"},\n\nHere is your service report for job ${job.id}.\n\n${summary}\n\nThank you,\nOnsite Heating Pro`
  );
  return `mailto:${encodeURIComponent(customer?.email ?? "")}?subject=${subject}&body=${body}`;
}
