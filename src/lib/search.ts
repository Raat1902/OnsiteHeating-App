import { db } from "../db";
import type { User } from "../types";

export type SearchKind = "page" | "job" | "invoice" | "customer" | "quote";

export type SearchResult = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle?: string;
  route: string;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreMatch(haystack: string, query: string): number {
  const h = normalize(haystack);
  const q = normalize(query);
  if (!q) return 0;
  const tokens = q.split(" ").filter(Boolean);
  let score = 0;
  for (const t of tokens) {
    const idx = h.indexOf(t);
    if (idx < 0) return -1;
    score += Math.max(0, 50 - idx);
  }
  return score;
}

function pagesForRole(role: User["role"]): SearchResult[] {
  const base: SearchResult[] = [
    { kind: "page", id: "dashboard", title: "Dashboard", route: "/app/dashboard" },
    { kind: "page", id: "operations", title: "Operations Command Center", route: "/app/operations" },
    { kind: "page", id: "jobs", title: "Jobs", route: "/app/jobs" },
    { kind: "page", id: "invoices", title: "Invoices", route: "/app/invoices" },
    { kind: "page", id: "inventory", title: "Inventory", route: "/app/inventory" },
    { kind: "page", id: "quotes", title: "Quotes", route: "/app/quotes" },
    { kind: "page", id: "settings", title: "Settings", route: "/app/settings" },
  ];

  if (role === "customer") {
    base.push({ kind: "page", id: "about", title: "My Equipment", route: "/app/about" });
  }

  if (role === "admin") {
    base.push(
      { kind: "page", id: "customers", title: "Customers (CRM)", route: "/app/customers" },
      { kind: "page", id: "dispatch", title: "Dispatch", route: "/app/dispatch" },
      { kind: "page", id: "promotions", title: "Promotions", route: "/app/promotions" },
      { kind: "page", id: "analytics", title: "Analytics", route: "/app/analytics" }
    );
  }

  return base;
}

export async function buildSearchIndex(user: User): Promise<SearchResult[]> {
  const results: SearchResult[] = [...pagesForRole(user.role)];
  const jobs =
    user.role === "admin"
      ? await db.jobs.toArray()
      : user.role === "technician"
        ? await db.jobs.where("technicianId").equals(user.id).toArray()
        : await db.jobs.where("customerId").equals(user.id).toArray();

  for (const j of jobs) {
    results.push({
      kind: "job",
      id: j.id,
      title: j.title,
      subtitle: `${j.status} • ${j.serviceType} • ${new Date(j.scheduledStart).toLocaleString()}`,
      route: `/app/jobs/${j.id}`,
    });
  }

  let invoices: any[] = [];
  if (user.role === "admin") invoices = await db.invoices.toArray();
  else if (user.role === "customer") invoices = await db.invoices.where("customerId").equals(user.id).toArray();
  else {
    const jobIds = jobs.map((j) => j.id);
    invoices = jobIds.length ? await db.invoices.where("jobId").anyOf(jobIds).toArray() : [];
  }

  const usersById = new Map((await db.users.toArray()).map((u) => [u.id, u] as const));

  for (const inv of invoices) {
    const cust = usersById.get(inv.customerId);
    results.push({
      kind: "invoice",
      id: inv.id,
      title: `Invoice ${inv.id}`,
      subtitle: `${inv.status}${cust ? ` • ${cust.name}` : ""}`,
      route: "/app/invoices",
    });
  }

  if (user.role === "admin") {
    const customers = await db.users.where("role").equals("customer").toArray();
    for (const c of customers) {
      results.push({
        kind: "customer",
        id: c.id,
        title: c.name,
        subtitle: c.email,
        route: `/app/customers/${c.id}`,
      });
    }
  }

  let quotes: any[] = [];
  if (user.role === "admin") quotes = await db.quotes.toArray();
  else if (user.role === "customer") quotes = await db.quotes.where("customerId").equals(user.id).toArray();

  for (const q of quotes) {
    const cust = usersById.get(q.customerId);
    results.push({
      kind: "quote",
      id: q.id,
      title: `Quote ${q.id}`,
      subtitle: `${q.status}${cust ? ` • ${cust.name}` : ""}`,
      route: "/app/quotes",
    });
  }

  return results;
}

export function filterSearch(index: SearchResult[], query: string, limit = 40): SearchResult[] {
  const q = normalize(query);
  if (!q) return index.slice(0, limit);
  const scored = index
    .map((r) => ({ r, score: scoreMatch(`${r.title} ${r.subtitle ?? ""} ${r.id} ${r.kind}`, q) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.r);
}
