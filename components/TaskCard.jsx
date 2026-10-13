"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { Badge, BTN, INPUT, Notice, priorityTone, taskTone } from "./ui";
import { TASK_TYPES } from "@/lib/contract";
import { checklistProgress, isOverdue, taskStatusLabel } from "@/lib/logic";
import { fmtDateTime, timeAgo } from "@/lib/dates";

// One task as a card. The buttons shown depend on the task's status and who is looking.
export default function TaskCard({ task }) {
  const { actor, isSupervisor } = useAuth();
  const { now, arrivals } = useData();
  const actions = useActions();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState(task.note || "");

  const type = TASK_TYPES[task.type] || { label: task.type };
  const mine = !!actor && task.assignedTo === actor.uid;
  const progress = checklistProgress(task);
  const overdue = isOverdue(task, now);
  const next = task.roomId ? arrivals[task.roomId] : null;
  const working = task.status === "in-progress" && (mine || isSupervisor);

  async function run(fn) {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(errorText(e));
    }
    setBusy(false);
  }

  function finish() {
    if (progress.total && progress.done < progress.total) {
      if (!window.confirm(progress.total - progress.done + " checklist item(s) are not ticked. Mark as done anyway?")) {
        return;
      }
    }
    run(() => actions.completeTask(task));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-800">{task.roomName || "Room"}</p>
          <p className="text-sm text-slate-500">{type.label}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {task.priority !== "normal" && <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>}
          {overdue && <Badge tone="red">Overdue</Badge>}
          <Badge tone={taskTone(task.status)}>{taskStatusLabel(task)}</Badge>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {task.dueBy && (
          <>
            <dt className="text-slate-500">Ready by</dt>
            <dd className="text-slate-800">{fmtDateTime(task.dueBy)}</dd>
          </>
        )}
        {!task.dueBy && next && (
          <>
            <dt className="text-slate-500">Next guest</dt>
            <dd className="text-slate-800">{fmtDateTime(next.date)}</dd>
          </>
        )}
        {task.assignedToName ? (
          <>
            <dt className="text-slate-500">Assigned to</dt>
            <dd className="text-slate-800">{task.assignedToName}</dd>
          </>
        ) : null}
        {task.category ? (
          <>
            <dt className="text-slate-500">Category</dt>
            <dd className="text-slate-800">{task.category}</dd>
          </>
        ) : null}
        {task.createdAt ? (
          <>
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-800">{timeAgo(task.createdAt)}</dd>
          </>
        ) : null}
      </dl>

      {task.blocksRoom && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          This issue blocks the room from being used.
        </p>
      )}
      {task.inspectionNote && task.status === "open" && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Sent back by the supervisor: {task.inspectionNote}
        </p>
      )}
      {task.note && !working && <p className="mt-3 text-sm text-slate-600">{task.note}</p>}

      {working && task.checklist.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Checklist {progress.done}/{progress.total}
          </p>
          <ul className="space-y-1">
            {task.checklist.map((item, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={!!item.done}
                    onChange={() => run(() => actions.toggleChecklistItem(task, i))}
                  />
                  <span className={item.done ? "text-slate-400 line-through" : "text-slate-800"}>
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {working && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (task.note || "") && run(() => actions.saveTaskNote(task, note))}
          placeholder="Add a note (left items, damage, supplies needed)"
          rows={2}
          className={INPUT + " mt-3"}
        />
      )}

      {err && (
        <div className="mt-3">
          <Notice>{err}</Notice>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {task.status === "open" && !task.assignedTo && (
          <button className={BTN.big} disabled={busy} onClick={() => run(() => actions.claimTask(task))}>
            {busy ? "Please wait..." : "Take this task"}
          </button>
        )}
        {task.status === "open" && mine && (
          <button className={BTN.big} disabled={busy} onClick={() => run(() => actions.startTask(task))}>
            {busy ? "Please wait..." : task.startedAt ? "Continue" : "Start"}
          </button>
        )}
        {working && (
          <button className={BTN.big} disabled={busy} onClick={finish}>
            {busy ? "Please wait..." : task.type === "maintenance-report" ? "Mark resolved" : "Mark done"}
          </button>
        )}
        {task.status === "done" && (
          <p className="text-sm text-sky-700">Finished. Waiting for the supervisor to inspect the room.</p>
        )}
      </div>
    </div>
  );
}
