"use client";

import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import ProtectedPage from "@/components/ProtectedPage";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { Badge, Empty, Loading, Notice } from "@/components/ui";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/contract";
import { isActive } from "@/lib/logic";
import { minutesLabel, sameDay } from "@/lib/dates";

export default function TeamPage() {
  const { role } = useAuth();
  const { crew, tasks, loaded, errors, now } = useData();
  const [err, setErr] = useState("");

  const rows = useMemo(
    () =>
      crew.map((c) => {
        const mine = tasks.filter((t) => t.assignedTo === c.id);
        const week = mine.filter(
          (t) => t.status === "inspected" && t.doneAt && now.getTime() - t.doneAt.getTime() < 7 * 86400000 && t.durationMin
        );
        return {
          ...c,
          openCount: mine.filter(isActive).length,
          doneToday: mine.filter((t) => t.doneAt && sameDay(t.doneAt, now)).length,
          avg: week.length ? week.reduce((a, t) => a + t.durationMin, 0) / week.length : null,
        };
      }),
    [crew, tasks, now]
  );

  async function toggleSupervisor(c) {
    setErr("");
    try {
      await updateDoc(doc(db, COLLECTIONS.staff, c.id), { supervisor: !c.supervisor });
    } catch {
      setErr("Could not update. Only admins can change this, and the Firestore rules must allow it.");
    }
  }

  return (
    <ProtectedPage supervisorOnly title="Team">
      <p className="mb-4 text-sm text-slate-600">
        Housekeeping staff come from the Operations Hub. To add a person, create the account on the
        Hub's Staff page with the role Housekeeping.
      </p>
      {errors.crew && (
        <div className="mb-4">
          <Notice>Could not load staff ({errors.crew}). Publish the Firestore rules for staff.</Notice>
        </div>
      )}
      {err && (
        <div className="mb-4">
          <Notice>{err}</Notice>
        </div>
      )}
      {!loaded.crew ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No housekeeping staff yet.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Open tasks</th>
                <th className="px-4 py-2 font-medium">Done today</th>
                <th className="px-4 py-2 font-medium">Avg time (7 days)</th>
                <th className="px-4 py-2 font-medium">Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-800">{c.name || "-"}</p>
                    <p className="text-xs text-slate-500">{c.email}</p>
                  </td>
                  <td className="px-4 py-2">
                    {c.active === false ? (
                      <Badge>Inactive</Badge>
                    ) : (
                      <Badge tone={c.openCount > 0 ? "amber" : "green"}>
                        {c.openCount > 0 ? "Working" : "Free"}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">{c.openCount}</td>
                  <td className="px-4 py-2">{c.doneToday}</td>
                  <td className="px-4 py-2">{minutesLabel(c.avg)}</td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={c.supervisor === true}
                      disabled={role !== "admin"}
                      onChange={() => toggleSupervisor(c)}
                      title={role === "admin" ? "" : "Only admins can change this"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProtectedPage>
  );
}
