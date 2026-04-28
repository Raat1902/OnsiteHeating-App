import React, { useEffect, useMemo, useState } from "react";
import type { Job, User } from "../types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { assignJob, autoAssignJob, listJobsForUser, listTechnicians, moveJobSchedule } from "../lib/data";
import { buildDailyRoute, buildTechnicianSuggestions, pointForAddress, shiftJobToDate } from "../lib/scheduling";

function toneForPriority(priority: Job["priority"]) {
  if (priority === "emergency") return "red";
  if (priority === "high") return "yellow";
  return "gray";
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function sameDay(aIso: string, bIso: string) {
  return aIso.slice(0, 10) === bIso.slice(0, 10);
}

export function DispatchPage(props: { user: User }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [techs, setTechs] = useState<Array<{ user: User; profile: any }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(startOfDay(new Date()).toISOString().slice(0, 10));
  const [inspectJobId, setInspectJobId] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const [j, t] = await Promise.all([listJobsForUser(props.user), listTechnicians()]);
    setJobs(j);
    setTechs(t);
    if (!inspectJobId && j.find((x) => !x.technicianId)) setInspectJobId(j.find((x) => !x.technicianId)!.id);
  }

  useEffect(() => {
    refresh();
  }, []);

  const unassigned = useMemo(
    () => jobs.filter((j) => !j.technicianId && j.status !== "cancelled" && j.status !== "completed").sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)),
    [jobs]
  );

  const inspectJob = useMemo(() => jobs.find((j) => j.id === inspectJobId) ?? null, [jobs, inspectJobId]);
  const suggestions = useMemo(() => (inspectJob ? buildTechnicianSuggestions(inspectJob, techs as any, jobs) : []), [inspectJob, techs, jobs]);

  const dayOptions = useMemo(() => {
    const start = startOfDay(new Date(selectedDay));
    return [0, 1, 2].map((offset) => {
      const d = new Date(start);
      d.setDate(d.getDate() + offset);
      return d;
    });
  }, [selectedDay]);

  function onDragStart(ev: React.DragEvent, jobId: string) {
    ev.dataTransfer.setData("text/jobId", jobId);
    ev.dataTransfer.effectAllowed = "move";
  }

  function allowDrop(ev: React.DragEvent) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  }

  async function dropOnTechDay(ev: React.DragEvent, techId: string, dayIso: string) {
    ev.preventDefault();
    const jobId = ev.dataTransfer.getData("text/jobId");
    if (!jobId) return;
    try {
      const current = jobs.find((j) => j.id === jobId);
      if (!current) return;
      const shifted = shiftJobToDate(current, `${dayIso}T${current.scheduledStart.slice(11, 16)}`);
      await moveJobSchedule(jobId, shifted.scheduledStart, props.user);
      await assignJob(jobId, techId, props.user);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    }
  }

  async function dropOnDayBucket(ev: React.DragEvent, dayIso: string) {
    ev.preventDefault();
    const jobId = ev.dataTransfer.getData("text/jobId");
    if (!jobId) return;
    const current = jobs.find((j) => j.id === jobId);
    if (!current) return;
    try {
      const shifted = shiftJobToDate(current, `${dayIso}T${current.scheduledStart.slice(11, 16)}`);
      await moveJobSchedule(jobId, shifted.scheduledStart, props.user);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed");
    }
  }

  async function runAutoAssign(jobId: string) {
    try {
      await autoAssignJob(jobId, props.user);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-assign failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-gray-900">Smart Dispatch & Routing</div>
          <div className="text-sm font-semibold text-gray-500">
            Route-aware dispatch, smart technician suggestions, overlap conflict detection, workload balancing, and drag between days.
          </div>
        </div>

        <label className="block">
          <div className="mb-1 text-sm font-semibold text-gray-800">Dispatch starting day</div>
          <input
            type="date"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          />
        </label>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-extrabold text-gray-900">Unassigned jobs</div>
              <Badge tone="blue">{unassigned.length}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {unassigned.length === 0 ? <div className="text-sm font-semibold text-gray-500">No unassigned jobs.</div> : null}
              {unassigned.map((j) => (
                <div
                  key={j.id}
                  draggable
                  onDragStart={(ev) => onDragStart(ev, j.id)}
                  className={`rounded-2xl border p-3 ${inspectJobId === j.id ? "border-gray-900" : "border-gray-100"} cursor-grab hover:bg-gray-50`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button className="text-left font-extrabold text-gray-900" onClick={() => setInspectJobId(j.id)}>{j.title}</button>
                    <Badge tone={toneForPriority(j.priority)}>{j.priority}</Badge>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-gray-600">{new Date(j.scheduledStart).toLocaleString()} • {j.bookingWindow ?? "flex"}</div>
                  <div className="mt-1 text-xs font-semibold text-gray-500">{j.serviceType} • {j.durationMinutes} min</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setInspectJobId(j.id)}>Suggestions</Button>
                    <Button onClick={() => runAutoAssign(j.id)}>Auto-assign</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-base font-extrabold text-gray-900">Smart scheduling suggestions</div>
            {!inspectJob ? (
              <div className="mt-3 text-sm font-semibold text-gray-500">Select an unassigned job to see scoring.</div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                  <div className="font-extrabold text-gray-900">{inspectJob.title}</div>
                  <div className="mt-1 text-xs font-semibold text-gray-600">{inspectJob.serviceType} • {inspectJob.bookingWindow ?? "flex"} • {inspectJob.customerAddress}</div>
                </div>
                {suggestions.map((s, idx) => (
                  <div key={s.technicianId} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-gray-900">{idx + 1}. {s.techName}</div>
                        <div className="text-xs font-semibold text-gray-600">{s.reasons.join(" • ")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-gray-900">{s.score}</div>
                        <div className="text-[11px] font-semibold text-gray-500">dispatch score</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-gray-600">
                      <span className="rounded-xl bg-gray-50 px-2 py-1">{s.travelMinutes} min travel</span>
                      <span className="rounded-xl bg-gray-50 px-2 py-1">{s.workloadJobs} jobs on day</span>
                      <span className="rounded-xl bg-gray-50 px-2 py-1">{s.conflicts} conflicts</span>
                    </div>
                    <div className="mt-3">
                      <Button onClick={() => assignJob(inspectJob.id, s.technicianId, props.user).then(refresh).catch((e) => setError(e instanceof Error ? e.message : "Assign failed"))}>
                        Assign to {s.techName}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            {dayOptions.map((day) => {
              const dayIso = day.toISOString().slice(0, 10);
              const dayJobs = jobs.filter((j) => sameDay(j.scheduledStart, dayIso) && j.status !== "cancelled");
              return (
                <div
                  key={dayIso}
                  onDragOver={allowDrop}
                  onDrop={(ev) => dropOnDayBucket(ev, dayIso)}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-extrabold text-gray-900">{day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                      <div className="text-xs font-semibold text-gray-500">{dayJobs.length} scheduled jobs</div>
                    </div>
                    <Badge tone="blue">{dayJobs.filter((j) => j.priority === "emergency").length} emergency</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {dayJobs.slice(0, 4).map((job) => (
                      <div key={job.id} className="rounded-xl border border-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">
                        {job.title} • {job.technicianId ? "assigned" : "open"}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {techs.map((tech) => {
              const dailyRoutes = dayOptions.map((day) => ({
                dayIso: day.toISOString().slice(0, 10),
                stops: buildDailyRoute(tech as any, day.toISOString(), jobs),
              }));

              return (
                <div key={tech.user.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-extrabold text-gray-900">{tech.user.name}</div>
                      <div className="text-sm font-semibold text-gray-500">
                        {tech.profile.specialties.join(", ")} • {tech.profile.isAvailable ? "available" : "unavailable"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-600">
                      <span className="rounded-xl bg-gray-50 px-2 py-1">Max daily jobs: {tech.profile.maxDailyJobs ?? 5}</span>
                      <span className="rounded-xl bg-gray-50 px-2 py-1">{tech.profile.homeBaseAddress ?? tech.user.address}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {dayOptions.map((day) => {
                      const dayIso = day.toISOString().slice(0, 10);
                      const jobsForTech = jobs
                        .filter((j) => j.technicianId === tech.user.id && sameDay(j.scheduledStart, dayIso) && j.status !== "cancelled")
                        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
                      const route = buildDailyRoute(tech as any, day.toISOString(), jobs);
                      const minutes = jobsForTech.reduce((sum, j) => sum + j.durationMinutes, 0);

                      return (
                        <div
                          key={`${tech.user.id}-${dayIso}`}
                          onDragOver={allowDrop}
                          onDrop={(ev) => dropOnTechDay(ev, tech.user.id, dayIso)}
                          className="rounded-2xl border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-extrabold text-gray-900">{day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                              <div className="text-xs font-semibold text-gray-500">{jobsForTech.length} jobs • {minutes} min booked</div>
                            </div>
                            <Badge tone={jobsForTech.length > (tech.profile.maxDailyJobs ?? 5) ? "red" : "green"}>
                              {jobsForTech.length > (tech.profile.maxDailyJobs ?? 5) ? "overloaded" : "balanced"}
                            </Badge>
                          </div>

                          <div className="mt-3 space-y-2">
                            {jobsForTech.length === 0 ? <div className="text-xs font-semibold text-gray-500">Drop a job here.</div> : null}
                            {jobsForTech.map((job) => (
                              <div key={job.id} className="rounded-2xl border border-white bg-white p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-extrabold text-gray-900">{job.title}</div>
                                  <Badge tone={toneForPriority(job.priority)}>{job.priority}</Badge>
                                </div>
                                <div className="mt-1 text-xs font-semibold text-gray-600">
                                  {new Date(job.scheduledStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} • {job.bookingWindow ?? "flex"} • {job.durationMinutes} min
                                </div>
                                {job.priority === "emergency" ? <div className="mt-1 text-[11px] font-bold text-red-700">Emergency override enabled</div> : null}
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3">
                            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Route view</div>
                            <div className="mt-2 grid grid-cols-[1fr,120px] gap-3">
                              <div className="space-y-2">
                                {route.length === 0 ? <div className="text-xs font-semibold text-gray-500">No route yet.</div> : route.map((stop, idx) => (
                                  <div key={stop.job.id} className="rounded-xl bg-gray-50 p-2 text-xs font-semibold text-gray-700">
                                    <div className="font-extrabold text-gray-900">{idx + 1}. {stop.job.title}</div>
                                    <div>{stop.legTravelMinutes} min from previous stop • {stop.legDistanceKm.toFixed(1)} km</div>
                                  </div>
                                ))}
                              </div>
                              <div className="relative h-36 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-sky-50 to-emerald-50">
                                <div className="absolute left-2 top-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">Map board</div>
                                {route.map((stop) => {
                                  const pt = pointForAddress(stop.job.customerAddress);
                                  return (
                                    <div key={stop.job.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pt.x}%`, top: `${pt.y}%` }}>
                                      <div className="rounded-full bg-gray-900 px-2 py-1 text-[10px] font-bold text-white">{stop.job.bookingWindow ?? "job"}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
