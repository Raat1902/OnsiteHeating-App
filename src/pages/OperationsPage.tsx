import React, { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Building2, Camera, CarFront, HelpCircle, Clock3, Gauge, LocateFixed, MapPinned, MessageSquareMore, Send, ShieldCheck, Sparkles, Star, Wrench } from "lucide-react";
import type { Branch, Job, User } from "../types";
import { db } from "../db";
import { BrandLogo } from "../components/BrandLogo";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ToastProvider";
import { addAttachment, autoAssignJob, createQuote, listJobsForUser, listTechnicians, updateJob } from "../lib/data";
import { aiDiagnosticInsights, buildAiServiceReport, predictiveFailure, replacementPackages } from "../lib/ai";
import { buildFleetRows, customerTrackingSummary, nearestFleetRows } from "../lib/live";
import { listBranches, listCampaigns, listCustomerReviews, listIntegrationSettings, listLoyaltyEvents, listReviewsForCustomer, listReviewsForTechnician, listTrainingResources, loyaltyBalance, loyaltyLeaderboard, addCustomerReview, awardLoyaltyPoints, setIntegrationEnabled, upsertCampaign, upsertBranch } from "../lib/enterprise";
import { newId } from "../lib/id";
import { averageTechRating } from "../lib/enterprise";

type TabKey = "live" | "ai" | "growth" | "admin" | "tech";

function TabButton(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={props.onClick}
      className={`rounded-xl px-3 py-2 text-sm font-extrabold transition ${props.active ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
    >
      {props.label}
    </button>
  );
}

function Card(props: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-gray-200 bg-white p-4 shadow-sm ${props.className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-base font-extrabold text-gray-900">{props.title}</div>
        {props.icon}
      </div>
      <div className="mt-3">{props.children}</div>
    </div>
  );
}

function FleetMiniMap(props: { rows: ReturnType<typeof buildFleetRows> }) {
  return (
    <div className="relative h-72 overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-slate-50 via-orange-50 to-blue-50">
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:22px_22px]" />
      {props.rows.map((row) => (
        <div
          key={row.tech.id}
          className="absolute"
          style={{ left: `${row.point.x}%`, top: `${row.point.y}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className={`rounded-full border-4 ${row.status === "on_site" ? "border-green-500 bg-green-100" : row.status === "driving" ? "border-orange-500 bg-orange-100" : "border-slate-400 bg-slate-100"} px-3 py-2 text-xs font-extrabold text-gray-900 shadow-lg`}>
            {row.tech.name.split(" ")[0]}
          </div>
          <div className="mt-2 -translate-x-1/2 rounded-xl bg-white/95 px-2 py-1 text-[11px] font-semibold text-gray-700 shadow">
            {row.currentJob ? `${row.currentJob.title} • ETA ${row.etaMinutes}m` : "Idle"}
          </div>
        </div>
      ))}
      <div className="absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-gray-700 shadow">
        Simulated local map board • live fleet positions update from dispatch state
      </div>
    </div>
  );
}

export function OperationsPage(props: { user: User }) {
  const { toast } = useToast();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [techs, setTechs] = useState<Array<{ user: User; profile: any }>>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [training, setTraining] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedEmergencyId, setSelectedEmergencyId] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabKey>("live");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: "5", comment: "" });
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [branchForm, setBranchForm] = useState({ name: "", address: "", region: "", phone: "" });
  const [issueFiles, setIssueFiles] = useState<FileList | null>(null);

  async function refresh() {
    const myJobs = await listJobsForUser(props.user);
    setJobs(myJobs);

    const [fleetTechs, branchRows, locRows, trainingRows, reviewRows, loyaltyRows, campaignRows, integrationRows, customerRows] = await Promise.all([
      listTechnicians(),
      listBranches(),
      db.technicianLocations.toArray(),
      listTrainingResources(),
      listCustomerReviews(),
      listLoyaltyEvents(),
      listCampaigns(),
      listIntegrationSettings(),
      db.users.where("role").equals("customer").toArray(),
    ]);

    setTechs(fleetTechs);
    setBranches(branchRows);
    setLocations(locRows);
    setTraining(trainingRows);
    setReviews(reviewRows);
    setLoyalty(loyaltyRows);
    setCampaigns(campaignRows);
    setIntegrations(integrationRows);
    setCustomers(customerRows);

    const eq = props.user.role === "customer"
      ? await db.equipment.where("customerId").equals(props.user.id).toArray()
      : await db.equipment.toArray();
    setEquipment(eq);

    const att = props.user.role === "customer"
      ? (await db.attachments.toArray()).filter((a) => myJobs.some((j) => j.id === a.jobId))
      : await db.attachments.toArray();
    setAttachments(att);

    const emergency = (props.user.role === "admin" ? await db.jobs.toArray() : myJobs)
      .filter((job) => job.priority === "emergency" && job.status !== "completed" && job.status !== "cancelled")
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

    if (!selectedEmergencyId && emergency[0]) setSelectedEmergencyId(emergency[0].id);
    if (!selectedJobId && myJobs[0]) setSelectedJobId(myJobs[0].id);

    if (props.user.role === "technician") setActiveTab((prev) => prev === "admin" || prev === "growth" ? "tech" : prev);
    if (props.user.role === "customer") setActiveTab((prev) => prev === "admin" || prev === "tech" ? "growth" : prev);
  }

  useEffect(() => { refresh(); }, [props.user.id]);

  const allJobs = useMemo(() => {
    if (props.user.role === "admin") return jobs;
    return jobs;
  }, [jobs, props.user.role]);

  const fleetRows = useMemo(() => buildFleetRows(techs as any, props.user.role === "admin" ? jobs : allJobs, branches, locations), [techs, jobs, allJobs, branches, locations]);
  const emergencyJobs = useMemo(() => (props.user.role === "admin" ? jobs : allJobs).filter((job) => job.priority === "emergency" && job.status !== "completed" && job.status !== "cancelled"), [jobs, allJobs, props.user.role]);
  const selectedEmergency = useMemo(() => emergencyJobs.find((job) => job.id === selectedEmergencyId) ?? emergencyJobs[0] ?? null, [emergencyJobs, selectedEmergencyId]);
  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null, [jobs, selectedJobId]);
  const selectedEquipment = useMemo(() => equipment.find((eq) => eq.id === selectedJob?.equipmentId) ?? equipment[0] ?? null, [equipment, selectedJob?.equipmentId]);
  const tracking = useMemo(() => customerTrackingSummary(jobs.find((job) => job.customerId === props.user.id && !!job.technicianId && job.status !== "completed"), fleetRows), [jobs, props.user.id, fleetRows]);

  const avgEta = useMemo(() => {
    const rows = fleetRows.filter((row) => row.currentJob);
    if (!rows.length) return 0;
    return Math.round(rows.reduce((sum, row) => sum + row.etaMinutes, 0) / rows.length);
  }, [fleetRows]);

  const avgReview = useMemo(() => {
    if (!reviews.length) return 0;
    return (reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  const loyaltyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of loyalty) map[row.customerId] = (map[row.customerId] ?? 0) + row.points;
    return map;
  }, [loyalty]);

  async function triggerEmergencyAutoAssign(job: Job) {
    await autoAssignJob(job.id, props.user);
    toast({ title: "Emergency dispatched", message: "Best available technician assigned from dispatch suggestions.", tone: "success" });
    await refresh();
  }

  async function setRouteStatus(job: Job, routeStatus: Job["routeStatus"], status?: Job["status"]) {
    await updateJob(job.id, { routeStatus, status: status ?? job.status, arrivalDetectedAt: routeStatus === "arrived" ? new Date().toISOString() : job.arrivalDetectedAt, autoStartedAt: routeStatus === "arrived" ? new Date().toISOString() : job.autoStartedAt }, props.user);
    toast({ title: "Job updated", message: `Route status changed to ${routeStatus}.`, tone: "success" });
    await refresh();
  }

  async function uploadIssuePhotos() {
    if (!selectedJob || !issueFiles?.length) return;
    for (const file of Array.from(issueFiles)) {
      await addAttachment({
        jobId: selectedJob.id,
        uploaderId: props.user.id,
        filename: file.name,
        mime: file.type || "application/octet-stream",
        kind: "photo",
        blob: file,
        equipmentId: selectedJob.equipmentId,
        photoStage: "before",
        annotation: "Customer-uploaded issue photo",
        compressed: false,
      });
    }
    setIssueFiles(null);
    toast({ title: "Photos uploaded", message: "Issue photos are now attached to the job/equipment record.", tone: "success" });
    await refresh();
  }

  async function requestQuoteFromEquipment() {
    if (!selectedEquipment || props.user.role !== "customer") return;
    const options = replacementPackages(selectedEquipment);
    await createQuote({
      customerId: props.user.id,
      title: `${selectedEquipment.brand} ${selectedEquipment.model} replacement options`,
      options: options.map((option) => ({
        tier: option.tier,
        title: option.title,
        description: option.description,
        price: option.price,
        equipmentSpecs: `${option.equipmentSpecs}\nEnergy savings: $${option.energySavingsAnnual ?? 0}/yr\nRebate: $${option.rebateAmount ?? 0}\nFinancing: $${option.financingMonthly ?? 0}/mo`,
      })),
    });
    toast({ title: "Quote requested", message: "A Good / Better / Best quote draft was created from lifecycle overview.", tone: "success" });
  }

  async function submitReview() {
    const completed = jobs.find((job) => job.status === "completed" || job.status === "in_progress");
    if (!completed) return;
    await addCustomerReview({
      jobId: completed.id,
      customerId: props.user.id,
      technicianId: completed.technicianId,
      rating: Math.max(1, Math.min(5, Number(reviewForm.rating) || 5)),
      comment: reviewForm.comment.trim() || "Great service.",
    });
    await awardLoyaltyPoints(props.user.id, 25, "Post-service review");
    setReviewOpen(false);
    setReviewForm({ rating: "5", comment: "" });
    toast({ title: "Review submitted", message: "Thanks — loyalty points were added to the customer account.", tone: "success" });
    await refresh();
  }

  async function createCampaign() {
    if (!campaignTitle.trim() || !campaignMessage.trim()) return;
    await upsertCampaign({
      id: newId("camp"),
      title: campaignTitle.trim(),
      segment: "targeted list",
      channel: "email",
      status: "draft",
      message: campaignMessage.trim(),
      createdAt: new Date().toISOString(),
    });
    setCampaignTitle("");
    setCampaignMessage("");
    toast({ title: "Campaign created", message: "Marketing automation draft saved.", tone: "success" });
    await refresh();
  }

  async function saveBranch() {
    if (!branchForm.name.trim()) return;
    await upsertBranch({
      id: newId("branch"),
      name: branchForm.name.trim(),
      address: branchForm.address.trim() || "Address pending",
      region: branchForm.region.trim() || "Region pending",
      phone: branchForm.phone.trim() || "(555) 000-0000",
    });
    setBranchForm({ name: "", address: "", region: "", phone: "" });
    toast({ title: "Branch added", message: "Multi-location support updated.", tone: "success" });
    await refresh();
  }

  async function toggleIntegration(key: string, enabled: boolean) {
    await setIntegrationEnabled(key, enabled);
    await refresh();
  }

  const adminSuggestions = useMemo(() => selectedEmergency ? nearestFleetRows(selectedEmergency, fleetRows) : [], [selectedEmergency, fleetRows]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="rounded-[32px] border border-gray-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <BrandLogo />
            <div className="mt-4 max-w-3xl text-sm font-semibold text-slate-200">
              Enterprise-style field operations, Diagnostics, live technician tracking, customer experience automation, multi-location control, and technician-first tools — all running local-first inside the app.
            </div>
          </div>
          <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-200">Live fleet</div>
              <div className="mt-2 text-3xl font-extrabold">{fleetRows.length}</div>
              <div className="text-xs font-semibold text-slate-200">Technicians visible on the board</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-200">Average ETA</div>
              <div className="mt-2 text-3xl font-extrabold">{avgEta}m</div>
              <div className="text-xs font-semibold text-slate-200">Customer-facing arrival estimate</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-200">Emergency jobs</div>
              <div className="mt-2 text-3xl font-extrabold">{emergencyJobs.length}</div>
              <div className="text-xs font-semibold text-slate-200">Priority escalation queue</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-200">Customer rating</div>
              <div className="mt-2 text-3xl font-extrabold">{avgReview || "—"}</div>
              <div className="text-xs font-semibold text-slate-200">Reputation tracking</div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <TabButton active={activeTab === "live"} onClick={() => setActiveTab("live")} label="Live Ops" />
          <TabButton active={activeTab === "ai"} onClick={() => setActiveTab("ai")} label="Insights & Lifecycle" />
          <TabButton active={activeTab === "growth"} onClick={() => setActiveTab("growth")} label="Customer Experience" />
          {props.user.role === "admin" ? <TabButton active={activeTab === "admin"} onClick={() => setActiveTab("admin")} label="Admin Tools" /> : null}
          {props.user.role === "technician" ? <TabButton active={activeTab === "tech"} onClick={() => setActiveTab("tech")} label="Tech Toolkit" /> : null}
        </div>
      </div>

      {activeTab === "live" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
          <Card title="Live map dispatch board" icon={<MapPinned className="text-orange-500" />}>
            <FleetMiniMap rows={fleetRows} />
          </Card>

          <div className="space-y-4">
            <Card title="Fleet tracker" icon={<LocateFixed className="text-blue-500" />}>
              <div className="space-y-3">
                {fleetRows.map((row) => (
                  <div key={row.tech.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-gray-900">{row.tech.name}</div>
                        <div className="text-xs font-semibold text-gray-500">
                          {row.vehicleLabel} • {row.branch?.name ?? "Unassigned branch"} • rating {row.rating || "—"}
                        </div>
                      </div>
                      <Badge tone={row.status === "on_site" ? "green" : row.status === "driving" ? "yellow" : "gray"}>
                        {row.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-gray-700">
                      {row.currentJob ? `${row.currentJob.title} • ETA ${row.etaMinutes} min • ${row.distanceToCurrentKm.toFixed(1)} km` : "No active route"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
                      {row.profile.specialties.slice(0, 4).map((spec: string) => <span key={spec} className="rounded-xl bg-gray-50 px-2 py-1">{spec}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Emergency dispatch queue" icon={<CarFront className="text-red-500" />}>
              {emergencyJobs.length === 0 ? (
                <div className="text-sm font-semibold text-gray-500">No emergency jobs right now.</div>
              ) : (
                <div className="space-y-4">
                  <select
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
                    value={selectedEmergency?.id ?? ""}
                    onChange={(e) => setSelectedEmergencyId(e.target.value)}
                  >
                    {emergencyJobs.map((job) => (
                      <option key={job.id} value={job.id}>{job.title} • {job.customerAddress}</option>
                    ))}
                  </select>

                  {selectedEmergency ? (
                    <>
                      <div className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                        Emergency mode is active. It scores technicians by proximity, specialty, workload, and current route fit.
                      </div>
                      <div className="space-y-2">
                        {adminSuggestions.slice(0, 3).map((row) => (
                          <div key={row.tech.id} className="rounded-2xl border border-gray-100 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-extrabold text-gray-900">{row.tech.name}</div>
                              <Badge tone={row.status === "driving" ? "yellow" : row.status === "on_site" ? "green" : "gray"}>{row.status}</Badge>
                            </div>
                            <div className="mt-1 text-xs font-semibold text-gray-600">
                              {row.distanceToCurrentKm.toFixed(1)} km • ETA {row.etaMinutes}m • {row.nextJobs.length} open stop(s)
                            </div>
                            <div className="mt-2 text-xs font-semibold text-gray-500">
                              Match: {row.profile.specialties.join(", ")}
                            </div>
                          </div>
                        ))}
                      </div>
                      {props.user.role === "admin" ? <Button onClick={() => triggerEmergencyAutoAssign(selectedEmergency)}>Dispatch best technician now</Button> : null}
                    </>
                  ) : null}
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "ai" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <Card title="Diagnostics panel" icon={<BrainCircuit className="text-purple-500" />}>
            <div className="mb-3 flex flex-wrap gap-2">
              <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold" value={selectedJob?.id ?? ""} onChange={(e) => setSelectedJobId(e.target.value)}>
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
            </div>

            {selectedJob ? (
              <div className="space-y-3">
                {aiDiagnosticInsights(selectedJob).map((insight) => (
                  <div key={insight.title} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-gray-900">{insight.title}</div>
                      <Badge tone={insight.confidence > 0.8 ? "green" : insight.confidence > 0.65 ? "yellow" : "gray"}>
                        {Math.round(insight.confidence * 100)}%
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-gray-700">{insight.details}</div>
                  </div>
                ))}
                <div className="rounded-2xl bg-gray-50 p-4 text-sm font-semibold text-gray-700">
                  Service report preview:
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-600">{buildAiServiceReport(selectedJob, customers.find((c) => c.id === selectedJob.customerId), techs.find((t) => t.user.id === selectedJob.technicianId)?.user, attachments.filter((a) => a.jobId === selectedJob.id))}</pre>
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-gray-500">No jobs available.</div>
            )}
          </Card>

          <div className="space-y-4">
            <Card title="Equipment lifecycle overview" icon={<Gauge className="text-orange-500" />}>
              {selectedEquipment ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-gray-100 p-3">
                    <div className="font-extrabold text-gray-900">{selectedEquipment.brand} {selectedEquipment.model}</div>
                    <div className="text-xs font-semibold text-gray-500">{selectedEquipment.type.replace("_", " ")} • SEER {selectedEquipment.seerRating ?? "—"} • replacement estimate ${selectedEquipment.replacementEstimate ?? 0}</div>
                  </div>
                  {(() => {
                    const serviceVisits = jobs.filter((job) => job.equipmentId === selectedEquipment.id).length;
                    const risk = predictiveFailure(selectedEquipment, serviceVisits);
                    return (
                      <div className="rounded-2xl bg-gray-50 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold text-gray-900">Predictive failure risk</div>
                          <Badge tone={risk.level === "high" ? "red" : risk.level === "medium" ? "yellow" : "green"}>{risk.risk}/99</Badge>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-gray-700">{risk.recommendation}</div>
                        <ul className="mt-3 space-y-1 text-xs font-semibold text-gray-600">
                          {risk.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                        </ul>
                      </div>
                    );
                  })()}
                  <div className="space-y-2">
                    {replacementPackages(selectedEquipment).map((option) => (
                      <div key={option.id} className="rounded-2xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold text-gray-900">{option.title}</div>
                          <Badge tone={option.tier === "best" ? "green" : option.tier === "better" ? "blue" : "gray"}>{option.tier}</Badge>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-gray-700">${option.price.toLocaleString()} • save ${option.energySavingsAnnual}/yr • financing ${option.financingMonthly}/mo</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className="text-sm font-semibold text-gray-500">No equipment found.</div>}
            </Card>

            <Card title="Safety & compliance" icon={<ShieldCheck className="text-green-600" />}>
              {selectedJob ? (
                <div className="space-y-2 text-sm font-semibold text-gray-700">
                  <div className="rounded-2xl bg-gray-50 p-3">CO reading: {selectedJob.diagnostics?.coReadingPpm ?? "—"} ppm</div>
                  <div className="rounded-2xl bg-gray-50 p-3">Combustion efficiency: {selectedJob.diagnostics?.combustionEfficiencyPct ?? "—"}%</div>
                  <div className="rounded-2xl bg-gray-50 p-3">Safety checklist completion: {(selectedJob.safetyChecklist ?? []).filter((item) => item.done).length}/{(selectedJob.safetyChecklist ?? []).length}</div>
                </div>
              ) : <div className="text-sm font-semibold text-gray-500">Pick a job to see compliance data.</div>}
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "growth" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr,1fr]">
          <Card title={props.user.role === "customer" ? "Customer portal upgrades" : "Customer experience & loyalty"} icon={<Sparkles className="text-orange-500" />}>
            {props.user.role === "customer" ? (
              <div className="space-y-4">
                {tracking ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-green-900">Technician on the way</div>
                      <Badge tone={tracking.status === "on_site" ? "green" : tracking.status === "driving" ? "yellow" : "gray"}>
                        {tracking.status}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-green-900">
                      {tracking.technicianName} • {tracking.vehicleLabel} • ETA {tracking.etaMinutes} min • rating {tracking.rating || "—"}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-green-800">Branch: {tracking.branchName ?? "Main office"}</div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
                    No active technician tracking at the moment. Booking confirmations, on-the-way alerts, arrival, completion, invoice ready, and payment reminders all appear here when jobs are active.
                  </div>
                )}

                <div>
                  <div className="text-sm font-extrabold text-gray-900">Upload issue photos</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold" value={selectedJob?.id ?? ""} onChange={(e) => setSelectedJobId(e.target.value)}>
                      {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                    </select>
                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50">
                      <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => setIssueFiles(e.target.files)} />
                      Choose photos
                    </label>
                    <Button onClick={uploadIssuePhotos} disabled={!issueFiles?.length}>Attach to equipment record</Button>
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="font-extrabold text-gray-900">Loyalty & referral points</div>
                  <div className="mt-2 text-3xl font-extrabold text-gray-900">{loyaltyMap[props.user.id] ?? 0}</div>
                  <div className="text-xs font-semibold text-gray-500">Earn points for maintenance plans, referrals, and repeat service.</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={requestQuoteFromEquipment}>Request replacement quote</Button>
                  <Button variant="secondary" onClick={() => setReviewOpen(true)}>Leave review</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="font-extrabold text-gray-900">Average rating</div>
                  <div className="mt-2 text-3xl font-extrabold text-gray-900">{avgReview || "—"}</div>
                  <div className="text-xs font-semibold text-gray-500">Live from post-job reviews and reputation tracking.</div>
                </div>
                <div className="space-y-2">
                  {reviews.slice(0, 4).map((review) => (
                    <div key={review.id} className="rounded-2xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-extrabold text-gray-900">{customers.find((c) => c.id === review.customerId)?.name ?? review.customerId}</div>
                        <Badge tone={review.rating >= 5 ? "green" : review.rating >= 4 ? "blue" : "yellow"}>{review.rating}/5</Badge>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-700">{review.comment}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title={props.user.role === "admin" ? "Marketing automation" : "Notifications & service timeline"} icon={<MessageSquareMore className="text-blue-500" />}>
            {props.user.role === "admin" ? (
              <div className="space-y-4">
                <div className="grid gap-3">
                  <Input label="Campaign title" value={campaignTitle} onChange={setCampaignTitle} />
                  <label className="block">
                    <div className="mb-1 text-sm font-semibold text-gray-800">Message</div>
                    <textarea className="min-h-[96px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-gray-300" value={campaignMessage} onChange={(e) => setCampaignMessage(e.target.value)} />
                  </label>
                  <div className="flex justify-end">
                    <Button onClick={createCampaign}>Save campaign draft</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="rounded-2xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-extrabold text-gray-900">{campaign.title}</div>
                        <Badge tone={campaign.status === "sent" ? "green" : campaign.status === "scheduled" ? "blue" : "gray"}>{campaign.status}</Badge>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-700">{campaign.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : props.user.role === "customer" ? (
              <div className="space-y-3">
                {(jobs.filter((job) => job.customerId === props.user.id).slice(0, 5)).map((job) => (
                  <div key={job.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="font-extrabold text-gray-900">{job.title}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-700">
                      {job.routeStatus === "en_route" ? "Technician on the way" : job.routeStatus === "arrived" ? "Technician arrived" : job.status === "completed" ? "Service completed" : "Appointment confirmed"}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-gray-500">{new Date(job.scheduledStart).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(reviews.filter((review) => review.technicianId === props.user.id)).slice(0, 4).map((review) => (
                  <div key={review.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-gray-900">Customer review</div>
                      <Badge tone={review.rating >= 5 ? "green" : "blue"}>{review.rating}/5</Badge>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-700">{review.comment}</div>
                  </div>
                ))}
                {reviews.filter((review) => review.technicianId === props.user.id).length === 0 ? <div className="text-sm font-semibold text-gray-500">No reviews yet for this technician.</div> : null}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === "admin" && props.user.role === "admin" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr,1fr]">
          <Card title="Multi-location support" icon={<Building2 className="text-slate-700" />}>
            <div className="space-y-3">
              {branches.map((branch) => (
                <div key={branch.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="font-extrabold text-gray-900">{branch.name}</div>
                  <div className="text-sm font-semibold text-gray-700">{branch.region} • {branch.address}</div>
                  <div className="text-xs font-semibold text-gray-500">{branch.phone}</div>
                </div>
              ))}
              <div className="grid gap-3 rounded-2xl bg-gray-50 p-4">
                <Input label="Branch name" value={branchForm.name} onChange={(v) => setBranchForm((s) => ({ ...s, name: v }))} />
                <Input label="Address" value={branchForm.address} onChange={(v) => setBranchForm((s) => ({ ...s, address: v }))} />
                <Input label="Region" value={branchForm.region} onChange={(v) => setBranchForm((s) => ({ ...s, region: v }))} />
                <Input label="Phone" value={branchForm.phone} onChange={(v) => setBranchForm((s) => ({ ...s, phone: v }))} />
                <div className="flex justify-end"><Button onClick={saveBranch}>Add branch</Button></div>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Integration ecosystem" icon={<Send className="text-green-600" />}>
              <div className="space-y-2">
                {integrations.map((integration) => (
                  <label key={integration.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-3">
                    <div>
                      <div className="font-extrabold text-gray-900">{integration.label}</div>
                      <div className="text-xs font-semibold text-gray-500">{integration.notes ?? "Configurable integration"}</div>
                    </div>
                    <input type="checkbox" checked={integration.enabled} onChange={(e) => toggleIntegration(integration.key, e.target.checked)} />
                  </label>
                ))}
              </div>
            </Card>

            <Card title="Loyalty leaderboard" icon={<Star className="text-yellow-500" />}>
              <LoyaltyLeaderboard />
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "tech" && props.user.role === "technician" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr,1fr]">
          <Card title="Technician job mode" icon={<Wrench className="text-orange-600" />}>
            <div className="space-y-3">
              {jobs.filter((job) => job.technicianId === props.user.id && job.status !== "completed" && job.status !== "cancelled").map((job) => (
                <div key={job.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-gray-900">{job.title}</div>
                      <div className="text-xs font-semibold text-gray-500">{job.customerAddress}</div>
                    </div>
                    <Badge tone={job.routeStatus === "arrived" ? "green" : job.routeStatus === "en_route" ? "yellow" : "gray"}>
                      {job.routeStatus ?? "scheduled"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setRouteStatus(job, "en_route", "assigned")}>Start navigation</Button>
                    <Button onClick={() => setRouteStatus(job, "arrived", "in_progress")}>Auto check-in</Button>
                    <Button variant="ghost" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customerAddress ?? "")}`, "_blank")}>Open maps</Button>
                  </div>
                  <div className="mt-3 text-xs font-semibold text-gray-500">Arrival automation notifies the customer and records GPS-based job start in the audit timeline.</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Training, manuals, and troubleshooting" icon={<HelpCircle className="text-blue-500" />}>
              <div className="space-y-2">
                {training.map((resource) => (
                  <div key={resource.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-extrabold text-gray-900">{resource.title}</div>
                      <Badge tone={resource.kind === "video" ? "blue" : resource.kind === "manual" ? "purple" : "gray"}>{resource.kind}</Badge>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-700">{resource.description}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Performance snapshot" icon={<Clock3 className="text-slate-700" />}>
              <TechnicianPerformance user={props.user} jobs={jobs} />
            </Card>
          </div>
        </div>
      ) : null}

      <Modal
        title="Leave a review"
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setReviewOpen(false)}>Cancel</Button><Button onClick={submitReview}>Submit review</Button></div>}
      >
        <div className="grid gap-3">
          <Input label="Rating (1-5)" type="number" value={reviewForm.rating} onChange={(v) => setReviewForm((s) => ({ ...s, rating: v }))} />
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-gray-800">Comment</div>
            <textarea className="min-h-[120px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-gray-300" value={reviewForm.comment} onChange={(e) => setReviewForm((s) => ({ ...s, comment: e.target.value }))} />
          </label>
        </div>
      </Modal>
    </div>
  );
}

function LoyaltyLeaderboard() {
  const [rows, setRows] = useState<Array<{ user: User; points: number }>>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await loyaltyLeaderboard();
      if (alive) setRows(list);
    })();
    return () => { alive = false; };
  }, []);
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.user.id} className="flex items-center justify-between rounded-2xl border border-gray-100 p-3">
          <div className="font-extrabold text-gray-900">{index + 1}. {row.user.name}</div>
          <Badge tone={index === 0 ? "green" : index === 1 ? "blue" : "gray"}>{row.points} pts</Badge>
        </div>
      ))}
      {rows.length === 0 ? <div className="text-sm font-semibold text-gray-500">No loyalty data yet.</div> : null}
    </div>
  );
}

function TechnicianPerformance(props: { user: User; jobs: Job[] }) {
  const completed = props.jobs.filter((job) => job.technicianId === props.user.id && job.status === "completed").length;
  const active = props.jobs.filter((job) => job.technicianId === props.user.id && job.status !== "completed" && job.status !== "cancelled").length;
  const avgDuration = props.jobs.filter((job) => job.technicianId === props.user.id).reduce((sum, job, _, arr) => sum + job.durationMinutes / Math.max(1, arr.length), 0);
  const upsells = props.jobs.filter((job) => job.technicianId === props.user.id && job.requestedQuote).length;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-gray-50 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Completed jobs</div>
        <div className="mt-2 text-3xl font-extrabold text-gray-900">{completed}</div>
      </div>
      <div className="rounded-2xl bg-gray-50 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Active jobs</div>
        <div className="mt-2 text-3xl font-extrabold text-gray-900">{active}</div>
      </div>
      <div className="rounded-2xl bg-gray-50 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Avg duration</div>
        <div className="mt-2 text-3xl font-extrabold text-gray-900">{Math.round(avgDuration || 0)}m</div>
      </div>
      <div className="rounded-2xl bg-gray-50 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Quote upsells</div>
        <div className="mt-2 text-3xl font-extrabold text-gray-900">{upsells}</div>
      </div>
    </div>
  );
}
