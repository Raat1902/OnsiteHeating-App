import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Attachment, Job, JobNote, User } from "../types";
import { db } from "../db";
import { buildMailtoReport, buildSmartJobSummary } from "../lib/hvac";

export function ServiceReportPage(props: { user: User }) {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [customer, setCustomer] = useState<User | null>(null);
  const [tech, setTech] = useState<User | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!jobId) return;
      const j = await db.jobs.get(jobId);
      if (!alive) return;
      setJob(j ?? null);
      if (!j) return;
      const [ns, ats, cust, technician] = await Promise.all([
        db.jobNotes.where("jobId").equals(j.id).toArray(),
        db.attachments.where("jobId").equals(j.id).toArray(),
        db.users.get(j.customerId),
        j.technicianId ? db.users.get(j.technicianId) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setNotes(ns);
      setAttachments(ats);
      setCustomer(cust ?? null);
      setTech(technician ?? null);
      setTimeout(() => window.print(), 120);
    })();
    return () => {
      alive = false;
    };
  }, [jobId]);

  const summary = useMemo(() => (job ? buildSmartJobSummary({ job, notes, attachments, customer, technician: tech }) : ""), [job, notes, attachments, customer, tech]);
  const photoCount = attachments.filter((a) => a.kind === "photo").length;

  if (!job) {
    return <div className="min-h-screen bg-gray-50 p-6 text-sm font-semibold text-gray-700">Service report not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <img src="/onsite-logo.png" alt="OnSite logo" className="h-14 w-auto" />
            <div className="mt-3 text-2xl font-extrabold text-gray-900">Service Report</div>
            <div className="mt-1 text-sm font-semibold text-gray-600">Job {job.id}</div>
            <div className="text-sm font-semibold text-gray-600">{job.title}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-700">{new Date(job.scheduledStart).toLocaleString()}</div>
            <div className="text-xs font-bold text-gray-500">{job.serviceType} • {job.status.replaceAll("_", " ")}</div>
            <a className="mt-2 inline-block text-xs font-bold text-blue-700 underline print:hidden" href={buildMailtoReport(job, customer, summary)}>
              Email report
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-extrabold text-gray-900">Customer</div>
            <div className="mt-2 text-sm font-semibold text-gray-800">{customer?.name ?? "Customer"}</div>
            <div className="text-sm font-semibold text-gray-700">{customer?.email ?? ""}</div>
            <div className="text-sm font-semibold text-gray-700">{customer?.phone ?? ""}</div>
            <div className="mt-2 text-xs font-semibold text-gray-600 whitespace-pre-wrap">{customer?.address ?? job.customerAddress ?? ""}</div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-extrabold text-gray-900">Technician / visit</div>
            <div className="mt-2 text-sm font-semibold text-gray-800">{tech?.name ?? "Unassigned"}</div>
            <div className="text-sm font-semibold text-gray-700">Window: {job.bookingWindow ?? "flex"}</div>
            <div className="text-sm font-semibold text-gray-700">Route status: {job.routeStatus ?? "scheduled"}</div>
            <div className="text-sm font-semibold text-gray-700">Photos: {photoCount}</div>
            {job.customerSignatureName ? <div className="text-sm font-semibold text-gray-700">Signed by: {job.customerSignatureName}</div> : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 p-4">
          <div className="text-sm font-extrabold text-gray-900">Summary</div>
          <pre className="mt-3 whitespace-pre-wrap text-sm font-semibold text-gray-700">{summary}</pre>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-extrabold text-gray-900">HVAC measurements</div>
            <div className="mt-3 space-y-1 text-sm font-semibold text-gray-700">
              <div>Supply temp: {job.diagnostics?.supplyTempF ?? "—"} °F</div>
              <div>Return temp: {job.diagnostics?.returnTempF ?? "—"} °F</div>
              <div>Delta T: {job.diagnostics?.deltaTF ?? "—"} °F</div>
              <div>Superheat: {job.diagnostics?.superheatF ?? "—"} °F</div>
              <div>Subcool: {job.diagnostics?.subcoolF ?? "—"} °F</div>
              <div>Static pressure: {job.diagnostics?.staticPressureInWc ?? "—"} in. w.c.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-extrabold text-gray-900">Checklists</div>
            <div className="mt-3 space-y-1 text-xs font-semibold text-gray-700">
              {[...(job.preJobChecklist ?? []), ...(job.safetyChecklist ?? []), ...(job.checklist ?? []), ...(job.postJobChecklist ?? [])].map((item) => (
                <div key={item.id}>{item.done ? "☑" : "☐"} {item.label}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-extrabold text-gray-900">Parts & notes</div>
            <div className="mt-3 text-xs font-semibold text-gray-700">
              {job.partsUsed.length === 0 ? <div>No parts used.</div> : job.partsUsed.map((part) => <div key={part.id}>{part.name} x{part.qty}</div>)}
            </div>
            {job.completionNotes ? <div className="mt-3 text-xs font-semibold text-gray-700 whitespace-pre-wrap">{job.completionNotes}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
