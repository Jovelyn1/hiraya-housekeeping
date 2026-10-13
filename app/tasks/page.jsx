"use client";

import { useMemo, useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import { NewTaskModal } from "@/components/Modals";
import { useData } from "@/components/DataProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { Badge, BTN, INPUT, Loading, Notice, Empty, priorityTone, taskTone } from "@/components/ui";
import { PRIORITIES, TASK_TYPES } from "@/lib/contract";
import { isActive, isOverdue, sortTasks, taskStatusLabel } from "@/lib/logic";
import { fmtDateTime, timeAgo } from "@/lib/dates";
import { downloadText, toCsv } from "@/lib/csv";

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "waiting", label: "Awaiting inspection" },
  { key: "overdue", label: "Overdue" },
  { key: "unassigned", label: "Unassigned" },
  { key: "finished", label: "Finished" },
  { key: "all", label: "All" },
];

export default function TasksPage() {
  const { tasks, crew, loaded, now } = useData();
  const actions = useActions();
  const [filter, setFilter] = useState("active");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = tasks.filter((t) => {
      if (type && t.type !== type) return false;
      if (q && !(String(t.roomName).toLowerCase().includes(q) || String(t.assignedToName).toLowerCase().includes(q))) {
        return false;
      }
      switch (filter) {
        case "active":
          return isActive(t) || t.status === "done";
        case "waiting":
          return t.status === "done";
        case "overdue":
          return isOverdue(t, now);
        case "unassigned":
          return isActive(t) && !t.assignedTo;
        case "finished":
          return t.status === "inspected" || t.status === "cancelled";
        default:
          return true;
      }
    });
    return filter === "finished" || filter === "all"
      ? base // newest first, as loaded
      : sortTasks(base);
  }, [tasks, filter, type, search, now]);

  async function run(fn) {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(errorText(e));
    }
  }

  function exportCsv() {
    const csv = toCsv(tasks, [
      { label: "Room", value: (t) => t.roomName },
      { label: "Type", value: (t) => TASK_TYPES[t.type]?.label || t.type },
      { label: "Priority", value: (t) => t.priority },
      { label: "Status", value: (t) => taskStatusLabel(t) },
      { label: "Assigned to", value: (t) => t.assignedToName },
      { label: "Created", value: (t) => (t.createdAt ? t.createdAt.toISOString() : "") },
      { label: "Started", value: (t) => (t.startedAt ? t.startedAt.toISOString() : "") },
      { label: "Done", value: (t) => (t.doneAt ? t.doneAt.toISOString() : "") },
      { label: "Minutes", value: (t) => t.durationMin ?? "" },
      { label: "Sent back count", value: (t) => t.rejectedCount || 0 },
      { label: "Booking ID", value: (t) => t.bookingId || "" },
      { label: "Source", value: (t) => t.source || "" },
    ]);
    downloadText("housekeeping-tasks.csv", csv);
  }

  return (
    <ProtectedPage
      supervisorOnly
      title="All tasks"
      actions={
        <div className="flex gap-2">
          <button className={BTN.secondary} onClick={exportCsv}>
            Export CSV
          </button>
          <button className={BTN.primary} onClick={() => setShowNew(true)}>
            New task
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              "rounded-md px-3 py-1.5 text-sm " +
              (filter === f.key
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100")
            }
          >
            {f.label}
          </button>
        ))}
        <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT + " !w-48"}>
          <option value="">All types</option>
          {Object.entries(TASK_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search room or cleaner"
          className={INPUT + " !w-52"}
        />
      </div>

      {err && (
        <div className="mb-4">
          <Notice>{err}</Notice>
        </div>
      )}

      {!loaded.tasks ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty>No tasks match.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Cleaner</th>
                <th className="px-4 py-2 font-medium">Ready by</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const editable = isActive(t);
                return (
                  <tr key={t.id} className="border-t border-slate-100 align-middle">
                    <td className="px-4 py-2 font-medium text-slate-800">{t.roomName}</td>
                    <td className="px-4 py-2 text-slate-600">{TASK_TYPES[t.type]?.label || t.type}</td>
                    <td className="px-4 py-2">
                      {editable ? (
                        <select
                          value={t.priority}
                          onChange={(e) => run(() => actions.setTaskPriority(t, e.target.value))}
                          className="rounded-md border border-slate-300 px-2 py-1"
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={taskTone(t.status)}>{taskStatusLabel(t)}</Badge>
                      {isOverdue(t, now) && <Badge tone="red" className="ml-1">Overdue</Badge>}
                    </td>
                    <td className="px-4 py-2">
                      {editable ? (
                        <select
                          value={t.assignedTo || ""}
                          onChange={(e) =>
                            run(() =>
                              actions.assignTask(t, crew.find((c) => c.id === e.target.value) || null)
                            )
                          }
                          className="rounded-md border border-slate-300 px-2 py-1"
                        >
                          <option value="">Unassigned</option>
                          {crew.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                          {t.assignedTo && !crew.some((c) => c.id === t.assignedTo) && (
                            <option value={t.assignedTo}>{t.assignedToName || "Other"}</option>
                          )}
                        </select>
                      ) : (
                        <span className="text-slate-600">{t.assignedToName || "-"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{t.dueBy ? fmtDateTime(t.dueBy) : "-"}</td>
                    <td className="px-4 py-2 text-slate-500">{timeAgo(t.createdAt)}</td>
                    <td className="px-4 py-2 text-right">
                      {editable && (
                        <button
                          className="text-sm text-red-600 hover:underline"
                          onClick={() => {
                            const reason = window.prompt("Why is this task cancelled? (optional)");
                            if (reason !== null) run(() => actions.cancelTask(t, reason));
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showNew && <NewTaskModal onClose={() => setShowNew(false)} />}
    </ProtectedPage>
  );
}
