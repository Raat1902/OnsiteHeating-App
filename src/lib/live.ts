import type { Branch, Job, TechnicianLocation, TechnicianProfile, User } from "../types";
import { buildDailyRoute, distanceKm, pointForAddress, travelMinutes, type RouteStop } from "./scheduling";

export type FleetRow = {
  tech: User;
  profile: TechnicianProfile;
  branch?: Branch;
  currentJob?: Job;
  nextJobs: Job[];
  status: "idle" | "driving" | "on_site";
  etaMinutes: number;
  distanceToCurrentKm: number;
  vehicleLabel: string;
  rating: number;
  point: { x: number; y: number };
  routeStops: RouteStop[];
  history: Array<{ at: string; label: string }>;
};

function activeJobsForTech(technicianId: string, jobs: Job[]) {
  return jobs
    .filter((job) => job.technicianId === technicianId && job.status !== "completed" && job.status !== "cancelled")
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
}

export function technicianStatusForJob(job?: Job): "idle" | "driving" | "on_site" {
  if (!job) return "idle";
  if (job.routeStatus === "arrived" || job.status === "in_progress") return "on_site";
  if (job.routeStatus === "en_route" || job.status === "assigned") return "driving";
  return "idle";
}

export function buildFleetRows(
  technicians: Array<{ user: User; profile: TechnicianProfile }>,
  jobs: Job[],
  branches: Branch[],
  locationRows: TechnicianLocation[] = []
): FleetRow[] {
  return technicians.map(({ user, profile }) => {
    const nextJobs = activeJobsForTech(user.id, jobs);
    const currentJob = nextJobs[0];
    const routeStops = buildDailyRoute({ user, profile }, new Date().toISOString(), jobs);
    const branch = branches.find((item) => item.id === profile.branchId);
    const location = locationRows
      .filter((row) => row.technicianId === user.id)
      .sort((a, b) => b.at.localeCompare(a.at))[0];

    const point = location
      ? {
          x: Math.max(5, Math.min(95, 50 + (location.lng + 123.12) * 200)),
          y: Math.max(5, Math.min(95, 50 - (location.lat - 49.24) * 200)),
        }
      : pointForAddress(currentJob?.customerAddress ?? profile.homeBaseAddress ?? branch?.address);

    return {
      tech: user,
      profile,
      branch,
      currentJob,
      nextJobs,
      status: location?.status ?? technicianStatusForJob(currentJob),
      etaMinutes: currentJob?.etaMinutes ?? location?.etaMinutes ?? (currentJob ? travelMinutes(profile.homeBaseAddress, currentJob.customerAddress) : 0),
      distanceToCurrentKm: currentJob ? distanceKm(profile.homeBaseAddress, currentJob.customerAddress) : 0,
      vehicleLabel: profile.vehicleInfo ?? "Service van",
      rating: profile.rating ?? 0,
      point,
      routeStops,
      history: [
        {
          at: new Date(Date.now() - 90 * 60_000).toISOString(),
          label: `Departed ${branch?.name ?? "home base"}`,
        },
        ...(currentJob
          ? [
              {
                at: new Date(Date.now() - 25 * 60_000).toISOString(),
                label: `Heading to ${currentJob.title}`,
              },
            ]
          : []),
      ],
    };
  });
}

export function nearestFleetRows(job: Job, rows: FleetRow[]) {
  return [...rows].sort((a, b) => {
    const aScore = (a.currentJob?.etaMinutes ?? a.etaMinutes) + a.nextJobs.length * 7 + (a.profile.specialties.includes(job.serviceType) ? -10 : 10);
    const bScore = (b.currentJob?.etaMinutes ?? b.etaMinutes) + b.nextJobs.length * 7 + (b.profile.specialties.includes(job.serviceType) ? -10 : 10);
    return aScore - bScore;
  });
}

export function customerTrackingSummary(job: Job | undefined, rows: FleetRow[]) {
  if (!job?.technicianId) return null;
  const row = rows.find((item) => item.tech.id === job.technicianId);
  if (!row) return null;
  return {
    technicianName: row.tech.name,
    vehicleLabel: row.vehicleLabel,
    etaMinutes: row.etaMinutes,
    status: row.status,
    rating: row.rating,
    branchName: row.branch?.name,
    routeStops: row.routeStops,
    point: row.point,
  };
}
