"use client";

import { useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { Badge, BTN, INPUT, Notice } from "@/components/ui";
import { firebaseConfig } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/contract";
import { isActive } from "@/lib/logic";

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-medium text-slate-800">{title}</h2>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { role } = useAuth();
  const { rooms, tasks, supplies, crew, bookings, arrivals, requireInspection, loaded, errors } = useData();
  const actions = useActions();
  const [msg, setMsg] = useState(null); // { tone, text }
  const [busy, setBusy] = useState("");
  const [days, setDays] = useState(3);

  async function run(key, fn, okText) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fn();
      setMsg({ tone: "ok", text: okText(res) });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    }
    setBusy("");
  }

  const uninitialized = rooms.filter((r) => !r.cleaningStatus).length;

  const checks = [
    { label: "Rooms", key: "rooms", count: rooms.length, source: COLLECTIONS.rooms },
    { label: "Housekeeping tasks", key: "tasks", count: tasks.length, source: COLLECTIONS.tasks },
    { label: "Supplies", key: "supplies", count: supplies.length, source: COLLECTIONS.supplies },
    { label: "Housekeeping staff", key: "crew", count: crew.length, source: COLLECTIONS.staff },
    { label: "Upcoming bookings", key: "bookings", count: bookings.length, source: COLLECTIONS.bookings },
    { label: "App settings", key: "settings", count: null, source: COLLECTIONS.settings },
  ];

  return (
    <ProtectedPage supervisorOnly title="Settings">
      {msg && (
        <div className="mb-4">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Inspection">
          <p className="mb-3 text-sm text-slate-600">
            When on, a finished check-out or deep clean waits for a supervisor to pass it before the room shows as
            Ready. When off, rooms become Ready as soon as the cleaner finishes.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={requireInspection}
              disabled={role !== "admin" || busy === "inspect"}
              onChange={(e) =>
                run("inspect", () => actions.setRequireInspection(e.target.checked), () =>
                  e.target.checked ? "Inspection is on." : "Inspection is off."
                )
              }
            />
            Require supervisor inspection
          </label>
          {role !== "admin" && <p className="mt-2 text-xs text-slate-500">Only admins can change this.</p>}
        </Card>

        <Card title="Set up rooms">
          <p className="mb-3 text-sm text-slate-600">
            Rooms created before this app have no cleaning status. This marks them Ready once, so the board is
            complete. {uninitialized} room(s) need it.
          </p>
          <button
            className={BTN.primary}
            disabled={!!busy || uninitialized === 0}
            onClick={() =>
              run("init", () => actions.initializeRooms(), (n) => n + " room(s) set to Ready.")
            }
          >
            {busy === "init" ? "Working..." : "Set missing rooms to Ready"}
          </button>
        </Card>

        <Card title="Sync check-outs">
          <p className="mb-3 text-sm text-slate-600">
            Creates a cleaning task for each booking the Hub checked out recently. Safe to run any time: the same
            check-out never gets two tasks, even if the Cloud Function is also running.
          </p>
          <div className="flex items-center gap-2">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={INPUT + " !w-40"}>
              <option value={1}>Last 1 day</option>
              <option value={3}>Last 3 days</option>
              <option value={7}>Last 7 days</option>
            </select>
            <button
              className={BTN.primary}
              disabled={!!busy}
              onClick={() =>
                run("sync", () => actions.syncCheckouts(days), (r) =>
                  r.created +
                  " task(s) created, " +
                  r.existing +
                  " already existed." +
                  (r.unmatched.length
                    ? " No matching room for: " + r.unmatched.join(", ") + "."
                    : "")
                )
              }
            >
              {busy === "sync" ? "Syncing..." : "Sync now"}
            </button>
          </div>
        </Card>

        <Card title="Ready-by times">
          <p className="mb-3 text-sm text-slate-600">
            Sets "ready by" on open tasks from the next guest arriving in each room (14:00 on the arrival day), and
            raises the priority when a guest arrives today.
          </p>
          <button
            className={BTN.primary}
            disabled={!!busy}
            onClick={() =>
              run("due", () => actions.refreshDueTimes(tasks.filter(isActive), arrivals), (n) =>
                n + " task(s) updated."
              )
            }
          >
            {busy === "due" ? "Working..." : "Update ready-by times"}
          </button>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Connection check">
          <p className="mb-3 text-sm text-slate-600">
            Firebase project: <span className="font-medium">{firebaseConfig.projectId}</span>. If a row shows an
            error, publish the rules from firestore.rules.housekeeping-additions.txt.
          </p>
          <ul className="divide-y divide-slate-100 text-sm">
            {checks.map((c) => (
              <li key={c.key} className="flex items-center justify-between py-2">
                <span className="text-slate-700">
                  {c.label} <span className="text-slate-400">({c.source})</span>
                </span>
                {errors[c.key] ? (
                  <Badge tone="red">{errors[c.key]}</Badge>
                ) : loaded[c.key] ? (
                  <Badge tone="green">{c.count === null ? "Connected" : c.count + " found"}</Badge>
                ) : (
                  <Badge>Checking...</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </ProtectedPage>
  );
}
