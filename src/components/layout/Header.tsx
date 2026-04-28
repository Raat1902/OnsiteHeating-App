import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, LogOut, Phone, Search } from "lucide-react";
import type { User } from "../../types";
import { useOnlineStatus } from "../../lib/hooks";
import { Button } from "../ui/Button";
import { CommandPalette } from "../CommandPalette";
import { BrandLogo } from "../BrandLogo";
import { listNotifications, markNotificationRead } from "../../lib/data";

function NavItem(props: { to: string; label: string }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        `rounded-xl px-3 py-2 text-sm font-semibold transition ${
          isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
        }`
      }
    >
      {props.label}
    </NavLink>
  );
}

export function Header(props: { user: User; onLogout: () => void }) {
  const nav = useNavigate();
  const [openNoti, setOpenNoti] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const online = useOnlineStatus();
  const [tick, setTick] = useState(0);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await listNotifications(props.user.id);
      if (alive) setItems(list);
    })();
    return () => { alive = false; };
  }, [props.user.id, tick]);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const role = props.user.role;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      const meta = e.metaKey || e.ctrlKey;
      if (meta && isK) {
        e.preventDefault();
        setOpenSearch(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openAndRefresh() {
    setOpenNoti((p) => !p);
    setTick((p) => p + 1);
  }

  async function readOne(id: string, route?: string) {
    await markNotificationRead(id);
    setTick((p) => p + 1);
    setOpenNoti(false);
    if (route) nav(route);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/app/dashboard" className="flex items-center gap-2">
          <BrandLogo compact />
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <NavItem to="/app/dashboard" label="Dashboard" />
          <NavItem to="/app/operations" label="Operations" />
          <NavItem to="/app/jobs" label="Jobs" />
          <NavItem to="/app/invoices" label="Invoices" />
          {role === "customer" ? <NavItem to="/app/about" label="My Equipment" /> : null}
          {role === "admin" ? <NavItem to="/app/customers" label="Customers" /> : null}
          {role === "admin" ? <NavItem to="/app/dispatch" label="Dispatch" /> : null}
          <NavItem to="/app/inventory" label="Inventory" />
          {role === "admin" ? <NavItem to="/app/promotions" label="Promotions" /> : null}
          <NavItem to="/app/quotes" label="Quotes" />
          {role === "admin" ? <NavItem to="/app/analytics" label="Analytics" /> : null}
          <NavItem to="/app/settings" label="Settings" />
        </nav>

        <div className="flex items-center gap-2">
          <a
            className="hidden md:inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-extrabold text-red-700 hover:bg-red-100"
            href="tel:+15550000000"
            title="Emergency Hotline"
          >
            <Phone size={16} />
            Emergency
          </a>

          <button
            className="hidden md:inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50"
            onClick={() => setOpenSearch(true)}
            aria-label="Open search"
            title="Search (Ctrl/Cmd + K)"
          >
            <Search size={16} />
            Search
          </button>

          <div className="relative">
            <button className="relative rounded-xl p-2 hover:bg-gray-100" onClick={openAndRefresh} aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </button>

            {openNoti ? (
              <div className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                <div className="border-b border-gray-100 p-3 text-sm font-extrabold text-gray-900">Notifications</div>
                <div className="max-h-[320px] overflow-auto">
                  {items.length === 0 ? (
                    <div className="p-3 text-sm font-semibold text-gray-500">No notifications.</div>
                  ) : (
                    items.slice(0, 20).map((n) => (
                      <button
                        key={n.id}
                        className={`w-full border-b border-gray-100 p-3 text-left hover:bg-gray-50 ${n.read ? "" : "bg-blue-50/40"}`}
                        onClick={() => readOne(n.id, n.type === "invoice" ? "/app/invoices" : "/app/operations")}
                      >
                        <div className="text-sm font-extrabold text-gray-900">{n.title}</div>
                        <div className="mt-1 text-xs font-semibold text-gray-600">{n.body}</div>
                        <div className="mt-1 text-[11px] font-semibold text-gray-500">{new Date(n.createdAt).toLocaleString()}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {!online ? <div className="hidden rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-extrabold text-yellow-800 md:block">Offline</div> : null}

          <div className="hidden text-right md:block">
            <div className="text-sm font-extrabold text-gray-900">{props.user.name}</div>
            <div className="text-xs font-semibold text-gray-500 capitalize">{role} • {props.user.email}</div>
          </div>

          <Button variant="secondary" onClick={props.onLogout} className="gap-2">
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </div>
      <CommandPalette user={props.user} open={openSearch} onClose={() => setOpenSearch(false)} />
    </header>
  );
}
