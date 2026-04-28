import React, { useEffect, useState } from "react";
import type { User } from "../types";
import { db } from "../db";
import { Badge } from "../components/ui/Badge";
import { computeInvoiceTotals, round2 } from "../lib/domain";
import { listCustomers, listTechnicians } from "../lib/data";
import { equipmentAgeYears } from "../lib/hvac";

function Card(props: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">{props.title}</div>
      <div className="mt-2 text-3xl font-extrabold text-gray-900">{props.value}</div>
      {props.hint ? <div className="mt-1 text-xs font-semibold text-gray-500">{props.hint}</div> : null}
    </div>
  );
}

export function AnalyticsPage(_props: { user: User }) {
  const [summary, setSummary] = useState<any>(null);
  const [techStats, setTechStats] = useState<any[]>([]);
  const [customerStats, setCustomerStats] = useState<any[]>([]);
  const [serviceMix, setServiceMix] = useState<Array<{ name: string; revenue: number; jobs: number }>>([]);
  const [equipmentStats, setEquipmentStats] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [payments, invoices, jobs, customers, equipment, techs] = await Promise.all([
        db.payments.toArray(),
        db.invoices.toArray(),
        db.jobs.toArray(),
        listCustomers(),
        db.equipment.toArray(),
        listTechnicians(),
      ]);

      const revenue = round2(payments.reduce((s, p) => s + ((p.paymentType ?? "payment") === "refund" ? -p.amount : p.amount), 0));
      const outstanding = invoices.filter((i) => i.status !== "paid").length;
      const paidCount = invoices.filter((i) => i.status === "paid").length || 1;
      const avgTicket = round2(revenue / paidCount);
      const completedJobs = jobs.filter((j) => j.status === "completed");
      const completionRate = jobs.length ? round2((completedJobs.length * 100) / jobs.length) : 0;
      const avgResponseHours = jobs.length
        ? round2(jobs.reduce((sum, job) => sum + (new Date(job.scheduledStart).getTime() - new Date(job.createdAt).getTime()) / 36e5, 0) / jobs.length)
        : 0;
      const repeatCustomers = customers.filter((c) => jobs.filter((j) => j.customerId === c.id).length > 1).length;
      const retentionRate = customers.length ? round2((repeatCustomers * 100) / customers.length) : 0;

      const byService = new Map<string, { name: string; revenue: number; jobs: number }>();
      for (const job of jobs) {
        const inv = invoices.find((x) => x.jobId === job.id);
        const totals = inv ? await computeInvoiceTotals(inv.id) : { total: 0 };
        const entry = byService.get(job.serviceType) ?? { name: job.serviceType, revenue: 0, jobs: 0 };
        entry.revenue += totals.total;
        entry.jobs += 1;
        byService.set(job.serviceType, entry);
      }

      const callbackCount = completedJobs.filter((job) => jobs.some((other) => other.customerId === job.customerId && other.id !== job.id && new Date(other.createdAt).getTime() - new Date(job.createdAt).getTime() < 14 * 24 * 3600 * 1000 && new Date(other.createdAt) > new Date(job.createdAt))).length;

      const techPerf = await Promise.all(techs.map(async (t) => {
        const myJobs = jobs.filter((j) => j.technicianId === t.user.id);
        const done = myJobs.filter((j) => j.status === "completed").length;
        const dailyMap = new Map<string, number>();
        myJobs.forEach((j) => dailyMap.set(j.scheduledStart.slice(0, 10), (dailyMap.get(j.scheduledStart.slice(0, 10)) ?? 0) + 1));
        const revenueGenerated = await Promise.all(
          myJobs.map(async (job) => {
            const inv = invoices.find((x) => x.jobId === job.id);
            if (!inv) return 0;
            const totals = await computeInvoiceTotals(inv.id);
            return totals.total;
          })
        );
        const partsCost = myJobs.reduce((sum, j) => sum + j.partsUsed.reduce((s, p) => s + p.qty * p.unitCost, 0), 0);
        const durationAvg = myJobs.length ? round2(myJobs.reduce((s, j) => s + j.durationMinutes, 0) / myJobs.length) : 0;
        return {
          name: t.user.name,
          assigned: myJobs.length,
          completed: done,
          availability: t.profile.isAvailable,
          revenue: round2(revenueGenerated.reduce((s, n) => s + n, 0)),
          jobsPerDay: dailyMap.size ? round2(myJobs.length / dailyMap.size) : 0,
          callbacks: myJobs.filter((j) => j.serviceType === "repair" && j.priority === "high").length,
          avgDuration: durationAvg,
          partsCost: round2(partsCost),
        };
      }));

      const customerPerf = await Promise.all(customers.map(async (c) => {
        const myJobs = jobs.filter((j) => j.customerId === c.id);
        const myEquipment = equipment.filter((e) => e.customerId === c.id);
        const ltv = round2(payments.filter((p) => p.customerId === c.id).reduce((s, p) => s + ((p.paymentType ?? "payment") === "refund" ? -p.amount : p.amount), 0));
        return {
          name: c.name,
          membershipPlan: c.membershipPlan ?? "none",
          jobs: myJobs.length,
          repeatRate: myJobs.length > 1 ? "repeat" : "new",
          ltv,
          avgEquipmentAge: myEquipment.length ? round2(myEquipment.reduce((sum, e) => sum + equipmentAgeYears(e), 0) / myEquipment.length) : 0,
        };
      }));

      const failureCounts = new Map<string, number>();
      for (const eq of equipment) {
        failureCounts.set(eq.type, jobs.filter((j) => j.equipmentId === eq.id && (j.serviceType === "repair" || j.serviceType === "emergency")).length + (failureCounts.get(eq.type) ?? 0));
      }
      const equipmentAgeAvg = equipment.length ? round2(equipment.reduce((sum, e) => sum + equipmentAgeYears(e), 0) / equipment.length) : 0;

      if (!alive) return;
      setSummary({
        revenue,
        outstanding,
        avgTicket,
        completionRate,
        avgResponseHours,
        retentionRate,
        callbackCount,
      });
      setTechStats(techPerf.sort((a, b) => b.revenue - a.revenue));
      setCustomerStats(customerPerf.sort((a, b) => b.ltv - a.ltv));
      setServiceMix(Array.from(byService.values()).sort((a, b) => b.revenue - a.revenue));
      setEquipmentStats([
        { label: "Average equipment age", value: `${equipmentAgeAvg.toFixed(1)} years` },
        { label: "Failure frequency", value: Array.from(failureCounts.entries()).map(([k, v]) => `${k}: ${v}`).join(" • ") || "No failures yet" },
      ]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!summary) {
    return <div className="mx-auto max-w-7xl px-4 py-6 text-sm font-semibold text-gray-600">Loading analytics…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <div className="text-2xl font-extrabold text-gray-900">Business Analytics</div>
        <div className="text-sm font-semibold text-gray-500">Revenue by service type and technician, response time, retention, profit signals, and lifecycle metrics.</div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card title="Revenue" value={`$${summary.revenue.toFixed(2)}`} />
        <Card title="Average ticket" value={`$${summary.avgTicket.toFixed(2)}`} />
        <Card title="Completion rate" value={`${summary.completionRate.toFixed(1)}%`} />
        <Card title="Avg response time" value={`${summary.avgResponseHours.toFixed(1)} h`} />
        <Card title="Retention rate" value={`${summary.retentionRate.toFixed(1)}%`} />
        <Card title="Callbacks" value={String(summary.callbackCount)} hint={`${summary.outstanding} open / overdue invoices`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-gray-900">Revenue by service type</div>
          <div className="mt-3 space-y-2">
            {serviceMix.map((row) => (
              <div key={row.name} className="rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-gray-900 capitalize">{row.name}</div>
                  <div className="text-sm font-extrabold text-gray-900">${row.revenue.toFixed(2)}</div>
                </div>
                <div className="mt-1 text-xs font-semibold text-gray-600">{row.jobs} jobs</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-gray-900">Equipment intelligence</div>
          <div className="mt-3 space-y-2">
            {equipmentStats.map((row) => (
              <div key={row.label} className="rounded-2xl border border-gray-100 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-500">{row.label}</div>
                <div className="mt-1 text-sm font-semibold text-gray-700">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-gray-900">Technician analytics</div>
          <div className="mt-3 space-y-2">
            {techStats.map((t) => (
              <div key={t.name} className="rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-gray-900">{t.name}</div>
                    <div className="text-xs font-semibold text-gray-600">
                      Revenue ${t.revenue.toFixed(2)} • {t.jobsPerDay.toFixed(1)} jobs/day • avg {t.avgDuration.toFixed(0)} min
                    </div>
                  </div>
                  <Badge tone={t.availability ? "green" : "red"}>{t.availability ? "available" : "unavailable"}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-gray-600">
                  <span className="rounded-xl bg-gray-50 px-2 py-1">{t.assigned} assigned</span>
                  <span className="rounded-xl bg-gray-50 px-2 py-1">{t.completed} completed</span>
                  <span className="rounded-xl bg-gray-50 px-2 py-1">{t.callbacks} callbacks</span>
                  <span className="rounded-xl bg-gray-50 px-2 py-1">parts cost ${t.partsCost.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-gray-900">Customer analytics</div>
          <div className="mt-3 space-y-2">
            {customerStats.map((c) => (
              <div key={c.name} className="rounded-2xl border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-gray-900">{c.name}</div>
                    <div className="text-xs font-semibold text-gray-600">
                      LTV ${c.ltv.toFixed(2)} • {c.jobs} jobs • avg equipment age {c.avgEquipmentAge.toFixed(1)} years
                    </div>
                  </div>
                  <Badge tone={c.membershipPlan === "platinum" ? "purple" : c.membershipPlan === "gold" ? "yellow" : "gray"}>{c.membershipPlan}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
