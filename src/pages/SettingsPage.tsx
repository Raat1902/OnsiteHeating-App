import React, { useEffect, useState } from "react";
import type { TechnicianProfile, User } from "../types";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { db } from "../db";
import { resetAllData } from "../lib/session";
import { downloadBackup, restoreBackupFromFile } from "../lib/backup";
import { useToast } from "../components/ToastProvider";
import { upsertTechProfile } from "../lib/data";
import { PwaInstallButton } from "../components/PwaInstallButton";
import { DEFAULT_AUTOMATION_SETTINGS, getAutomationSettings, setAutomationSettings, type AutomationSettings } from "../lib/automation";

export function SettingsPage(props: { user: User; onLogout: () => void }) {
  const [profile, setProfile] = useState<TechnicianProfile | null>(null);
  const [spec, setSpec] = useState("");
  const [available, setAvailable] = useState(true);
  const [sms, setSms] = useState<any[]>([]);
  const [busyBackup, setBusyBackup] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [autoSettings, setAutoSettings] = useState<AutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);

  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (props.user.role === "technician") {
        const p = await db.techProfiles.where("userId").equals(props.user.id).first();
        if (alive && p) {
          setProfile(p);
          setSpec(p.specialties.join(", "));
          setAvailable(p.isAvailable);
        }
      }
      if (props.user.role === "admin") {
        const logs = await db.smsLogs.orderBy("createdAt").reverse().toArray();
        if (alive) setSms(logs);
        setAutoSettings(getAutomationSettings());
      }
    })();
    return () => { alive = false; };
  }, [props.user]);

  async function saveTech() {
    if (!profile) return;
    profile.isAvailable = available;
    profile.specialties = spec.split(",").map((s) => s.trim()).filter(Boolean);
    await upsertTechProfile(profile);
    toast({ title: "Technician settings saved", tone: "success" });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4">
        <div className="text-2xl font-extrabold text-gray-900">Settings</div>
        <div className="text-sm font-semibold text-gray-500">Account, automation, backup, and install controls.</div>
      </div>

      {props.user.role === "technician" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-gray-900">Technician availability</div>
          <div className="mt-3 grid gap-3">
            <label className="flex items-center gap-2 rounded-2xl border border-gray-200 p-3">
              <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
              <span className="text-sm font-semibold text-gray-800">Available for dispatch</span>
            </label>
            <Input label="Specialties (comma-separated)" value={spec} onChange={setSpec} />
            <div className="flex justify-end">
              <Button onClick={saveTech}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}

      {props.user.role === "admin" ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-gray-900">Automation rules</div>
          <div className="mt-2 text-sm font-semibold text-gray-700">Configure smart triggers for maintenance jobs, invoices, reminders, and warranty alerts.</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {([
              ["autoMaintenanceJobs", "Auto-create maintenance jobs"],
              ["autoSendInvoice", "Auto-send invoice after completion"],
              ["autoAppointmentReminders", "Appointment reminders"],
              ["autoUnpaidInvoiceAlerts", "Overdue invoice alerts"],
              ["autoWarrantyAlerts", "Warranty expiry alerts"],
              ["autoApplyPromotions", "Auto-apply promotions when eligible"],
            ] as Array<[keyof AutomationSettings, string]>).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3">
                <input type="checkbox" checked={autoSettings[key]} onChange={(e) => setAutoSettings((p) => ({ ...p, [key]: e.target.checked }))} />
                <span className="text-sm font-semibold text-gray-800">{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => { setAutomationSettings(autoSettings); toast({ title: "Automation saved", tone: "success" }); }}>Save automation settings</Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-base font-extrabold text-gray-900">Backup & restore</div>
        <div className="mt-2 text-sm font-semibold text-gray-700">
          Export your local database to a JSON file (including attachments). Restore later on this device, or move your demo data to another browser.
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={async () => {
              try {
                setBusyBackup(true);
                await downloadBackup();
                toast({ title: "Backup downloaded", tone: "success" });
              } catch (e: any) {
                toast({ title: "Backup failed", message: e?.message ?? "Backup failed", tone: "error" });
              } finally {
                setBusyBackup(false);
              }
            }}
            disabled={busyBackup}
          >
            Download backup
          </Button>

          <PwaInstallButton variant="secondary" />

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!file) return;
                const ok = confirm(`Restore from backup?\n\nMode: ${restoreMode.toUpperCase()}\n\nReplace clears your current local data first.`);
                if (!ok) return;
                try {
                  setBusyBackup(true);
                  await restoreBackupFromFile(file, { mode: restoreMode });
                  toast({ title: "Restore complete", message: "The app will reload.", tone: "success" });
                  window.location.reload();
                } catch (err: any) {
                  toast({ title: "Restore failed", message: err?.message ?? "Restore failed", tone: "error" });
                } finally {
                  setBusyBackup(false);
                }
              }}
            />
            Restore backup…
          </label>

          <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="text-xs font-extrabold text-gray-500">Mode</span>
            <select className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm font-semibold" value={restoreMode} onChange={(e) => setRestoreMode(e.target.value as any)}>
              <option value="replace">Replace</option>
              <option value="merge">Merge</option>
            </select>
          </label>
        </div>
      </div>

      {props.user.role === "admin" ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-base font-extrabold text-gray-900">SMS / reminder log</div>
          <div className="mt-3 space-y-2">
            {sms.length === 0 ? <div className="text-sm font-semibold text-gray-500">No SMS reminders yet.</div> : sms.slice(0, 20).map((s) => (
              <div key={s.id} className="rounded-2xl border border-gray-100 p-3">
                <div className="font-extrabold text-gray-900">{s.toPhone}</div>
                <div className="mt-1 text-xs font-semibold text-gray-600 whitespace-pre-wrap">{s.body}</div>
                <div className="mt-1 text-[11px] font-semibold text-gray-500">{new Date(s.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-base font-extrabold text-gray-900">Reset demo data</div>
        <div className="mt-2 text-sm font-semibold text-gray-700">
          Clears the local browser database for this app on this device. Use this if you want to start fresh with seed data again.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" onClick={async () => {
            const ok = confirm("Reset all local data for this app?");
            if (!ok) return;
            await resetAllData();
            props.onLogout();
            window.location.reload();
          }}>
            Reset app data
          </Button>
        </div>
      </div>
    </div>
  );
}
