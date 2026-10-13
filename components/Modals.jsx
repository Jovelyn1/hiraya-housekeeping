"use client";

import { useState } from "react";
import { Modal, Field, INPUT, BTN, Notice } from "./ui";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { ISSUE_CATEGORIES, PRIORITIES, TASK_TYPES } from "@/lib/contract";

// Supervisor: create any task, optionally for one room and one cleaner.
export function NewTaskModal({ onClose, roomId = "" }) {
  const { isSupervisor } = useAuth();
  const { rooms, crew } = useData();
  const actions = useActions();
  const [form, setForm] = useState({
    roomId,
    type: "deep-clean",
    priority: "normal",
    assignedTo: "",
    dueBy: "",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!form.roomId) return setErr("Choose a room.");
    setBusy(true);
    setErr("");
    try {
      const member = crew.find((c) => c.id === form.assignedTo);
      await actions.createTask({
        roomId: form.roomId,
        type: form.type,
        priority: form.priority,
        note: form.note.trim(),
        dueBy: form.dueBy ? new Date(form.dueBy) : null,
        assignedTo: member ? member.id : null,
        assignedToName: member ? member.name : "",
      });
      onClose();
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Room">
          <select required value={form.roomId} onChange={set("roomId")} className={INPUT}>
            <option value="">Choose a room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Task type">
          <select value={form.type} onChange={set("type")} className={INPUT}>
            {Object.entries(TASK_TYPES)
              .filter(([k]) => k !== "maintenance-report")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select value={form.priority} onChange={set("priority")} className={INPUT}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assign to">
            <select
              value={form.assignedTo}
              onChange={set("assignedTo")}
              disabled={!isSupervisor}
              className={INPUT}
            >
              <option value="">Anyone (open pool)</option>
              {crew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Ready by (optional)">
          <input type="datetime-local" value={form.dueBy} onChange={set("dueBy")} className={INPUT} />
        </Field>
        <Field label="Note (optional)">
          <textarea rows={2} value={form.note} onChange={set("note")} className={INPUT} />
        </Field>
        {err && <Notice>{err}</Notice>}
        <button className={BTN.primary + " w-full"} disabled={busy}>
          {busy ? "Saving..." : "Create task"}
        </button>
      </form>
    </Modal>
  );
}

// Anyone: report a maintenance problem found while cleaning.
export function ReportIssueModal({ onClose }) {
  const { rooms } = useData();
  const actions = useActions();
  const [form, setForm] = useState({
    roomId: "",
    category: ISSUE_CATEGORIES[0],
    priority: "normal",
    blocksRoom: false,
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!form.roomId) return setErr("Choose a room.");
    if (!form.note.trim()) return setErr("Describe the problem.");
    setBusy(true);
    setErr("");
    try {
      await actions.createTask({
        roomId: form.roomId,
        type: "maintenance-report",
        priority: form.priority,
        category: form.category,
        blocksRoom: form.blocksRoom,
        note: form.note.trim(),
      });
      onClose();
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <Modal title="Report an issue" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Room">
          <select required value={form.roomId} onChange={set("roomId")} className={INPUT}>
            <option value="">Choose a room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={form.category} onChange={set("category")} className={INPUT}>
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={set("priority")} className={INPUT}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="What is wrong?">
          <textarea
            rows={3}
            value={form.note}
            onChange={set("note")}
            placeholder="Example: shower drain is blocked, water does not go down"
            className={INPUT}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.blocksRoom}
            onChange={(e) => setForm({ ...form, blocksRoom: e.target.checked })}
          />
          The room cannot be used until this is fixed
        </label>
        {err && <Notice>{err}</Notice>}
        <button className={BTN.primary + " w-full"} disabled={busy}>
          {busy ? "Sending..." : "Send report"}
        </button>
      </form>
    </Modal>
  );
}

// Supervisor: ask for the reason before sending a room back to be cleaned again.
export function SendBackModal({ task, onClose }) {
  const actions = useActions();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!note.trim()) return setErr("Write what needs to be redone.");
    setBusy(true);
    try {
      await actions.inspectTask(task, { pass: false, note: note.trim() });
      onClose();
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <Modal title={"Send back " + (task.roomName || "room")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="What needs to be redone?">
          <textarea
            rows={3}
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Example: bathroom mirror has streaks, towels missing"
            className={INPUT}
          />
        </Field>
        {err && <Notice>{err}</Notice>}
        <button className={BTN.danger + " w-full py-2"} disabled={busy}>
          {busy ? "Sending back..." : "Send back to cleaner"}
        </button>
      </form>
    </Modal>
  );
}
