import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Equipment, MaintenanceReminder, MembershipPlan, User } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { db } from "../db";
import { newId } from "../lib/id";
import { customerLifetimeValue } from "../lib/domain";
import { deleteEquipment, listEquipment, upsertCustomer, upsertEquipment } from "../lib/data";
import { energyEfficiencySuggestion, equipmentAgeYears, lifecycleBadge, replacementRecommendation } from "../lib/hvac";

function warrantyStatus(eq: Equipment): { label: string; tone: "green" | "yellow" | "red" } {
  const exp = new Date(eq.warrantyExpiry);
  const now = new Date();
  if (exp < now) return { label: "Expired", tone: "red" };
  const days = Math.round((exp.getTime() - now.getTime()) / (24 * 3600 * 1000));
  if (days < 90) return { label: `Expiring (${days}d)`, tone: "yellow" };
  return { label: "Active", tone: "green" };
}

export function CustomerDetailPage(_props: { user: User }) {
  const { customerId } = useParams();
  const [customer, setCustomer] = useState<User | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [ltv, setLtv] = useState<number>(0);

  const [tagText, setTagText] = useState("");

  const [eqOpen, setEqOpen] = useState(false);
  const [eqEditing, setEqEditing] = useState<Equipment | null>(null);
  const [eqForm, setEqForm] = useState({
    type: "furnace",
    brand: "",
    model: "",
    serialNumber: "",
    installDate: "",
    warrantyExpiry: "",
    status: "active",
    lastServiceDate: "",
    notes: "",
    seerRating: "",
    maintenanceIntervalMonths: "12",
    expectedLifespanYears: "",
    replacementEstimate: "",
  });

  async function refresh() {
    if (!customerId) return;
    const c = await db.users.get(customerId);
    setCustomer(c ?? null);
    if (!c) return;

    const js = (await db.jobs.where("customerId").equals(c.id).sortBy("scheduledStart")).reverse();
    setJobs(js);

    const eq = await listEquipment(c.id);
    setEquipment(eq);

    await autoReminders(c.id, eq);
    const rs = await db.reminders.where("customerId").equals(c.id).sortBy("dueDate");
    setReminders(rs);

    setLtv(await customerLifetimeValue(c.id));
  }

  useEffect(() => { refresh(); }, [customerId]);

  const tags = useMemo(() => customer?.tags ?? [], [customer]);
  const repeatServiceCount = useMemo(() => jobs.filter((j) => j.serviceType === "repair" || j.serviceType === "emergency").length, [jobs]);
  const highValue = ltv >= 500;

  async function addTag() {
    if (!customer) return;
    const t = tagText.trim().toLowerCase();
    if (!t) return;
    customer.tags = Array.from(new Set([...(customer.tags ?? []), t]));
    await upsertCustomer(customer);
    setTagText("");
    await refresh();
  }

  async function removeTag(t: string) {
    if (!customer) return;
    customer.tags = (customer.tags ?? []).filter((x) => x !== t);
    await upsertCustomer(customer);
    await refresh();
  }

  async function updatePlan(plan: MembershipPlan) {
    if (!customer) return;
    customer.membershipPlan = plan;
    customer.membershipStartedAt = customer.membershipStartedAt ?? new Date().toISOString();
    customer.membershipAutoRenew = true;
    await upsertCustomer(customer);
    await refresh();
  }

  function openNewEq() {
    setEqEditing(null);
    setEqForm({ type: "furnace", brand: "", model: "", serialNumber: "", installDate: "", warrantyExpiry: "", status: "active", lastServiceDate: "", notes: "", seerRating: "", maintenanceIntervalMonths: "12", expectedLifespanYears: "", replacementEstimate: "" });
    setEqOpen(true);
  }

  function openEditEq(e: Equipment) {
    setEqEditing(e);
    setEqForm({
      type: e.type,
      brand: e.brand,
      model: e.model,
      serialNumber: e.serialNumber,
      installDate: e.installDate.slice(0, 10),
      warrantyExpiry: e.warrantyExpiry.slice(0, 10),
      status: e.status,
      lastServiceDate: e.lastServiceDate ? e.lastServiceDate.slice(0, 10) : "",
      notes: e.notes ?? "",
      seerRating: e.seerRating != null ? String(e.seerRating) : "",
      maintenanceIntervalMonths: String(e.maintenanceIntervalMonths ?? 12),
      expectedLifespanYears: e.expectedLifespanYears != null ? String(e.expectedLifespanYears) : "",
      replacementEstimate: e.replacementEstimate != null ? String(e.replacementEstimate) : "",
    });
    setEqOpen(true);
  }

  async function saveEq(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    const eq: Equipment = {
      id: eqEditing?.id ?? newId("eq"),
      customerId: customer.id,
      type: eqForm.type as any,
      brand: eqForm.brand.trim(),
      model: eqForm.model.trim(),
      serialNumber: eqForm.serialNumber.trim(),
      installDate: new Date(eqForm.installDate || Date.now()).toISOString(),
      warrantyExpiry: new Date(eqForm.warrantyExpiry || Date.now()).toISOString(),
      status: eqForm.status as any,
      lastServiceDate: eqForm.lastServiceDate ? new Date(eqForm.lastServiceDate).toISOString() : undefined,
      notes: eqForm.notes.trim() || undefined,
      seerRating: eqForm.seerRating ? Number(eqForm.seerRating) : undefined,
      maintenanceIntervalMonths: Number(eqForm.maintenanceIntervalMonths) || 12,
      expectedLifespanYears: eqForm.expectedLifespanYears ? Number(eqForm.expectedLifespanYears) : undefined,
      replacementEstimate: eqForm.replacementEstimate ? Number(eqForm.replacementEstimate) : undefined,
    };
    await upsertEquipment(eq);
    setEqOpen(false);
    await refresh();
  }

  async function deleteEq(id: string) {
    await deleteEquipment(id);
    await refresh();
  }

  async function markReminderDone(id: string) {
    const r = await db.reminders.get(id);
    if (!r) return;
    r.status = "done";
    await db.reminders.put(r);
    await refresh();
  }

  if (!customer) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-extrabold text-gray-900">Customer not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-2xl font-extrabold text-gray-900">{customer.name}</div>
            {highValue ? <Badge tone="green">High value</Badge> : null}
            <Badge tone={customer.membershipPlan === "platinum" ? "purple" : customer.membershipPlan === "gold" ? "yellow" : "gray"}>{customer.membershipPlan ?? "none"}</Badge>
          </div>
          <div className="text-sm font-semibold text-gray-600">{customer.email} • {customer.phone ?? ""}</div>
          <div className="mt-1 text-sm font-semibold text-gray-600">{customer.address ?? ""}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((t) => (
              <button key={t} className="rounded-xl bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200" onClick={() => removeTag(t)}>
                {t} ✕
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input label="Add tag" value={tagText} onChange={setTagText} placeholder="commercial, priority…" />
            <div className="pt-6">
              <Button onClick={addTag} disabled={!tagText.trim()}>Add</Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-bold text-gray-500">Lifetime value</div>
            <div className="text-lg font-extrabold text-gray-900">${ltv.toFixed(2)}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-bold text-gray-500">Repeat service</div>
            <div className="text-lg font-extrabold text-gray-900">{repeatServiceCount}</div>
          </div>
          <Button variant="secondary" onClick={openNewEq}>Add equipment</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-extrabold text-gray-900">Equipment records & lifecycle overview</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => updatePlan("silver")}>Silver</Button>
                <Button variant="secondary" onClick={() => updatePlan("gold")}>Gold</Button>
                <Button variant="secondary" onClick={() => updatePlan("platinum")}>Platinum</Button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {equipment.length === 0 ? <div className="text-sm font-semibold text-gray-500">No equipment.</div> : null}
              {equipment.map((e) => {
                const ws = warrantyStatus(e);
                const lifecycle = lifecycleBadge(e);
                return (
                  <div key={e.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-gray-900">{e.type}: {e.brand} {e.model}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={ws.tone}>{ws.label}</Badge>
                        <Badge tone={lifecycle.tone}>{lifecycle.label}</Badge>
                      </div>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-600">Serial: {e.serialNumber}</div>
                    <div className="text-xs font-semibold text-gray-500">
                      Installed: {new Date(e.installDate).toLocaleDateString()} • Warranty: {new Date(e.warrantyExpiry).toLocaleDateString()} • Age: {equipmentAgeYears(e).toFixed(1)} years
                    </div>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-gray-50 p-3 text-xs font-semibold text-gray-700">{replacementRecommendation(e)}</div>
                      <div className="rounded-xl bg-gray-50 p-3 text-xs font-semibold text-gray-700">{energyEfficiencySuggestion(e)}</div>
                    </div>
                    {e.notes ? <div className="mt-2 text-xs font-semibold text-gray-600 whitespace-pre-wrap">{e.notes}</div> : null}
                    <div className="mt-2 flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEditEq(e)}>Edit</Button>
                      <Button variant="danger" onClick={() => deleteEq(e.id)}>Delete</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Service history timeline</div>
            <div className="mt-3 space-y-2">
              {jobs.length === 0 ? <div className="text-sm font-semibold text-gray-500">No service history.</div> : null}
              {jobs.slice(0, 16).map((j) => (
                <div key={j.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-gray-900">{j.title}</div>
                    <Badge tone={j.status === "completed" ? "green" : "gray"}>{j.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-600">{j.serviceType} • {new Date(j.scheduledStart).toLocaleString()}</div>
                  <div className="mt-1 text-xs font-semibold text-gray-500">{j.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Maintenance reminders</div>
            <div className="mt-3 space-y-2">
              {reminders.length === 0 ? <div className="text-sm font-semibold text-gray-500">No reminders.</div> : null}
              {reminders.map((r) => (
                <div key={r.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-gray-900">{r.title}</div>
                    <Badge tone={r.status === "done" ? "green" : "yellow"}>{r.status}</Badge>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-600">Due: {new Date(r.dueDate).toLocaleDateString()}</div>
                  {r.status !== "done" ? (
                    <div className="mt-2 flex justify-end">
                      <Button onClick={() => markReminderDone(r.id)}>Mark done</Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs font-semibold text-gray-600">
              Membership plans and equipment maintenance intervals can auto-create reminders and jobs.
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Membership & retention</div>
            <div className="mt-3 text-sm font-semibold text-gray-700">
              Plan: <span className="font-extrabold capitalize">{customer.membershipPlan ?? "none"}</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-700">
              Started: {customer.membershipStartedAt ? new Date(customer.membershipStartedAt).toLocaleDateString() : "—"}
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-700">
              Auto-renew: {customer.membershipAutoRenew ? "on" : "off"}
            </div>
          </div>
        </div>
      </div>

      <Modal
        title={eqEditing ? "Edit equipment" : "Add equipment"}
        open={eqOpen}
        onClose={() => setEqOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEqOpen(false)}>Cancel</Button>
            <Button type="submit" form="eqForm">Save</Button>
          </div>
        }
      >
        <form id="eqForm" className="grid gap-3 md:grid-cols-2" onSubmit={saveEq}>
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Type</div>
            <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300" value={eqForm.type} onChange={(e) => setEqForm((p) => ({ ...p, type: e.target.value }))}>
              <option value="furnace">Furnace</option>
              <option value="boiler">Boiler</option>
              <option value="ac_unit">AC Unit</option>
              <option value="heat_pump">Heat Pump</option>
              <option value="water_heater">Water heater</option>
              <option value="thermostat">Thermostat</option>
              <option value="ductwork">Ductwork</option>
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Status</div>
            <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300" value={eqForm.status} onChange={(e) => setEqForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="needs_service">Needs service</option>
              <option value="warranty_expired">Warranty expired</option>
              <option value="replaced">Replaced</option>
            </select>
          </label>

          <Input label="Brand" value={eqForm.brand} onChange={(v) => setEqForm((p) => ({ ...p, brand: v }))} required />
          <Input label="Model" value={eqForm.model} onChange={(v) => setEqForm((p) => ({ ...p, model: v }))} required />
          <Input label="Serial number" value={eqForm.serialNumber} onChange={(v) => setEqForm((p) => ({ ...p, serialNumber: v }))} required />
          <Input label="Install date (YYYY-MM-DD)" value={eqForm.installDate} onChange={(v) => setEqForm((p) => ({ ...p, installDate: v }))} />
          <Input label="Warranty expiry (YYYY-MM-DD)" value={eqForm.warrantyExpiry} onChange={(v) => setEqForm((p) => ({ ...p, warrantyExpiry: v }))} />
          <Input label="Last service date (YYYY-MM-DD)" value={eqForm.lastServiceDate} onChange={(v) => setEqForm((p) => ({ ...p, lastServiceDate: v }))} />
          <Input label="SEER rating" type="number" value={eqForm.seerRating} onChange={(v) => setEqForm((p) => ({ ...p, seerRating: v }))} />
          <Input label="Maintenance interval (months)" type="number" value={eqForm.maintenanceIntervalMonths} onChange={(v) => setEqForm((p) => ({ ...p, maintenanceIntervalMonths: v }))} />
          <Input label="Expected lifespan (years)" type="number" value={eqForm.expectedLifespanYears} onChange={(v) => setEqForm((p) => ({ ...p, expectedLifespanYears: v }))} />
          <Input label="Replacement estimate" type="number" value={eqForm.replacementEstimate} onChange={(v) => setEqForm((p) => ({ ...p, replacementEstimate: v }))} />

          <label className="block md:col-span-2">
            <div className="mb-1 text-sm font-semibold text-gray-800">Notes</div>
            <textarea className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300" rows={3} value={eqForm.notes} onChange={(e) => setEqForm((p) => ({ ...p, notes: e.target.value }))} />
          </label>
        </form>
      </Modal>
    </div>
  );
}

async function autoReminders(customerId: string, equipment: Equipment[]) {
  const now = new Date();
  for (const e of equipment) {
    if (e.status === "replaced") continue;
    const last = e.lastServiceDate ? new Date(e.lastServiceDate) : new Date(e.installDate);
    const due = new Date(last);
    due.setMonth(due.getMonth() + (e.maintenanceIntervalMonths ?? 12));
    if (due < now) due.setDate(now.getDate() + 7);

    const existing = await db.reminders.where({ customerId, equipmentId: e.id }).and((r) => r.status !== "dismissed").first();
    if (existing) continue;

    await db.reminders.add({
      id: newId("rem"),
      customerId,
      equipmentId: e.id,
      dueDate: due.toISOString(),
      title: `Maintenance due (${e.type})`,
      status: "due",
      createdAt: new Date().toISOString(),
    });
  }
}
