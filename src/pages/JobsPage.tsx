import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import type { BookingWindow, Job, Priority, ServiceType, User } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { createJobByCustomer, listEquipment, listJobsForUser, listPromotions, listTechnicians } from "../lib/data";
import { downloadCsv } from "../lib/export";
import { useToast } from "../components/ToastProvider";
import { bookingWindowStart } from "../lib/scheduling";

const CACHE_KEY = "onsite.cache.jobs.v1";

function toneForStatus(s: Job["status"]) {
  if (s === "completed") return "green";
  if (s === "cancelled") return "red";
  if (s === "in_progress") return "blue";
  if (s === "assigned") return "yellow";
  return "gray";
}

export function JobsPage(props: { user: User }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Job["status"] | "all">("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [techs, setTechs] = useState<Array<{ user: User }>>([]);
  const [equipment, setEquipment] = useState<any[]>([]);

  const [view, setView] = useState<"list" | "week">("list");

  const [open, setOpen] = useState(false);
  const [promoHint, setPromoHint] = useState<string>("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    serviceType: "repair" as ServiceType,
    priority: "medium" as Priority,
    scheduled: "",
    bookingWindow: "8-12" as BookingWindow,
    duration: "90",
    promoCode: "",
    equipmentId: "",
  });

  async function refresh() {
    setError(null);
    try {
      const list = await listJobsForUser(props.user);
      setJobs(list);
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      if (props.user.role === "admin") {
        const t = await listTechnicians();
        setTechs(t.map((x) => ({ user: x.user })));
      }
      if (props.user.role === "customer") {
        setEquipment(await listEquipment(props.user.id));
      }
    } catch (e) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setJobs(JSON.parse(cached));
        setError("Offline mode: showing cached jobs.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load jobs");
      }
    }
  }

  useEffect(() => { refresh(); }, [props.user]);

  const sorted = useMemo(() => [...jobs].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)), [jobs]);

  const filtered = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().trim();
    const qn = norm(q);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    return sorted.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (props.user.role === "admin") {
        if (techFilter === "unassigned" && j.technicianId) return false;
        if (techFilter !== "all" && techFilter !== "unassigned" && j.technicianId !== techFilter) return false;
      }

      if (from && new Date(j.scheduledStart) < from) return false;
      if (to && new Date(j.scheduledStart) > to) return false;

      if (!qn) return true;
      const hay = norm(`${j.title} ${j.description} ${j.serviceType} ${j.status} ${j.priority} ${j.id}`);
      return hay.includes(qn);
    });
  }, [sorted, q, statusFilter, techFilter, fromDate, toDate, props.user.role]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const scheduledStart = form.scheduled ? bookingWindowStart(form.scheduled, form.bookingWindow) : bookingWindowStart(new Date().toISOString(), form.bookingWindow);
      await createJobByCustomer({
        customer: props.user,
        title: form.title,
        description: form.description,
        serviceType: form.serviceType,
        priority: form.priority,
        scheduledStart,
        durationMinutes: Math.max(30, Number(form.duration) || 90),
        promoCode: form.promoCode.trim() || undefined,
        equipmentId: form.equipmentId || undefined,
        bookingWindow: form.bookingWindow,
      });
      setOpen(false);
      setForm({ title: "", description: "", serviceType: "repair", priority: "medium", scheduled: "", bookingWindow: "8-12", duration: "90", promoCode: "", equipmentId: "" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
      toast({ title: "Booking failed", message: err instanceof Error ? err.message : "Booking failed", tone: "error" });
    }
  }

  async function checkPromo(code: string) {
    setPromoHint("");
    const promos = await listPromotions();
    const p = promos.find((x) => x.code.toUpperCase() === code.toUpperCase());
    if (!p) setPromoHint("Code not found.");
    else setPromoHint(p.active ? `Valid promo: ${p.title}` : "Promo is inactive.");
  }

  function exportCsv() {
    const rows = filtered.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      serviceType: j.serviceType,
      priority: j.priority,
      scheduledStart: j.scheduledStart,
      durationMinutes: j.durationMinutes,
      customerId: j.customerId,
      technicianId: j.technicianId ?? "",
      updatedAt: j.updatedAt,
    }));
    downloadCsv(`jobs-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast({ title: "Exported CSV", message: `Downloaded ${rows.length} jobs`, tone: "success" });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-gray-900">Jobs & Appointments</div>
          <div className="text-sm font-semibold text-gray-500">
            {props.user.role === "customer"
              ? "Book service, view appointments, track status."
              : props.user.role === "technician"
              ? "Work orders: checklists, diagnostics, notes, attachments."
              : "Admin: manage all jobs and dispatch technicians."}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}>List</Button>
          <Button variant={view === "week" ? "primary" : "secondary"} onClick={() => setView("week")}>Week</Button>
          {props.user.role === "customer" ? <Button onClick={() => setOpen(true)}>Book service</Button> : null}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">{error}</div>
      ) : null}

      {view === "list" ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end gap-2 border-b border-gray-100 bg-gray-50 p-3">
            <div className="flex-1 min-w-[220px]">
              <Input label="Search" value={q} onChange={setQ} placeholder="Title, description, status…" />
            </div>
            <label className="block">
              <div className="mb-1 text-sm font-semibold text-gray-800">Status</div>
              <select
                className="w-full min-w-[160px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="draft">draft</option>
                <option value="scheduled">scheduled</option>
                <option value="assigned">assigned</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>

            {props.user.role === "admin" ? (
              <label className="block">
                <div className="mb-1 text-sm font-semibold text-gray-800">Technician</div>
                <select
                  className="w-full min-w-[180px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                  value={techFilter}
                  onChange={(e) => setTechFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="unassigned">Unassigned</option>
                  {techs.map((t) => (
                    <option key={t.user.id} value={t.user.id}>
                      {t.user.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <div className="mb-1 text-sm font-semibold text-gray-800">From</div>
              <input
                className="w-full min-w-[160px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-semibold text-gray-800">To</div>
              <input
                className="w-full min-w-[160px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={() => { setQ(""); setStatusFilter("all"); setTechFilter("all"); setFromDate(""); setToDate(""); }}>
                Clear
              </Button>
              <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 p-3 text-xs font-bold uppercase tracking-wide text-gray-600">
            <div className="col-span-5">Job</div>
            <div className="col-span-2">Scheduled</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-2 text-right">Open</div>
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm font-semibold text-gray-500">No jobs yet.</div>
            ) : (
              filtered.map((j) => (
                <div key={j.id} className="grid grid-cols-12 gap-2 p-3">
                  <div className="col-span-5">
                    <div className="font-extrabold text-gray-900">{j.title}</div>
                    <div className="text-sm font-semibold text-gray-600">{j.serviceType}</div>
                    {props.user.role !== "customer" ? (
                      <div className="mt-1 text-xs font-semibold text-gray-500">
                        Checklist: {j.checklist.filter((c) => c.done).length}/{j.checklist.length}
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs font-semibold text-gray-500 line-clamp-2">{j.description}</div>
                  </div>
                  <div className="col-span-2 text-sm font-semibold text-gray-700"><div>{format(new Date(j.scheduledStart), "PP p")}</div>
                    {j.bookingWindow ? <div className="text-xs font-semibold text-gray-500">{j.bookingWindow}</div> : null}</div>
                  <div className="col-span-2">
                    <Badge tone={toneForStatus(j.status) as any}>{j.status}</Badge>
                  </div>
                  <div className="col-span-1">
                    <Badge tone={j.priority === "emergency" ? "red" : j.priority === "high" ? "yellow" : "gray"}>{j.priority}</Badge>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Link to={`/app/jobs/${j.id}`} className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-extrabold text-white hover:bg-gray-800">
                      Details
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <WeekView jobs={sorted} />
      )}

      <Modal
        title="Book a service"
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="bookForm">Book</Button>
          </div>
        }
      >
        <form id="bookForm" className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <Input label="Title" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} required />
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Service type</div>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              value={form.serviceType}
              onChange={(e) => setForm((p) => ({ ...p, serviceType: e.target.value as ServiceType }))}
            >
              <option value="repair">Repair</option>
              <option value="maintenance">Maintenance</option>
              <option value="installation">Installation</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>

          <label className="block md:col-span-2">
            <div className="mb-1 text-sm font-semibold text-gray-800">Description</div>
            <textarea
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              required
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Priority</div>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Priority }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>

          <Input label="Preferred date" type="datetime-local" value={form.scheduled} onChange={(v) => setForm((p) => ({ ...p, scheduled: v }))} />

          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Time window</div>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
              value={form.bookingWindow}
              onChange={(e) => setForm((p) => ({ ...p, bookingWindow: e.target.value as BookingWindow }))}
            >
              <option value="8-12">8-12</option>
              <option value="12-4">12-4</option>
              <option value="flex">Flexible</option>
            </select>
          </label>
          <Input label="Estimated duration (minutes)" type="number" min={30} step={15} value={form.duration} onChange={(v) => setForm((p) => ({ ...p, duration: v }))} />

          <div className="md:col-span-2 grid gap-2">
            <Input label="Coupon / Promo code (optional)" value={form.promoCode} onChange={(v) => setForm((p) => ({ ...p, promoCode: v.toUpperCase() }))} placeholder="WINTER15" />
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => checkPromo(form.promoCode || "")}>Check code</Button>
              {promoHint ? <div className="text-xs font-semibold text-gray-600">{promoHint}</div> : null}
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs font-semibold text-gray-600">
            Emergency? Use the red <b>Emergency</b> button in the header to call our hotline.
          </div>
        </form>
      </Modal>
    </div>
  );
}

function WeekView(props: { jobs: Job[] }) {
  const days = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const d of days) map.set(d.toDateString(), []);
    for (const j of props.jobs) {
      const dt = new Date(j.scheduledStart);
      const key = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).toDateString();
      if (map.has(key)) map.get(key)!.push(j);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
    return map;
  }, [props.jobs, days]);

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-7">
      {days.map((d) => {
        const list = byDay.get(d.toDateString()) ?? [];
        return (
          <div key={d.toISOString()} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
            <div className="text-sm font-extrabold text-gray-900">{d.toLocaleDateString()}</div>
            <div className="mt-3 space-y-2">
              {list.map((j) => (
                <Link key={j.id} to={`/app/jobs/${j.id}`} className="block rounded-2xl border border-gray-100 p-2 hover:bg-gray-50">
                  <div className="text-xs font-bold text-gray-900">{format(new Date(j.scheduledStart), "p")}</div>
                  <div className="text-sm font-extrabold text-gray-900 line-clamp-1">{j.title}</div>
                  <div className="text-[11px] font-semibold text-gray-600">{j.status}</div>
                </Link>
              ))}
              {list.length === 0 ? <div className="text-xs font-semibold text-gray-500">No jobs</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
