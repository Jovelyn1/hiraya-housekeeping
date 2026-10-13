"use client";

import { useMemo, useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import TaskCard from "@/components/TaskCard";
import { ReportIssueModal } from "@/components/Modals";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { Badge, BTN, Empty, Loading, Notice, priorityTone } from "@/components/ui";
import { isActive, sortTasks } from "@/lib/logic";
import { timeAgo } from "@/lib/dates";

export default function IssuesPage() {
  const { isSupervisor } = useAuth();
  const { tasks, loaded } = useData();
  const actions = useActions();
  const [tab, setTab] = useState("open");
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState("");

  const issues = useMemo(() => tasks.filter((t) => t.type === "maintenance-report"), [tasks]);
  const open = useMemo(() => sortTasks(issues.filter(isActive)), [issues]);
  const resolved = useMemo(() => issues.filter((t) => t.status === "inspected").slice(0, 50), [issues]);

  async function resolve(t) {
    setErr("");
    try {
      // Supervisors can close an issue even if nobody started it
      if (t.status === "open") await actions.startTask(t);
      await actions.completeTask({ ...t, startedAt: t.startedAt || new Date() });
    } catch (e) {
      setErr(errorText(e));
    }
  }

  return (
    <ProtectedPage
      title="Issues"
      actions={
        <button className={BTN.primary} onClick={() => setShowNew(true)}>
          Report an issue
        </button>
      }
    >
      <div className="mb-4 flex gap-1">
        {[
          ["open", "Open (" + open.length + ")"],
          ["resolved", "Resolved"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              "rounded-md px-3 py-1.5 text-sm " +
              (tab === k
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100")
            }
          >
            {label}
          </button>
        ))}
      </div>
      {err && (
        <div className="mb-4">
          <Notice>{err}</Notice>
        </div>
      )}

      {!loaded.tasks ? (
        <Loading />
      ) : tab === "open" ? (
        open.length === 0 ? (
          <Empty>No open issues.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {open.map((t) => (
              <div key={t.id}>
                <TaskCard task={t} />
                {isSupervisor && t.status === "open" && (
                  <button
                    className="mt-2 text-sm text-brand-700 hover:underline"
                    onClick={() => resolve(t)}
                  >
                    Mark as resolved (supervisor)
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : resolved.length === 0 ? (
        <Empty>Nothing resolved yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {resolved.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">
                  {t.roomName} <span className="text-slate-500">{t.category}</span>
                </p>
                <p className="text-slate-600">{t.note}</p>
              </div>
              <div className="shrink-0 text-right">
                <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                <p className="mt-1 text-xs text-slate-400">{timeAgo(t.doneAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {showNew && <ReportIssueModal onClose={() => setShowNew(false)} />}
    </ProtectedPage>
  );
}
