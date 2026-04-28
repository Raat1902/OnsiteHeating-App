import type { Attachment, Equipment, Job, QuoteOption, User } from "../types";
import { equipmentAgeYears, equipmentLifecycleScore, replacementRecommendation } from "./hvac";

export type DiagnosticInsight = {
  title: string;
  confidence: number;
  details: string;
};

export function aiDiagnosticInsights(job: Job): DiagnosticInsight[] {
  const diag = job.diagnostics ?? {};
  const insights: DiagnosticInsight[] = [];

  if ((diag.suctionPsi ?? 999) < 105 && (diag.superheatF ?? 0) > 18) {
    insights.push({
      title: "Possible refrigerant leak or undercharge",
      confidence: 0.84,
      details: "Low suction pressure combined with elevated superheat points toward low charge, restriction, or evaporator starvation.",
    });
  }

  if ((diag.subcoolF ?? 0) < 5 && (diag.dischargePsi ?? 0) > 260) {
    insights.push({
      title: "Potential TXV or liquid-line restriction",
      confidence: 0.72,
      details: "Low subcooling under load with elevated head pressure suggests metering or airflow issues.",
    });
  }

  if ((diag.staticPressureInWc ?? 0) > 0.8) {
    insights.push({
      title: "Airflow restriction likely",
      confidence: 0.76,
      details: "Static pressure is elevated. Check filter condition, blower speed, return sizing, and coil loading.",
    });
  }

  if ((diag.coReadingPpm ?? 0) > 9) {
    insights.push({
      title: "Gas safety escalation required",
      confidence: 0.97,
      details: "CO exceeds normal service threshold. Complete combustion analysis and do not leave unsafe operation unresolved.",
    });
  }

  if (diag.errorCode?.trim()) {
    insights.push({
      title: `Use error code ${diag.errorCode} as primary branch`,
      confidence: 0.63,
      details: "Cross-reference manufacturer troubleshooting tree and recent service history to narrow likely causes.",
    });
  }

  if (!insights.length) {
    insights.push({
      title: "No major anomaly detected from current readings",
      confidence: 0.58,
      details: "Capture full pressure/temperature data and compare against manufacturer targets for higher confidence.",
    });
  }

  return insights;
}

export function predictiveFailure(eq: Equipment, serviceVisits: number) {
  const age = equipmentAgeYears(eq);
  const lifecycle = equipmentLifecycleScore(eq);
  const reliabilityPenalty = 100 - (eq.manufacturerReliability ?? 78);
  const visitPenalty = Math.min(20, serviceVisits * 4);
  const risk = Math.max(5, Math.min(99, Math.round(lifecycle * 0.65 + reliabilityPenalty * 0.25 + visitPenalty)));
  const level = risk >= 75 ? "high" : risk >= 45 ? "medium" : "low";
  return {
    risk,
    level,
    reasons: [
      `${age.toFixed(1)} years in service`,
      `Lifecycle score ${lifecycle}/99`,
      `${serviceVisits} historical service visit(s)`,
      eq.rebateProgramHint ? "rebate opportunity available" : "standard replacement economics",
    ],
    recommendation: replacementRecommendation(eq),
  };
}

export function replacementPackages(eq: Equipment): QuoteOption[] {
  const basePrice = eq.type === "boiler" ? 7900 : eq.type === "heat_pump" ? 11800 : 6400;
  const annualCost = eq.annualEnergyCostEstimate ?? 950;
  return [
    {
      id: `virtual-good-${eq.id}`,
      quoteId: "virtual",
      tier: "good",
      title: `Good ${eq.type.replace("_", " ")} replacement`,
      description: "Reliable base upgrade with standard warranty.",
      price: basePrice,
      equipmentSpecs: "Single-stage, standard controls",
      energySavingsAnnual: Math.round(annualCost * 0.08),
      rebateAmount: 0,
      financingMonthly: Math.round(basePrice / 48),
      brochureUrl: "Ask office for brochure PDF",
    },
    {
      id: `virtual-better-${eq.id}`,
      quoteId: "virtual",
      tier: "better",
      title: `Better high-efficiency ${eq.type.replace("_", " ")}`,
      description: "Efficiency-focused upgrade with comfort improvements.",
      price: Math.round(basePrice * 1.22),
      equipmentSpecs: "Two-stage / variable-speed bundle",
      energySavingsAnnual: Math.round(annualCost * 0.18),
      rebateAmount: 350,
      financingMonthly: Math.round((basePrice * 1.22) / 60),
      brochureUrl: "Ask office for brochure PDF",
    },
    {
      id: `virtual-best-${eq.id}`,
      quoteId: "virtual",
      tier: "best",
      title: `Best premium communicating ${eq.type.replace("_", " ")}`,
      description: "Premium comfort, diagnostics, and long-term efficiency.",
      price: Math.round(basePrice * 1.45),
      equipmentSpecs: "Communicating controls, IAQ-ready",
      energySavingsAnnual: Math.round(annualCost * 0.28),
      rebateAmount: 700,
      financingMonthly: Math.round((basePrice * 1.45) / 72),
      brochureUrl: "Ask office for brochure PDF",
    },
  ];
}

export function buildAiServiceReport(job: Job, customer?: User | null, technician?: User | null, attachments: Attachment[] = []) {
  const causes = aiDiagnosticInsights(job);
  const diag = job.diagnostics ?? {};
  return [
    `Service Report: ${job.title}`,
    customer ? `Customer: ${customer.name}` : "",
    technician ? `Technician: ${technician.name}` : "",
    `Service type: ${job.serviceType}`,
    `Status: ${job.status}`,
    `Summary: ${causes[0]?.title ?? "No strong diagnostic signal yet."}`,
    diag.notes ? `Field notes: ${diag.notes}` : "",
    diag.postJobNotes ? `Completion notes: ${diag.postJobNotes}` : "",
    `Attachments captured: ${attachments.length}`,
    `Recommended next step: ${causes[0]?.details ?? "Finalize readings and review with customer."}`,
  ].filter(Boolean).join("\n");
}
