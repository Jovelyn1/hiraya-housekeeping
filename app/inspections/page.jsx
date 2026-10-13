"use client";

import { useMemo, useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import { SendBackModal } from "@/components/Modals";
import { useData } from "@/components/DataProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { Badge, BTN, Empty, Loading, Notice } from "@/components/ui";
import { TASK_TYPES } from "@/lib/contract";
import { checklistProgress } from "@/lib/logic";
import { minutesLabel, timeAgo } from "@/lib/dates";

function InspectionCard({ task, onSendBack }) {
  const actions = useActions();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const p = checklistProgress(task);

  async function pass() {
    setBusy(true);
    setErr("");
    try {
      await actions.inspectTask(task, { pass: true });
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-800">{task.roomName}</p>
          <p className="text-sm text-slate-500">{TASK_TYPES[task.type]?.label}</p>
        </div>
        {task.rejectedCount > 0 && <Badge tone="amber">Sent back {task.rejectedCount}x before</Badge>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Cleaned by</dt>
        <dd className="text-slate-800">{task.assignedToName || "-"}</dd>
        <dt className="text-slate-500">Finished</dt>
        <dd className="text-slate-800">{timeAgo(task.doneAt)}</dd>
        <dt className="text-slate-500">Time taken</dt>
        <dd className="text-slate-800">{minutesLabel(task.durationMin)}</dd>
        <dt className="text-slate-500">Checklist</dt>
        <dd className="text-slate-800">
          {p.total ? p.done + " of " + p.total + " ticked" : "-"}
        </dd>
      </dl>
      {task.note && <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{task.note}</p>}
      {err && (
        <div className="mt-3">
          <Notice>{err}</Notice>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className={BTN.primary} disabled={busy} onClick={pass}>
          {busy ? "Saving..." : "Pass: room is ready"}
        </button>
        <button className={BTN.secondary} disabled={busy} onClick={() => onSendBack(task)}>
          Send back
        </button>
      </div>
    </div>
  );
}

export default function InspectionsPage() {
  const { tasks, loaded, requireInspection } = useData();
  const [sendBack, setSendBack] = useState(null);

  const { waiting, recent } = useMemo(
    () => ({
      waiting: tasks
        .filter((t) => t.status === "done")
        .sort((a, b) => (a.doneAt?.getTime() ?? 0) - (b.doneAt?.getTime() ?? 0)),
      recent: tasks
        .filter((t) => t.status === "inspected" && t.inspectedBy && t.inspectedBy !== "auto")
        .sort((a, b) => (b.inspectedAt?.getTime() ?? 0) - (a.inspectedAt?.getTime() ?? 0))
        .slice(0, 10),
    }),
    [tasks]
  );

  return (
    <ProtectedPage supervisorOnly title="Inspections">
      {!requireInspection && (
        <div className="mb-4">
          <Notice tone="warn">
            Inspection is switched off in Settings, so new cleanings go straight to Ready. Rooms listed here
            were finished before it was switched off.
          </Notice>
        </div>
      )}
      {!loaded.tasks ? (
        <Loading />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-medium text-slate-800">Waiting for inspection ({waiting.length})</h2>
            {waiting.length === 0 ? (
              <Empty>No rooms waiting. Finished rooms appear here.</Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {waiting.map((t) => (
                  <InspectionCard key={t.id} task={t} onSendBack={setSendBack} />
                ))}
              </div>
            )}
          </section>

          {recent.length > 0 && (
            <section>
              <h2 className="mb-3 font-medium text-slate-800">Recently inspected</h2>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
                {recent.map((t) => (
                  <li key={t.id} className="flex justify-between px-4 py-2">
                    <span className="text-slate-800">
                      {t.roomName} <span className="text-slate-500">cleaned by {t.assignedToName || "-"}</span>
                    </span>
                    <span className="text-slate-500">{timeAgo(t.inspectedAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      {sendBack && <SendBackModal task={sendBack} onClose={() => setSendBack(null)} />}
    </ProtectedPage>
  );
}
