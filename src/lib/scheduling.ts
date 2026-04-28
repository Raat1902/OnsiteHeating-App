import type { Job, TechnicianProfile, User } from "../types";

export type TechnicianBundle = { user: User; profile: TechnicianProfile };

export type Suggestion = {
  technicianId: string;
  techName: string;
  score: number;
  proximityKm: number;
  travelMinutes: number;
  workloadJobs: number;
  hasSpecialty: boolean;
  isAvailable: boolean;
  conflicts: number;
  reasons: string[];
};

export type RouteStop = {
  job: Job;
  legDistanceKm: number;
  legTravelMinutes: number;
  x: number;
  y: number;
};

function hashCode(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(31, h) + text.charCodeAt(i) | 0;
  return Math.abs(h);
}

export function pointForAddress(address?: string | null): { x: number; y: number } {
  const seed = hashCode(address?.trim().toLowerCase() || "vancouver");
  return {
    x: 10 + (seed % 80),
    y: 10 + (Math.floor(seed / 97) % 80),
  };
}

export function distanceKm(a?: string | null, b?: string | null): number {
  const p1 = pointForAddress(a);
  const p2 = pointForAddress(b);
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Number((Math.sqrt(dx * dx + dy * dy) * 1.45).toFixed(1));
}

export function travelMinutes(a?: string | null, b?: string | null): number {
  return Math.max(6, Math.round(distanceKm(a, b) * 2.4 + 8));
}

function sameDay(aIso: string, bIso: string): boolean {
  return aIso.slice(0, 10) === bIso.slice(0, 10);
}

export function jobEnd(job: Job): number {
  return new Date(job.scheduledStart).getTime() + job.durationMinutes * 60_000;
}

export function overlaps(a: Job, b: Job): boolean {
  const aStart = new Date(a.scheduledStart).getTime();
  const bStart = new Date(b.scheduledStart).getTime();
  return aStart < jobEnd(b) && bStart < jobEnd(a);
}

export function findConflictsForTech(job: Job, techId: string, allJobs: Job[]): Job[] {
  return allJobs.filter((other) => {
    if (other.id === job.id) return false;
    if (other.technicianId !== techId) return false;
    if (other.status === "cancelled" || other.status === "completed") return false;
    if (!sameDay(other.scheduledStart, job.scheduledStart)) return false;
    return overlaps(job, other);
  });
}

export function workloadForTechDate(techId: string, dateIso: string, jobs: Job[]): { jobs: number; minutes: number } {
  const my = jobs.filter((j) => j.technicianId === techId && sameDay(j.scheduledStart, dateIso) && j.status !== "cancelled");
  return { jobs: my.length, minutes: my.reduce((sum, j) => sum + j.durationMinutes, 0) };
}

export function buildTechnicianSuggestions(job: Job, techs: TechnicianBundle[], jobs: Job[]): Suggestion[] {
  return techs.map((tech) => {
    const workload = workloadForTechDate(tech.user.id, job.scheduledStart, jobs);
    const km = distanceKm(tech.profile.homeBaseAddress ?? tech.user.address, job.customerAddress);
    const minutes = travelMinutes(tech.profile.homeBaseAddress ?? tech.user.address, job.customerAddress);
    const specialtyText = `${job.serviceType} ${job.title} ${job.description}`.toLowerCase();
    const hasSpecialty = tech.profile.specialties.some((s) => specialtyText.includes(s.toLowerCase()) || s.toLowerCase().includes(job.serviceType));
    const conflicts = findConflictsForTech(job, tech.user.id, jobs).length;
    const limit = tech.profile.maxDailyJobs ?? 5;
    let score = 100;
    score += tech.profile.isAvailable ? 20 : -50;
    score += hasSpecialty ? 18 : 0;
    score -= km * 2.5;
    score -= workload.jobs * 12;
    score -= Math.max(0, workload.jobs - limit) * 18;
    score -= conflicts * 120;
    if (job.priority === "emergency") score += Math.max(0, 40 - minutes);
    const reasons = [
      tech.profile.isAvailable ? "Available" : "Marked unavailable",
      hasSpecialty ? "Specialty match" : "General fit",
      `${km.toFixed(1)} km away`,
      `${workload.jobs} jobs on this day`,
      conflicts ? `${conflicts} overlap conflict(s)` : "No overlap conflict",
    ];
    return {
      technicianId: tech.user.id,
      techName: tech.user.name,
      score: Math.round(score),
      proximityKm: km,
      travelMinutes: minutes,
      workloadJobs: workload.jobs,
      hasSpecialty,
      isAvailable: tech.profile.isAvailable,
      conflicts,
      reasons,
    };
  }).sort((a, b) => b.score - a.score);
}

export function buildDailyRoute(tech: TechnicianBundle, dateIso: string, jobs: Job[]): RouteStop[] {
  const myJobs = jobs
    .filter((j) => j.technicianId === tech.user.id && sameDay(j.scheduledStart, dateIso) && j.status !== "cancelled")
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

  const stops: RouteStop[] = [];
  let previousAddress = tech.profile.homeBaseAddress ?? tech.user.address;
  for (const job of myJobs) {
    const point = pointForAddress(job.customerAddress);
    const legKm = distanceKm(previousAddress, job.customerAddress);
    const legMinutes = travelMinutes(previousAddress, job.customerAddress);
    stops.push({ job, legDistanceKm: legKm, legTravelMinutes: legMinutes, x: point.x, y: point.y });
    previousAddress = job.customerAddress;
  }
  return stops;
}

export function shiftJobToDate(job: Job, dateIso: string): Job {
  const current = new Date(job.scheduledStart);
  const target = new Date(dateIso);
  target.setHours(current.getHours(), current.getMinutes(), 0, 0);
  return { ...job, scheduledStart: target.toISOString() };
}

export function bookingWindowStart(dateInput: string, window: Job["bookingWindow"]): string {
  const base = new Date(dateInput || Date.now());
  if (window === "12-4") base.setHours(12, 0, 0, 0);
  else if (window === "8-12") base.setHours(8, 0, 0, 0);
  else base.setHours(9, 0, 0, 0);
  return base.toISOString();
}
