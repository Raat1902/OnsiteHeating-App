import React, { useEffect, useState } from "react";
import type { DiscountType, Promotion, ServiceType, User } from "../types";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { deletePromotion, listPromotions, upsertPromotion } from "../lib/data";
import { newId } from "../lib/id";

const serviceTypes: ServiceType[] = ["repair", "maintenance", "installation", "emergency"];

export function PromotionsPage(_props: { user: User }) {
  const [items, setItems] = useState<Promotion[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  const [form, setForm] = useState({
    code: "",
    title: "",
    description: "",
    discountType: "percentage" as DiscountType,
    discountValue: "10",
    validFrom: "",
    validTo: "",
    active: true,
    maxUses: "",
    serviceTypes: new Set<ServiceType>(["maintenance"]),
  });

  async function refresh() {
    setItems(await listPromotions());
  }

  useEffect(() => { refresh(); }, []);

  function openNew() {
    setEditing(null);
    setForm({
      code: "",
      title: "",
      description: "",
      discountType: "percentage",
      discountValue: "10",
      validFrom: "",
      validTo: "",
      active: true,
      maxUses: "",
      serviceTypes: new Set<ServiceType>(["maintenance"]),
    });
    setOpen(true);
  }

  function openEdit(p: Promotion) {
    setEditing(p);
    setForm({
      code: p.code,
      title: p.title,
      description: p.description,
      discountType: p.discountType,
      discountValue: String(p.discountValue),
      validFrom: p.validFrom.slice(0, 16),
      validTo: p.validTo.slice(0, 16),
      active: p.active,
      maxUses: p.maxUses != null ? String(p.maxUses) : "",
      serviceTypes: new Set(p.serviceTypes),
    });
    setOpen(true);
  }

  function toggleType(t: ServiceType) {
    setForm((p) => {
      const next = new Set(p.serviceTypes);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return { ...p, serviceTypes: next };
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const p: Promotion = {
      id: editing?.id ?? newId("promo"),
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: Math.max(0, Number(form.discountValue) || 0),
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : now,
      validTo: form.validTo ? new Date(form.validTo).toISOString() : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      active: form.active,
      maxUses: form.maxUses ? Math.max(1, Number(form.maxUses) || 1) : undefined,
      uses: editing?.uses ?? 0,
      serviceTypes: [...form.serviceTypes],
    };
    await upsertPromotion(p);
    setOpen(false);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-gray-900">Coupons & Promotions</div>
          <div className="text-sm font-semibold text-gray-500">Codes customers can redeem during booking.</div>
        </div>
        <Button onClick={openNew}>New coupon</Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
          <div className="col-span-4">Promo</div>
          <div className="col-span-2">Code</div>
          <div className="col-span-2">Discount</div>
          <div className="col-span-2">Uses</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="divide-y divide-gray-100">
          {items.length === 0 ? (
            <div className="p-4 text-sm font-semibold text-gray-500">No coupons yet.</div>
          ) : (
            items.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 p-3">
                <div className="col-span-4">
                  <div className="font-extrabold text-gray-900">{p.title}</div>
                  <div className="text-sm font-semibold text-gray-600">{p.description}</div>
                  <div className="mt-1 text-xs font-semibold text-gray-500">Services: {p.serviceTypes.join(", ")}</div>
                </div>
                <div className="col-span-2 font-extrabold text-gray-900">{p.code}</div>
                <div className="col-span-2 text-sm font-semibold text-gray-700">
                  {p.discountType === "fixed" ? `$${p.discountValue}` : `${p.discountValue}%`}
                </div>
                <div className="col-span-2 text-sm font-semibold text-gray-700">
                  {p.uses}/{p.maxUses ?? "∞"} {p.active ? <Badge tone="green">active</Badge> : <Badge tone="gray">inactive</Badge>}
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => openEdit(p)}>Edit</Button>
                  <Button variant="danger" onClick={async () => { await deletePromotion(p.id); await refresh(); }}>Delete</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title={editing ? "Edit coupon" : "New coupon"}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="promoForm">Save</Button>
          </div>
        }
      >
        <form id="promoForm" className="grid gap-3 md:grid-cols-2" onSubmit={save}>
          <Input label="Code" value={form.code} onChange={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))} required />
          <Input label="Title" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} required />
          <Input label="Discount value" type="number" min={0} step={1} value={form.discountValue} onChange={(v) => setForm((p) => ({ ...p, discountValue: v }))} />
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Discount type</div>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              value={form.discountType}
              onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as DiscountType }))}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </select>
          </label>

          <Input label="Valid from" type="datetime-local" value={form.validFrom} onChange={(v) => setForm((p) => ({ ...p, validFrom: v }))} />
          <Input label="Valid to" type="datetime-local" value={form.validTo} onChange={(v) => setForm((p) => ({ ...p, validTo: v }))} />
          <Input label="Max uses (optional)" value={form.maxUses} onChange={(v) => setForm((p) => ({ ...p, maxUses: v }))} />

          <label className="flex items-center gap-2 rounded-2xl border border-gray-200 p-3 md:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
            <span className="text-sm font-semibold text-gray-800">Active</span>
          </label>

          <label className="block md:col-span-2">
            <div className="mb-2 text-sm font-semibold text-gray-800">Applies to service types</div>
            <div className="flex flex-wrap gap-2">
              {serviceTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    form.serviceTypes.has(t) ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                  }`}
                  onClick={() => toggleType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </label>

          <label className="block md:col-span-2">
            <div className="mb-1 text-sm font-semibold text-gray-800">Description</div>
            <textarea
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              required
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
