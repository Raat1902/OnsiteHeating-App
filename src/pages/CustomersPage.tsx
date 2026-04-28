import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "../types";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { listCustomers } from "../lib/data";

export function CustomersPage(_props: { user: User }) {
  const [customers, setCustomers] = useState<User[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const cs = await listCustomers();
      if (alive) setCustomers(cs);
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => (c.name + " " + c.email + " " + (c.phone ?? "")).toLowerCase().includes(s));
  }, [customers, q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-gray-900">Customers (CRM)</div>
          <div className="text-sm font-semibold text-gray-500">Profiles, tags, service history, equipment, reminders.</div>
        </div>
        <div className="w-full md:w-[320px]">
          <Input label="Search" value={q} onChange={setQ} placeholder="Name, email, phone…" />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
          <div className="col-span-4">Customer</div>
          <div className="col-span-4">Tags</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2 text-right">Open</div>
        </div>

        <div className="divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm font-semibold text-gray-500">No customers found.</div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 p-3">
                <div className="col-span-4">
                  <div className="font-extrabold text-gray-900">{c.name}</div>
                  <div className="text-sm font-semibold text-gray-600">{c.email}</div>
                  <div className="text-xs font-semibold text-gray-500">{c.phone ?? ""}</div>
                </div>
                <div className="col-span-4 flex flex-wrap gap-2">
                  {(c.tags ?? []).map((t) => <Badge key={t} tone={t === "priority" ? "red" : "gray"}>{t}</Badge>)}
                </div>
                <div className="col-span-2 text-sm font-semibold text-gray-700">
                  {(c.tags ?? []).includes("commercial") ? "Commercial" : "Residential"}
                </div>
                <div className="col-span-2 flex justify-end">
                  <Link to={`/app/customers/${c.id}`} className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-extrabold text-white hover:bg-gray-800">
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
