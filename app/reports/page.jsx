"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import ProtectedPage from "@/components/ProtectedPage";
import { useData } from "@/components/DataProvider";
import { INPUT, Loading, StatCard } from "@/components/ui";
import { TASK_TYPES } from "@/lib/contract";
import { isActive, isOverdue } from "@/lib/logic";
import { minutesLabel, sameDay, startOfDayLocal } from "@/lib/dates";

const avg = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

export default function ReportsPage() {
  const { tasks, loaded, now } = useData();
  const [days, setDays] = useState(7);

  const r = useMemo(() => {
    const from = startOfDayLocal(new Date(now.getTime() - (days - 1) * 86400000)).getTime();
    const finished = tasks.filter(
      (t) => t.status === "inspected" && t.doneAt && t.doneAt.getTime() >= from
    );
    const timed = finished.filter((t) => t.durationMin);

    // Per cleaner
    const byCleaner = {};
    finished.forEach((t) => {
      const k = t.assignedToName || "Unassigned";
      byCleaner[k] = byCleaner[k] || { name: k, done: 0, minutes: [], sentBack: 0 };
      byCleaner[k].done++;
      if (t.durationMin) byCleaner[k].minutes.push(t.durationMin);
      if (t.rejectedCount > 0) byCleaner[k].sentBack++;
    });

    // Per task type
    const byType = {};
    finished.forEach((t) => {
      byType[t.type] = byType[t.type] || { type: t.type, done: 0, minutes: [] };
      byType[t.type].done++;
      if (t.durationMin) byType[t.type].minutes.push(t.durationMin);
    });

    // Per day
    const perDay = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      perDay.push({
        label: format(d, days > 10 ? "d" : "EEE d"),
        count: finished.filter((t) => sameDay(t.doneAt, d)).length,
      });
    }

    const inspected = finished.filter((t) => TASK_TYPES[t.type]?.needsInspection && t.inspectedBy !== "auto");
    const firstPass = inspected.filter((t) => !t.rejectedCount).length;

    return {
      finished: finished.length,
      avgMin: avg(timed.map((t) => t.durationMin)),
      passRate: inspected.length ? Math.round((firstPass / inspected.length) * 100) + "%" : "-",
      cleaners: Object.values(byCleaner).sort((a, b) => b.done - a.done),
      types: Object.values(byType).sort((a, b) => b.done - a.done),
      perDay,
      max: Math.max(1, ...perDay.map((p) => p.count)),
      open: tasks.filter(isActive).length,
      overdue: tasks.filter((t) => isOverdue(t, now)).length,
    };
  }, [tasks, days, now]);

  return (
    <ProtectedPage
      supervisorOnly
      title="Reports"
      actions={
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={INPUT + " !w-40"}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      }
    >
      {!loaded.tasks ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tasks finished" value={r.finished} />
            <StatCard label="Average time per task" value={minutesLabel(r.avgMin)} />
            <StatCard label="Passed first inspection" value={r.passRate} />
            <StatCard label="Open now / overdue" value={r.open + " / " + r.overdue} tone={r.overdue ? "red" : undefined} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-medium text-slate-800">Tasks finished per day</h2>
            <div className="flex h-40 items-end gap-2">
              {r.perDay.map((p, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs text-slate-600">{p.count || ""}</span>
                  <div
                    className="w-full rounded-t bg-brand-500"
                    style={{ height: Math.max(2, (p.count / r.max) * 110) + "px" }}
                  />
                  <span className="text-xs text-slate-500">{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white">
              <h2 className="px-5 pt-5 font-medium text-slate-800">By cleaner</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Done</th>
                    <th className="px-3 py-2 font-medium">Avg time</th>
                    <th className="px-3 py-2 font-medium">Sent back</th>
                  </tr>
                </thead>
                <tbody>
                  {r.cleaners.map((c) => (
                    <tr key={c.name} className="border-t border-slate-100">
                      <td className="px-5 py-2 text-slate-800">{c.name}</td>
                      <td className="px-3 py-2">{c.done}</td>
                      <td className="px-3 py-2">{minutesLabel(avg(c.minutes))}</td>
                      <td className="px-3 py-2">{c.sentBack}</td>
                    </tr>
                  ))}
                  {r.cleaners.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                        No finished tasks in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <h2 className="px-5 pt-5 font-medium text-slate-800">By task type</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Done</th>
                    <th className="px-3 py-2 font-medium">Avg time</th>
                  </tr>
                </thead>
                <tbody>
                  {r.types.map((t) => (
                    <tr key={t.type} className="border-t border-slate-100">
                      <td className="px-5 py-2 text-slate-800">{TASK_TYPES[t.type]?.label || t.type}</td>
                      <td className="px-3 py-2">{t.done}</td>
                      <td className="px-3 py-2">{minutesLabel(avg(t.minutes))}</td>
                    </tr>
                  ))}
                  {r.types.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-6 text-center text-slate-500">
                        No finished tasks in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Based on the 500 most recent tasks. For older history, use Export CSV on the All tasks page.
          </p>
        </div>
      )}
    </ProtectedPage>
  );
}
