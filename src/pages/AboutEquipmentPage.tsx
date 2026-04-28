import React, { useEffect, useMemo, useState } from "react";
import type { MaintenanceReminder, User } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { db } from "../db";
import { listEquipment, listEquipmentAttachments } from "../lib/data";
import { energyEfficiencySuggestion, lifecycleBadge, manufacturerLookupHint, replacementRecommendation, equipmentAgeYears } from "../lib/hvac";

function warrantyTone(expiry: string) {
  const exp = new Date(expiry);
  const now = new Date();
  if (exp < now) return { tone: "red" as const, label: "Warranty expired" };
  const days = Math.round((exp.getTime() - now.getTime()) / (24 * 3600 * 1000));
  if (days < 90) return { tone: "yellow" as const, label: `Warranty expiring (${days}d)` };
  return { tone: "green" as const, label: "Warranty active" };
}

const planBenefits: Record<string, string[]> = {
  none: ["On-demand service only"],
  silver: ["1 tune-up / year", "Member reminders"],
  gold: ["2 tune-ups / year", "Priority scheduling", "Member discounts"],
  platinum: ["2 tune-ups", "Emergency priority", "Best discount eligibility"],
};

export function AboutEquipmentPage(props: { user: User }) {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const eq = await listEquipment(props.user.id);
      const rs = await db.reminders.where("customerId").equals(props.user.id).toArray();
      const counts: Record<string, number> = {};
      for (const item of eq) counts[item.id] = (await listEquipmentAttachments(item.id)).length;
      if (!alive) return;
      setEquipment(eq);
      setReminders(rs);
      setAttachmentCounts(counts);
    })();
    return () => { alive = false; };
  }, [props.user.id]);

  const serviceTimeline = useMemo(() => reminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [reminders]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-gray-900">About my home & equipment</div>
          <div className="text-sm font-semibold text-gray-500">Lifecycle overview, maintenance plan details, warranty, and equipment media.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="rounded-xl bg-red-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-700" href="tel:+15550000000">
            Emergency hotline
          </a>
          <Button onClick={() => window.location.assign("/app/jobs")}>Request service</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Equipment lifecycle dashboard</div>
            <div className="mt-3 space-y-3">
              {equipment.length === 0 ? <div className="text-sm font-semibold text-gray-500">No equipment on file yet.</div> : null}
              {equipment.map((e) => {
                const warranty = warrantyTone(e.warrantyExpiry);
                const lifecycle = lifecycleBadge(e);
                return (
                  <div key={e.id} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-gray-900">{e.brand} {e.model}</div>
                        <div className="text-sm font-semibold text-gray-600 capitalize">{e.type} • age {equipmentAgeYears(e).toFixed(1)} years</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={warranty.tone}>{warranty.label}</Badge>
                        <Badge tone={lifecycle.tone}>{lifecycle.label}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl bg-gray-50 p-3 text-xs font-semibold text-gray-700">
                        Install: {new Date(e.installDate).toLocaleDateString()}<br />
                        Last service: {e.lastServiceDate ? new Date(e.lastServiceDate).toLocaleDateString() : "—"}
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3 text-xs font-semibold text-gray-700">
                        Lifespan target: {e.expectedLifespanYears ?? "—"} years<br />
                        SEER: {e.seerRating ?? "—"}
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3 text-xs font-semibold text-gray-700">
                        Replacement estimate: ${Number(e.replacementEstimate ?? 0).toFixed(0)}<br />
                        Attached docs/media: {attachmentCounts[e.id] ?? 0}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-gray-100 p-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Replacement recommendation</div>
                        <div className="mt-1 text-sm font-semibold text-gray-700">{replacementRecommendation(e)}</div>
                      </div>
                      <div className="rounded-2xl border border-gray-100 p-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Efficiency suggestion</div>
                        <div className="mt-1 text-sm font-semibold text-gray-700">{energyEfficiencySuggestion(e)}</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-xs font-semibold text-gray-600">
                      {manufacturerLookupHint(e)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Service history timeline</div>
            <div className="mt-3 space-y-2">
              {serviceTimeline.length === 0 ? <div className="text-sm font-semibold text-gray-500">No reminders yet.</div> : serviceTimeline.map((r) => (
                <div key={r.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-gray-900">{r.title}</div>
                    <Badge tone={r.status === "done" ? "green" : "yellow"}>{r.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-600">Due: {new Date(r.dueDate).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Maintenance membership</div>
            <div className="mt-2 text-sm font-semibold text-gray-700 capitalize">{props.user.membershipPlan ?? "none"} plan</div>
            <div className="mt-3 space-y-2">
              {(planBenefits[props.user.membershipPlan ?? "none"] ?? []).map((item) => (
                <div key={item} className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">{item}</div>
              ))}
            </div>
            {props.user.membershipStartedAt ? (
              <div className="mt-3 text-xs font-semibold text-gray-500">Started {new Date(props.user.membershipStartedAt).toLocaleDateString()} • auto-renew {props.user.membershipAutoRenew ? "on" : "off"}</div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Customer portal shortcuts</div>
            <div className="mt-3 grid gap-2">
              <Button variant="secondary" onClick={() => window.location.assign("/app/jobs")}>Book service</Button>
              <Button variant="secondary" onClick={() => window.location.assign("/app/invoices")}>Payment history</Button>
              <Button variant="secondary" onClick={() => window.location.assign("/app/quotes")}>Quotes & replacements</Button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Equipment documents storage</div>
            <div className="mt-3 space-y-2 text-sm font-semibold text-gray-700">
              {equipment.map((e) => (
                <div key={e.id} className="rounded-xl border border-gray-100 p-3">{e.brand} {e.model}: {attachmentCounts[e.id] ?? 0} stored files/photos</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
