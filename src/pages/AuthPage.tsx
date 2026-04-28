import React, { useState } from "react";
import type { Role, User } from "../types";
import { BrandLogo } from "../components/BrandLogo";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { login, register } from "../lib/session";

export function AuthPage(props: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const [reg, setReg] = useState({
    role: "customer" as Role,
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
  });

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const u = await login(loginForm.email, loginForm.password);
      props.onAuthed(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const u = await register({
        role: reg.role,
        name: reg.name,
        email: reg.email,
        password: reg.password,
        phone: reg.phone || undefined,
        address: reg.address || undefined,
      });
      props.onAuthed(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[32px] border border-gray-200 bg-slate-900 p-8 text-white shadow-xl">
          <BrandLogo />
          <div className="mt-8 text-4xl font-extrabold leading-tight">HVAC field operations built for technicians, dispatchers, and customers.</div>
          <div className="mt-4 max-w-2xl text-sm font-semibold text-slate-200">
            Live operations, Diagnostics, equipment lifecycle overview, maintenance memberships, loyalty, reviews, and installable PWA support — all running local-first in the browser.
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Uber-style technician ETA",
              "Smart dispatch + diagnostics",
              "Customer portal + payments",
              "Service reports + signatures",
            ].map((label) => (
              <div key={label} className="rounded-2xl bg-white/10 p-4 text-sm font-semibold text-white">{label}</div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl bg-white/10 p-4 text-sm font-semibold text-slate-200">
            Demo logins:
            <div className="mt-2 space-y-1 text-white">
              <div>Admin: rania@onsiteheating.com / admin123</div>
              <div>Technician: tech@onsiteheating.com / tech123</div>
              <div>Customer: customer@example.com / cust123</div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-6">
            <div className="text-lg font-extrabold text-gray-900">{mode === "login" ? "Welcome back" : "Create your account"}</div>
            <div className="text-sm font-semibold text-gray-500">{mode === "login" ? "Sign in to the service command app" : "Customers can self-register instantly"}</div>
          </div>

          <div className="p-6">
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>
            ) : null}

            <div className="mb-4 flex gap-2">
              <Button variant={mode === "login" ? "primary" : "secondary"} onClick={() => setMode("login")}>Login</Button>
              <Button variant={mode === "register" ? "primary" : "secondary"} onClick={() => setMode("register")}>Register</Button>
            </div>

            {mode === "login" ? (
              <form className="grid gap-3" onSubmit={submitLogin}>
                <Input label="Email" type="email" value={loginForm.email} onChange={(v) => setLoginForm((s) => ({ ...s, email: v }))} />
                <Input label="Password" type="password" value={loginForm.password} onChange={(v) => setLoginForm((s) => ({ ...s, password: v }))} />
                <Button type="submit">Login</Button>
              </form>
            ) : (
              <form className="grid gap-3" onSubmit={submitRegister}>
                <label className="block">
                  <div className="mb-1 text-sm font-semibold text-gray-800">Role</div>
                  <select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-gray-300" value={reg.role} onChange={(e) => setReg((s) => ({ ...s, role: e.target.value as Role }))}>
                    <option value="customer">Customer</option>
                    <option value="technician">Technician</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <Input label="Full name" value={reg.name} onChange={(v) => setReg((s) => ({ ...s, name: v }))} />
                <Input label="Email" type="email" value={reg.email} onChange={(v) => setReg((s) => ({ ...s, email: v }))} />
                <Input label="Password" type="password" value={reg.password} onChange={(v) => setReg((s) => ({ ...s, password: v }))} />
                <Input label="Phone" value={reg.phone} onChange={(v) => setReg((s) => ({ ...s, phone: v }))} />
                <Input label="Address" value={reg.address} onChange={(v) => setReg((s) => ({ ...s, address: v }))} />
                <Button type="submit">Create account</Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
