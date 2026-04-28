import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import type { User } from "../types";
import { listJobsForUser, listInvoicesForUser, listPayments, listCustomers, listRecentActivityForUser, type ActivityItem } from "../lib/data";
import { customerLifetimeValue } from "../lib/domain";
import { Badge } from "../components/ui/Badge";

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-extrabold text-gray-900">{props.title}</div>
      <div className="mt-3">{props.children}</div>
    </div>
  );
}

export function DashboardPage(props: { user: User }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [ltv, setLtv] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [j, inv] = await Promise.all([listJobsForUser(props.user), listInvoicesForUser(props.user)]);
      if (!alive) return;
      setJobs(j);
      setInvoices(inv);

      if (props.user.role === "customer") {
        setPayments(await listPayments(props.user.id));
        setLtv(await customerLifetimeValue(props.user.id));
      }

      if (props.user.role === "admin") {
        const cs = await listCustomers();
        setCustomersCount(cs.length);
      }

      setActivity(await listRecentActivityForUser(props.user, 12));
    })();
    return () => { alive = false; };
  }, [props.user]);

  const upcoming = useMemo(() => {
    return [...jobs]
      .filter((j) => j.status !== "cancelled" && j.status !== "completed")
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
      .slice(0, 5);
  }, [jobs]);

  const unpaid = useMemo(() => invoices.filter((i) => i.status !== "paid"), [invoices]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <div className="text-2xl font-extrabold text-gray-900">Dashboard</div>
        <div className="text-sm font-semibold text-gray-500">Welcome, {props.user.name}.</div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card title="My jobs">
          <div className="text-3xl font-extrabold text-gray-900">{jobs.length}</div>
          <div className="mt-2 text-xs font-semibold text-gray-500">
            <Link className="underline" to="/app/jobs">Open jobs</Link>
          </div>
        </Card>

        <Card title="Invoices">
          <div className="text-3xl font-extrabold text-gray-900">{invoices.length}</div>
          <div className="mt-2 text-xs font-semibold text-gray-500">
            <Link className="underline" to="/app/invoices">Open invoices</Link>
          </div>
        </Card>

        {props.user.role === "customer" ? (
          <Card title="Payments">
            <div className="text-3xl font-extrabold text-gray-900">{payments.length}</div>
            <div className="mt-1 text-xs font-semibold text-gray-500">Lifetime paid: ${ltv.toFixed(2)}</div>
          </Card>
        ) : (
          <Card title="Open invoices (unpaid)">
            <div className="text-3xl font-extrabold text-gray-900">{unpaid.length}</div>
            <div className="mt-1 text-xs font-semibold text-gray-500">Draft/Sent/Overdue</div>
          </Card>
        )}

        {props.user.role === "admin" ? (
          <Card title="Customers (CRM)">
            <div className="text-3xl font-extrabold text-gray-900">{customersCount}</div>
            <div className="mt-2 text-xs font-semibold text-gray-500">
              <Link className="underline" to="/app/customers">Manage customers</Link>
            </div>
          </Card>
        ) : (
          <Card title="Emergency hotline">
            <a className="inline-flex rounded-xl bg-red-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-red-700" href="tel:+15550000000">
              Call emergency line
            </a>
            <div className="mt-2 text-xs font-semibold text-gray-500">Immediate dispatch for emergencies.</div>
          </Card>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title="Upcoming appointments">
          {upcoming.length === 0 ? (
            <div className="text-sm font-semibold text-gray-500">No upcoming appointments.</div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((j) => (
                <Link key={j.id} to={`/app/jobs/${j.id}`} className="block rounded-2xl border border-gray-100 p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-gray-900">{j.title}</div>
                    <Badge tone={j.priority === "emergency" ? "red" : j.priority === "high" ? "yellow" : "gray"}>{j.priority}</Badge>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-600">
                    {j.serviceType} • {format(new Date(j.scheduledStart), "PPpp")}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-gray-500">Status: {j.status}</div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="Quick actions">
          <div className="grid gap-2">
            <Link className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-extrabold text-white hover:bg-gray-800" to="/app/jobs">
              {props.user.role === "customer" ? "Book / manage appointments" : "Manage jobs"}
            </Link>
            <Link className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-200" to="/app/invoices">
              Invoices & payments
            </Link>
            <Link className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-200" to="/app/quotes">
              Quotes & approvals
            </Link>
            {props.user.role === "customer" ? (
              <Link className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-200" to="/app/about">
                About my equipment
              </Link>
            ) : null}
            {props.user.role === "admin" ? (
              <Link className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-200" to="/app/dispatch">
                Dispatch (drag & drop)
              </Link>
            ) : null}
          </div>
        </Card>

        <Card title="Recent activity">
          {activity.length === 0 ? (
            <div className="text-sm font-semibold text-gray-500">No activity yet.</div>
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <Link
                  key={`${a.kind}-${a.id}`}
                  to={a.route}
                  className="block rounded-2xl border border-gray-100 p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-gray-900">{a.title}</div>
                    <Badge tone={a.kind === "payment" ? "green" : a.kind === "invoice" ? "yellow" : a.kind === "message" ? "purple" : "blue"}>
                      {a.kind}
                    </Badge>
                  </div>
                  {a.subtitle ? <div className="mt-1 text-xs font-semibold text-gray-600 ">{a.subtitle}</div> : null}
                  <div className="mt-1 text-[11px] font-semibold text-gray-500">{new Date(a.at).toLocaleString()}</div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
