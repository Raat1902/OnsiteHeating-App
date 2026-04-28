import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, MapPin, Play, Send, Square } from "lucide-react";
import type { Attachment, Job, JobChecklistItem, User } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import {
  addAttachment,
  addJobNote,
  addMessage,
  addPartUsedToJob,
  listAttachments,
  listAuditEventsForJob,
  listEquipment,
  listJobNotes,
  listMessages,
  listParts,
  listTimeEntries,
  startTime,
  stopTime,
  updateJob,
} from "../lib/data";
import { ensureInvoiceForJob, googleMapsLink } from "../lib/domain";
import { db } from "../db";
import { buildMailtoReport, buildSmartJobSummary, compressImageFile } from "../lib/hvac";
import { useToast } from "../components/ToastProvider";

function toneForStatus(s: Job["status"]) {
  if (s === "completed") return "green";
  if (s === "cancelled") return "red";
  if (s === "in_progress") return "blue";
  if (s === "assigned") return "yellow";
  return "gray";
}

function ChecklistSection(props: { title: string; items: JobChecklistItem[]; onToggle?: (itemId: string, done: boolean) => void }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-base font-extrabold text-gray-900">{props.title}</div>
      <div className="mt-3 space-y-2">
        {props.items.length === 0 ? <div className="text-sm font-semibold text-gray-500">No items yet.</div> : props.items.map((item) => (
          <label key={item.id} className="flex items-start gap-3 rounded-2xl border border-gray-100 p-3">
            <input type="checkbox" checked={item.done} onChange={(e) => props.onToggle?.(item.id, e.target.checked)} />
            <span className="text-sm font-semibold text-gray-800">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function JobDetailPage(props: { user: User }) {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [technician, setTechnician] = useState<User | null>(null);

  const [notes, setNotes] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  const [noteText, setNoteText] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"internal" | "shared">("internal");
  const [messageText, setMessageText] = useState("");

  const [attOpen, setAttOpen] = useState(false);
  const [attKind, setAttKind] = useState<"photo" | "voice" | "document">("photo");
  const [attFile, setAttFile] = useState<File | null>(null);
  const [attStage, setAttStage] = useState<"before" | "after" | "general">("before");
  const [attAnnotation, setAttAnnotation] = useState("");
  const [attEquipmentId, setAttEquipmentId] = useState("");

  const [addPartOpen, setAddPartOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [selectedQty, setSelectedQty] = useState<string>("1");

  const [completionNotes, setCompletionNotes] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  async function refresh() {
    if (!jobId) return;
    const j = await db.jobs.get(jobId);
    setJob(j ?? null);
    if (!j) return;

    const [ns, ats, msgs, times, ps, aud, cust, tech, eq] = await Promise.all([
      listJobNotes(jobId),
      listAttachments(jobId),
      listMessages(jobId),
      listTimeEntries(jobId),
      listParts(),
      listAuditEventsForJob(jobId),
      db.users.get(j.customerId),
      j.technicianId ? db.users.get(j.technicianId) : Promise.resolve(null),
      listEquipment(j.customerId),
    ]);
    setNotes(ns);
    setAttachments(ats);
    setMessages(msgs);
    setTimeEntries(times);
    setParts(ps);
    setAudit(aud);
    setCustomer(cust ?? null);
    setTechnician(tech ?? null);
    setEquipment(eq);
    setCompletionNotes(j.completionNotes ?? "");
    setSignatureName(j.customerSignatureName ?? j.diagnostics?.customerSignature ?? "");
    setAttEquipmentId(j.equipmentId ?? eq[0]?.id ?? "");
  }

  useEffect(() => {
    refresh();
  }, [jobId]);

  const canEdit = useMemo(() => {
    if (!job) return false;
    if (props.user.role === "admin") return true;
    if (props.user.role === "technician") return job.technicianId === props.user.id;
    return job.customerId === props.user.id;
  }, [props.user, job]);

  const canTechWork = useMemo(() => props.user.role === "technician" && job?.technicianId === props.user.id, [props.user, job]);

  const openTimeEntry = useMemo(() => timeEntries.find((t) => !t.endedAt), [timeEntries]);
  const photoGroups = useMemo(() => ({
    before: attachments.filter((a) => a.kind === "photo" && a.photoStage === "before"),
    after: attachments.filter((a) => a.kind === "photo" && a.photoStage === "after"),
    general: attachments.filter((a) => a.kind === "photo" && (!a.photoStage || a.photoStage === "general")),
  }), [attachments]);

  const summary = useMemo(() => job ? buildSmartJobSummary({ job, notes, attachments, customer, technician }) : "", [job, notes, attachments, customer, technician]);

  function previewUrl(att: Attachment) {
    return URL.createObjectURL(att.blob);
  }

  async function saveChecklist(section: "checklist" | "preJobChecklist" | "safetyChecklist" | "postJobChecklist", itemId: string, done: boolean) {
    if (!job) return;
    const list = (job[section] ?? []).map((item) => item.id === itemId ? { ...item, done } : item);
    const next = await updateJob(job.id, { [section]: list } as Partial<Job>, props.user);
    setJob(next);
    await refresh();
  }

  async function saveStatus(status: Job["status"]) {
    if (!job) return;
    await updateJob(job.id, { status }, props.user);
    await refresh();
    toast({ title: "Job updated", message: status.replaceAll("_", " "), tone: "success" });
  }

  async function saveRouteStatus(routeStatus: Job["routeStatus"]) {
    if (!job) return;
    await updateJob(job.id, { routeStatus }, props.user);
    await refresh();
  }

  async function saveDiagnostics(patch: Partial<Job["diagnostics"]>) {
    if (!job) return;
    await updateJob(job.id, { diagnostics: { ...(job.diagnostics ?? {}), ...patch } }, props.user);
    await refresh();
  }

  async function saveCompletion() {
    if (!job) return;
    await updateJob(job.id, {
      completionNotes,
      customerSignatureName: signatureName || undefined,
      diagnostics: {
        ...(job.diagnostics ?? {}),
        customerSignature: signatureName || undefined,
        customerApprovalAt: signatureName ? new Date().toISOString() : job.diagnostics?.customerApprovalAt,
        serviceSummary: summary,
      },
      completionCertificateIssuedAt: signatureName ? new Date().toISOString() : job.completionCertificateIssuedAt,
    }, props.user);
    await refresh();
    toast({ title: "Completion details saved", tone: "success" });
  }

  async function buildInvoiceFromJob() {
    if (!job) return;
    const inv = await ensureInvoiceForJob(job.id);
    toast({ title: "Invoice ready", message: inv.id, tone: "success" });
  }

  async function submitNote() {
    if (!job || !noteText.trim()) return;
    await addJobNote({ jobId: job.id, authorId: props.user.id, text: noteText, visibility: noteVisibility });
    setNoteText("");
    await refresh();
  }

  async function submitMessage() {
    if (!job || !messageText.trim()) return;
    await addMessage(job.id, props.user.id, messageText);
    setMessageText("");
    await refresh();
  }

  async function submitAttachment() {
    if (!job || !attFile) return;
    let blob: Blob = attFile;
    let compressed = false;
    if (attKind === "photo") {
      blob = await compressImageFile(attFile);
      compressed = blob !== attFile;
    }
    await addAttachment({
      jobId: job.id,
      uploaderId: props.user.id,
      filename: attFile.name,
      mime: blob.type || attFile.type || "application/octet-stream",
      kind: attKind,
      blob,
      equipmentId: attEquipmentId || undefined,
      photoStage: attKind === "photo" ? attStage : undefined,
      annotation: attAnnotation.trim() || undefined,
      compressed,
    });
    setAttFile(null);
    setAttStage("before");
    setAttAnnotation("");
    setAttOpen(false);
    await refresh();
    toast({ title: "Attachment saved", message: compressed ? "Image compressed automatically" : undefined, tone: "success" });
  }

  async function addPart() {
    if (!job || !selectedPartId) return;
    try {
      await addPartUsedToJob(job.id, selectedPartId, Number(selectedQty) || 1, props.user);
      setAddPartOpen(false);
      setSelectedPartId("");
      setSelectedQty("1");
      await buildInvoiceFromJob();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add part");
    }
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-extrabold text-gray-900">Job not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-2xl font-extrabold text-gray-900">{job.title}</div>
            <Badge tone={toneForStatus(job.status)}>{job.status}</Badge>
            <Badge tone={job.priority === "emergency" ? "red" : job.priority === "high" ? "yellow" : "gray"}>{job.priority}</Badge>
            {job.routeStatus ? <Badge tone={job.routeStatus === "arrived" ? "green" : job.routeStatus === "en_route" ? "blue" : "gray"}>{job.routeStatus}</Badge> : null}
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-600">{job.serviceType} • {new Date(job.scheduledStart).toLocaleString()} • {job.bookingWindow ?? "flex"}</div>
          <div className="mt-1 text-sm font-semibold text-gray-600">{customer?.name ?? "Customer"} • {job.customerPhone}</div>
          <div className="mt-1 text-xs font-semibold text-gray-500 whitespace-pre-wrap">{job.description}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {job.customerAddress ? (
            <a href={googleMapsLink(job.customerAddress)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50">
              <MapPin size={16} />
              Directions
            </a>
          ) : null}
          <Button variant="secondary" onClick={() => window.open(`/app/jobs/${job.id}/report`, "_blank")}>Service report</Button>
          <Button variant="secondary" onClick={buildInvoiceFromJob}>Create invoice</Button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          {(canTechWork || props.user.role === "admin") ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-base font-extrabold text-gray-900">Field controls</div>
                  <div className="text-sm font-semibold text-gray-500">Route updates, technician job mode, timers, and completion.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => saveRouteStatus("en_route")}>On my way</Button>
                  <Button variant="secondary" onClick={() => saveRouteStatus("arrived")}>Arrived</Button>
                  <Button variant="secondary" onClick={() => saveStatus("in_progress")}>Start job</Button>
                  <Button onClick={() => saveStatus("completed")}>Complete</Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!openTimeEntry ? (
                  <Button variant="secondary" onClick={async () => { await startTime(job.id, props.user.id); await refresh(); }}>
                    <Play size={16} className="mr-2" />
                    Start timer
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={async () => { await stopTime(job.id, props.user.id); await refresh(); }}>
                    <Square size={16} className="mr-2" />
                    Stop timer
                  </Button>
                )}
                <Button variant="secondary" onClick={() => { setCompletionNotes(summary); }}>Generate smart summary</Button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Input label="Thermostat °F" type="number" value={String(job.diagnostics?.thermostatReadingF ?? "")} onChange={(v) => saveDiagnostics({ thermostatReadingF: v ? Number(v) : undefined })} />
                <Input label="Supply °F" type="number" value={String(job.diagnostics?.supplyTempF ?? "")} onChange={(v) => saveDiagnostics({ supplyTempF: v ? Number(v) : undefined, deltaTF: job.diagnostics?.returnTempF != null && v ? Number(v) - job.diagnostics.returnTempF : job.diagnostics?.deltaTF })} />
                <Input label="Return °F" type="number" value={String(job.diagnostics?.returnTempF ?? "")} onChange={(v) => saveDiagnostics({ returnTempF: v ? Number(v) : undefined, deltaTF: job.diagnostics?.supplyTempF != null && v ? job.diagnostics.supplyTempF - Number(v) : job.diagnostics?.deltaTF })} />
                <Input label="Superheat °F" type="number" value={String(job.diagnostics?.superheatF ?? "")} onChange={(v) => saveDiagnostics({ superheatF: v ? Number(v) : undefined })} />
                <Input label="Subcool °F" type="number" value={String(job.diagnostics?.subcoolF ?? "")} onChange={(v) => saveDiagnostics({ subcoolF: v ? Number(v) : undefined })} />
                <Input label="Static pressure" type="number" step={0.01} value={String(job.diagnostics?.staticPressureInWc ?? "")} onChange={(v) => saveDiagnostics({ staticPressureInWc: v ? Number(v) : undefined })} />
                <Input label="Suction PSI" type="number" value={String(job.diagnostics?.suctionPsi ?? "")} onChange={(v) => saveDiagnostics({ suctionPsi: v ? Number(v) : undefined })} />
                <Input label="Discharge PSI" type="number" value={String(job.diagnostics?.dischargePsi ?? "")} onChange={(v) => saveDiagnostics({ dischargePsi: v ? Number(v) : undefined })} />
                <Input label="Refrigerant added (oz)" type="number" value={String(job.diagnostics?.refrigerantAddedOz ?? "")} onChange={(v) => saveDiagnostics({ refrigerantAddedOz: v ? Number(v) : undefined })} />
                <div className="md:col-span-3">
                  <Input label="Refrigerant type / error code" value={`${job.diagnostics?.refrigerantType ?? ""}${job.diagnostics?.errorCode ? ` / ${job.diagnostics?.errorCode}` : ""}`} onChange={(v) => {
                    const [refrigerantType, errorCode] = v.split("/").map((x) => x.trim());
                    saveDiagnostics({ refrigerantType: refrigerantType || undefined, errorCode: errorCode || undefined });
                  }} />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm font-semibold text-gray-800">Completion notes / certificate</div>
                  <textarea
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                    rows={5}
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                  />
                </label>
                <div className="space-y-3">
                  <Input label="Customer signature (typed)" value={signatureName} onChange={setSignatureName} placeholder="Customer name" />
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs font-semibold text-gray-600">
                    This local-first version captures a typed signature and stores it with the service certificate. Use the report page to print/save as PDF.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveCompletion}>
                      <CheckCircle2 size={16} className="mr-2" />
                      Save certificate
                    </Button>
                    <a href={buildMailtoReport(job, customer, completionNotes || summary)} className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                      Email customer
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <ChecklistSection title="Pre-job checklist" items={job.preJobChecklist ?? []} onToggle={canEdit ? (id, done) => saveChecklist("preJobChecklist", id, done) : undefined} />
            <ChecklistSection title="Safety checklist" items={job.safetyChecklist ?? []} onToggle={canEdit ? (id, done) => saveChecklist("safetyChecklist", id, done) : undefined} />
            <ChecklistSection title="Main checklist" items={job.checklist ?? []} onToggle={canEdit ? (id, done) => saveChecklist("checklist", id, done) : undefined} />
            <ChecklistSection title="Post-job checklist" items={job.postJobChecklist ?? []} onToggle={canEdit ? (id, done) => saveChecklist("postJobChecklist", id, done) : undefined} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-extrabold text-gray-900">Photos, documents & equipment media</div>
              {canEdit ? <Button onClick={() => setAttOpen(true)}>Add attachment</Button> : null}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {([["Before", photoGroups.before], ["After", photoGroups.after], ["General", photoGroups.general]] as const).map(([label, list]) => (
                <div key={label} className="rounded-2xl border border-gray-100 p-3">
                  <div className="font-extrabold text-gray-900">{label}</div>
                  <div className="mt-3 space-y-2">
                    {list.length === 0 ? <div className="text-xs font-semibold text-gray-500">No {label.toLowerCase()} photos.</div> : list.map((att) => (
                      <div key={att.id} className="rounded-xl border border-gray-100 p-2">
                        <img src={previewUrl(att)} className="h-28 w-full rounded-xl object-cover" />
                        <div className="mt-2 text-xs font-semibold text-gray-600">{att.annotation ?? att.filename}</div>
                        {att.equipmentId ? <div className="text-[11px] font-semibold text-gray-500">Linked to equipment</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 p-3">
                <div className="font-extrabold text-gray-900">Other attachments</div>
                <div className="mt-3 space-y-2">
                  {attachments.filter((a) => a.kind !== "photo").map((att) => (
                    <a key={att.id} className="block rounded-xl border border-gray-100 p-2 text-sm font-semibold text-gray-700" download={att.filename} href={previewUrl(att)}>
                      {att.filename}
                    </a>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 p-3">
                <div className="font-extrabold text-gray-900">Equipment linked media</div>
                <div className="mt-3 space-y-2 text-sm font-semibold text-gray-700">
                  {equipment.map((eq) => (
                    <div key={eq.id} className="rounded-xl bg-gray-50 p-2">{eq.brand} {eq.model} ({attachments.filter((a) => a.equipmentId === eq.id).length} media)</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-base font-extrabold text-gray-900">Notes</div>
              <div className="mt-3 space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-gray-900">{n.visibility}</div>
                      <div className="text-[11px] font-semibold text-gray-500">{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-700 whitespace-pre-wrap">{n.text}</div>
                  </div>
                ))}
              </div>
              {canEdit ? (
                <div className="mt-3 space-y-2">
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold" value={noteVisibility} onChange={(e) => setNoteVisibility(e.target.value as any)}>
                    <option value="internal">internal</option>
                    <option value="shared">shared</option>
                  </select>
                  <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <Button onClick={submitNote}>Save note</Button>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-base font-extrabold text-gray-900">Chat with customer / office</div>
              <div className="mt-3 space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="text-[11px] font-semibold text-gray-500">{new Date(m.createdAt).toLocaleString()}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-700 whitespace-pre-wrap">{m.text}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <textarea className="min-h-[84px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300" value={messageText} onChange={(e) => setMessageText(e.target.value)} />
                <Button onClick={submitMessage}>
                  <Send size={16} className="mr-2" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-extrabold text-gray-900">Parts, timing & job economics</div>
              {canEdit ? <Button variant="secondary" onClick={() => setAddPartOpen(true)}>Add part</Button> : null}
            </div>
            <div className="mt-3 space-y-2">
              {job.partsUsed.length === 0 ? <div className="text-sm font-semibold text-gray-500">No parts used yet.</div> : job.partsUsed.map((part) => (
                <div key={part.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="font-extrabold text-gray-900">{part.name}</div>
                  <div className="text-xs font-semibold text-gray-600">Qty {part.qty} • Cost ${(part.qty * part.unitCost).toFixed(2)} • Revenue ${(part.qty * part.unitPrice).toFixed(2)}</div>
                </div>
              ))}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-xs font-semibold text-gray-600">
                Time entries: {timeEntries.length} • Open timer: {openTimeEntry ? "yes" : "no"} • Estimated parts margin ${job.partsUsed.reduce((s, p) => s + p.qty * (p.unitPrice - p.unitCost), 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Service summary generator</div>
            <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-gray-100 bg-gray-50 p-3 text-xs font-semibold text-gray-700">{summary}</pre>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Activity timeline</div>
            <div className="mt-3 space-y-2">
              {audit.length === 0 ? <div className="text-sm font-semibold text-gray-500">No activity yet.</div> : audit.map((a) => (
                <div key={a.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-gray-900">{a.title}</div>
                    <div className="text-[11px] font-semibold text-gray-500">{new Date(a.at).toLocaleString()}</div>
                  </div>
                  {a.details ? <div className="mt-1 text-xs font-semibold text-gray-600">{a.details}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="Attach photo / document"
        open={attOpen}
        onClose={() => setAttOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAttOpen(false)}>Cancel</Button>
            <Button onClick={submitAttachment} disabled={!attFile}>Save</Button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Kind</div>
            <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold" value={attKind} onChange={(e) => setAttKind(e.target.value as any)}>
              <option value="photo">photo</option>
              <option value="document">document</option>
              <option value="voice">voice</option>
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Link to equipment</div>
            <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold" value={attEquipmentId} onChange={(e) => setAttEquipmentId(e.target.value)}>
              <option value="">None</option>
              {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.brand} {eq.model}</option>)}
            </select>
          </label>
          {attKind === "photo" ? (
            <label className="block">
              <div className="mb-1 text-sm font-semibold text-gray-800">Photo stage</div>
              <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold" value={attStage} onChange={(e) => setAttStage(e.target.value as any)}>
                <option value="before">before</option>
                <option value="after">after</option>
                <option value="general">general</option>
              </select>
            </label>
          ) : <div />}
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Attachment</div>
            <input type="file" capture={attKind === "photo" ? "environment" : undefined} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" onChange={(e) => setAttFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="block md:col-span-2">
            <div className="mb-1 text-sm font-semibold text-gray-800">Annotation / caption</div>
            <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300" rows={3} value={attAnnotation} onChange={(e) => setAttAnnotation(e.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal
        title="Add part used"
        open={addPartOpen}
        onClose={() => setAddPartOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddPartOpen(false)}>Cancel</Button>
            <Button onClick={addPart}>Add part</Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Part</div>
            <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold" value={selectedPartId} onChange={(e) => setSelectedPartId(e.target.value)}>
              <option value="">Choose a part</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} • stock {p.stockQty}</option>
              ))}
            </select>
          </label>
          <Input label="Qty" type="number" value={selectedQty} onChange={setSelectedQty} />
        </div>
      </Modal>
    </div>
  );
}
