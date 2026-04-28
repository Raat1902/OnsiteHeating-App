import React, { useEffect, useMemo, useState } from "react";
import type { Part, User } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { adjustPartStock, listParts, listTruckInventory, setTruckPartQty, upsertPart } from "../lib/data";
import { newId } from "../lib/id";

export function InventoryPage(props: { user: User }) {
  const [parts, setParts] = useState<Part[]>([]);
  const [truck, setTruck] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    unitCost: "0",
    unitPrice: "0",
    stockQty: "0",
    reorderLevel: "3",
    supplier: "HVAC Supply Co",
    barcode: "",
    warehouseQty: "0",
  });

  async function refresh() {
    setParts(await listParts());
    if (props.user.role === "technician") setTruck(await listTruckInventory(props.user.id));
  }

  useEffect(() => { refresh(); }, []);

  const lowStock = useMemo(() => parts.filter((p) => p.stockQty <= p.reorderLevel), [parts]);

  function openNew() {
    setEditing(null);
    setForm({ sku: "", name: "", unitCost: "0", unitPrice: "0", stockQty: "0", reorderLevel: "3", supplier: "HVAC Supply Co", barcode: "", warehouseQty: "0" });
    setOpen(true);
  }

  function openEdit(p: Part) {
    setEditing(p);
    setForm({
      sku: p.sku,
      name: p.name,
      unitCost: String(p.unitCost),
      unitPrice: String(p.unitPrice),
      stockQty: String(p.stockQty),
      reorderLevel: String(p.reorderLevel),
      supplier: p.supplier,
      barcode: p.barcode ?? "",
      warehouseQty: String(p.warehouseQty ?? 0),
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p: Part = {
      id: editing?.id ?? newId("part"),
      sku: form.sku.trim(),
      name: form.name.trim(),
      unitCost: Number(form.unitCost) || 0,
      unitPrice: Number(form.unitPrice) || 0,
      stockQty: Math.max(0, Number(form.stockQty) || 0),
      reorderLevel: Math.max(0, Number(form.reorderLevel) || 0),
      supplier: form.supplier.trim(),
      barcode: form.barcode.trim() || undefined,
      warehouseQty: Math.max(0, Number(form.warehouseQty) || 0),
    };
    await upsertPart(p);
    setOpen(false);
    await refresh();
  }

  async function orderSupplier(p: Part) {
    alert(`Supplier order stub:\n\nOrder: ${p.name} (${p.sku})\nSupplier: ${p.supplier}\nRecommended qty: ${Math.max(5, p.reorderLevel * 2)}\n\nIn a real app, this would create a purchase order.`);
  }

  async function setTruckQty(partId: string, qty: number) {
    await setTruckPartQty(props.user.id, partId, qty);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-gray-900">Inventory & Parts</div>
          <div className="text-sm font-semibold text-gray-500">Catalog, stock tracking, warehouse vs truck inventory, barcode-ready part records, and low-stock alerts.</div>
        </div>
        {props.user.role === "admin" ? <Button onClick={openNew}>Add part</Button> : null}
      </div>

      {lowStock.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">
          Low stock alert: {lowStock.length} items below reorder level.
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
          <div className="col-span-4">Part</div>
          <div className="col-span-2">Stock</div>
          <div className="col-span-2">Price</div>
          <div className="col-span-2">Supplier</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="divide-y divide-gray-100">
          {parts.length === 0 ? (
            <div className="p-4 text-sm font-semibold text-gray-500">No parts yet.</div>
          ) : (
            parts.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 p-3">
                <div className="col-span-4">
                  <div className="font-extrabold text-gray-900">{p.name}</div>
                  <div className="text-xs font-semibold text-gray-500">SKU: {p.sku}{p.barcode ? ` • barcode ${p.barcode}` : ""}</div>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Badge tone={p.stockQty <= p.reorderLevel ? "yellow" : "green"}>{p.stockQty}</Badge>
                  <span className="text-xs font-semibold text-gray-500">warehouse {p.warehouseQty ?? 0} • reorder {p.reorderLevel}</span>
                </div>
                <div className="col-span-2 text-sm font-semibold text-gray-700">${p.unitPrice.toFixed(2)}</div>
                <div className="col-span-2 text-sm font-semibold text-gray-700">{p.supplier}</div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => orderSupplier(p)}>Order</Button>
                  {props.user.role === "admin" ? (
                    <>
                      <Button variant="secondary" onClick={() => openEdit(p)}>Edit</Button>
                      <Button variant="secondary" onClick={async () => { await adjustPartStock(p.id, +1); await refresh(); }}>+1</Button>
                      <Button variant="secondary" onClick={async () => { await adjustPartStock(p.id, -1); await refresh(); }}>-1</Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {props.user.role === "technician" ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-gray-900">Truck inventory</div>
          <div className="mt-3 grid gap-2">
            {parts.slice(0, 12).map((p) => {
              const row = truck.find((t: any) => t.part.id === p.id);
              const qty = row?.qty ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between rounded-2xl border border-gray-100 p-3">
                  <div>
                    <div className="font-extrabold text-gray-900">{p.name}</div>
                    <div className="text-xs font-semibold text-gray-500">Truck qty: {qty}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setTruckQty(p.id, qty + 1)}>+1</Button>
                    <Button variant="secondary" onClick={() => setTruckQty(p.id, Math.max(0, qty - 1))}>-1</Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs font-semibold text-gray-600">
            Real apps may include barcode scanning; here it’s manual.
          </div>
        </div>
      ) : null}

      <Modal
        title={editing ? "Edit part" : "Add part"}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="partForm">Save</Button>
          </div>
        }
      >
        <form id="partForm" className="grid gap-3 md:grid-cols-2" onSubmit={save}>
          <Input label="SKU" value={form.sku} onChange={(v) => setForm((p) => ({ ...p, sku: v }))} required />
          <Input label="Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} required />
          <Input label="Unit cost" type="number" step={0.01} value={form.unitCost} onChange={(v) => setForm((p) => ({ ...p, unitCost: v }))} />
          <Input label="Unit price" type="number" step={0.01} value={form.unitPrice} onChange={(v) => setForm((p) => ({ ...p, unitPrice: v }))} />
          <Input label="Stock qty" type="number" min={0} step={1} value={form.stockQty} onChange={(v) => setForm((p) => ({ ...p, stockQty: v }))} />
          <Input label="Reorder level" type="number" min={0} step={1} value={form.reorderLevel} onChange={(v) => setForm((p) => ({ ...p, reorderLevel: v }))} />
          <Input label="Supplier" value={form.supplier} onChange={(v) => setForm((p) => ({ ...p, supplier: v }))} />
          <Input label="Barcode / QR code" value={form.barcode} onChange={(v) => setForm((p) => ({ ...p, barcode: v }))} />
          <Input label="Warehouse qty" type="number" min={0} step={1} value={form.warehouseQty} onChange={(v) => setForm((p) => ({ ...p, warehouseQty: v }))} />
        </form>
      </Modal>
    </div>
  );
}
