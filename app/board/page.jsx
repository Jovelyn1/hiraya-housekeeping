"use client";

import { useMemo, useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import { NewTaskModal } from "@/components/Modals";
import { useData } from "@/components/DataProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { Badge, BTN, INPUT, Loading, Notice, cx, roomTone } from "@/components/ui";
import { ROOM_STATUS_LABELS, TASK_TYPES } from "@/lib/contract";
import { isActive, roomColumn, taskStatusLabel } from "@/lib/logic";
import { fmtDateTime, sameDay } from "@/lib/dates";

const COLUMNS = [
  { key: "dirty", label: "Dirty", head: "text-red-700", box: "border-red-200 bg-red-50/40" },
  { key: "cleaning", label: "Being cleaned", head: "text-amber-700", box: "border-amber-200 bg-amber-50/40" },
  { key: "awaiting", label: "Awaiting inspection", head: "text-sky-700", box: "border-sky-200 bg-sky-50/40" },
  { key: "ready", label: "Ready", head: "text-brand-700", box: "border-brand-100 bg-brand-50/60" },
];

function RoomCard({ room, tasks, next, now, onAddTask }) {
  const actions = useActions();
  const [err, setErr] = useState("");

  const roomTasks = tasks.filter((t) => t.roomId === room.id);
  const clean = roomTasks.find((t) => isActive(t) || t.status === "done");
  const issue = roomTasks.find((t) => t.type === "maintenance-report" && isActive(t));
  const blocked = roomTasks.some((t) => t.type === "maintenance-report" && isActive(t) && t.blocksRoom);

  async function changeStatus(e) {
    const status = e.target.value;
    e.target.value = "";
    if (!status) return;
    if (!window.confirm(room.name + " will be set to " + ROOM_STATUS_LABELS[status] + " by hand. Continue?")) return;
    try {
      await actions.setRoomStatus(room, status);
    } catch (e2) {
      setErr(errorText(e2));
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800">{room.name}</p>
          {room.type ? <p className="text-xs text-slate-500">{room.type}</p> : null}
        </div>
        {blocked ? (
          <Badge tone="red">Blocked</Badge>
        ) : (
          <Badge tone={roomTone(room.cleaningStatus)}>
            {ROOM_STATUS_LABELS[room.cleaningStatus] || "Ready"}
          </Badge>
        )}
      </div>

      {next && (
        <p className={cx("mt-2 text-xs", sameDay(next.date, now) ? "font-medium text-amber-700" : "text-slate-500")}>
          {sameDay(next.date, now) ? "Guest arrives today" : "Next guest " + fmtDateTime(next.date)}
        </p>
      )}
      {clean && (
        <p className="mt-2 text-xs text-slate-600">
          {TASK_TYPES[clean.type]?.label}: {taskStatusLabel(clean)}
          {clean.assignedToName ? " · " + clean.assignedToName : ""}
        </p>
      )}
      {issue && (
        <p className="mt-1 text-xs text-red-700">
          {blocked ? "Blocked: " : "Issue: "}
          {issue.category || "maintenance"}
        </p>
      )}
      {err && (
        <div className="mt-2">
          <Notice>{err}</Notice>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button className={BTN.secondary + " !px-2 !py-1 text-xs"} onClick={() => onAddTask(room.id)}>
          + Task
        </button>
        <select
          defaultValue=""
          onChange={changeStatus}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600"
        >
          <option value="">Set status...</option>
          {Object.entries(ROOM_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { rooms, tasks, arrivals, loaded, now } = useData();
  const [search, setSearch] = useState("");
  const [newFor, setNewFor] = useState(null); // room id, or "" for no preset

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const g = { dirty: [], cleaning: [], awaiting: [], ready: [] };
    rooms
      .filter((r) => !q || String(r.name).toLowerCase().includes(q))
      .forEach((r) => g[roomColumn(r)].push(r));
    // Rooms with the soonest arrival first
    Object.values(g).forEach((list) =>
      list.sort(
        (a, b) =>
          (arrivals[a.id] ? arrivals[a.id].date.getTime() : Infinity) -
          (arrivals[b.id] ? arrivals[b.id].date.getTime() : Infinity)
      )
    );
    return g;
  }, [rooms, search, arrivals]);

  return (
    <ProtectedPage
      supervisorOnly
      title="Room board"
      actions={
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room"
            className={INPUT + " !w-44"}
          />
          <button className={BTN.primary} onClick={() => setNewFor("")}>
            New task
          </button>
        </div>
      }
    >
      {!loaded.rooms ? (
        <Loading />
      ) : rooms.length === 0 ? (
        <Notice tone="warn">
          No rooms found. The rooms come from the booking system's rooms collection. Check Settings, then
          Connection check.
        </Notice>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((c) => (
            <div key={c.key} className={cx("rounded-xl border p-3", c.box)}>
              <h2 className={cx("mb-3 flex items-center justify-between text-sm font-semibold", c.head)}>
                {c.label}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
                  {grouped[c.key].length}
                </span>
              </h2>
              <div className="space-y-3">
                {grouped[c.key].map((r) => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    tasks={tasks}
                    next={arrivals[r.id]}
                    now={now}
                    onAddTask={setNewFor}
                  />
                ))}
                {grouped[c.key].length === 0 && <p className="text-xs text-slate-400">No rooms.</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {newFor !== null && <NewTaskModal roomId={newFor} onClose={() => setNewFor(null)} />}
    </ProtectedPage>
  );
}
