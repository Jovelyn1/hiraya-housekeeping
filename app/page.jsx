"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import ProtectedPage from "@/components/ProtectedPage";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { Badge, Empty, Loading, Notice, StatCard, roomTone } from "@/components/ui";
import { db } from "@/lib/firebase";
import { COLLECTIONS, ROOM_STATUS_LABELS } from "@/lib/contract";
import { isActive, isLowStock, isOverdue, roomColumn, sortTasks } from "@/lib/logic";
import { fmtDateTime, sameDay, timeAgo } from "@/lib/dates";

function RecentActivity() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.activity), orderBy("createdAt", "desc"), limit(8));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
  }, []);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-medium text-slate-800">Recent activity</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((a) => (
            <li key={a.id} className="flex justify-between gap-3">
              <span className="text-slate-700">
                <span className="font-medium">{a.staffName || "Staff"}</span>: {a.message}
              </span>
              <span className="shrink-0 text-slate-400">{timeAgo(a.createdAt?.toDate?.() || null)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { actor, isSupervisor } = useAuth();
  const { rooms, tasks, supplies, arrivals, counts, loaded, errors, now } = useData();

  const s = useMemo(() => {
    const col = { dirty: 0, cleaning: 0, awaiting: 0, ready: 0 };
    rooms.forEach((r) => col[roomColumn(r)]++);
    const active = tasks.filter(isActive);
    const mine = sortTasks(active.filter((t) => actor && t.assignedTo === actor.uid));
    const pool = active.filter((t) => !t.assignedTo && t.status === "open" && t.type !== "maintenance-report");
    const doneToday = tasks.filter(
      (t) => actor && t.assignedTo === actor.uid && t.doneAt && sameDay(t.doneAt, now)
    ).length;
    // Rooms that must be ready soonest
    const urgent = rooms
      .filter((r) => r.cleaningStatus && r.cleaningStatus !== "inspected")
      .map((r) => ({ room: r, next: arrivals[r.id] }))
      .sort((a, b) => (a.next ? a.next.date.getTime() : Infinity) - (b.next ? b.next.date.getTime() : Infinity))
      .slice(0, 6);
    return {
      col,
      mine,
      pool: pool.length,
      doneToday,
      overdue: active.filter((t) => isOverdue(t, now)).length,
      openTasks: active.length,
      urgent,
    };
  }, [rooms, tasks, arrivals, actor, now]);

  const loading = !loaded.rooms || !loaded.tasks;
  const lowItems = supplies.filter(isLowStock).length;

  return (
    <ProtectedPage title={isSupervisor ? "Housekeeping today" : "My day"}>
      {errors.rooms || errors.tasks ? (
        <div className="mb-4">
          <Notice>
            Could not load data ({errors.rooms || errors.tasks}). Publish the Firestore rules in
            firestore.rules.housekeeping-additions.txt, then reload.
          </Notice>
        </div>
      ) : null}

      {loading ? (
        <Loading />
      ) : isSupervisor ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Dirty rooms" value={s.col.dirty} href="/board" tone={s.col.dirty ? "red" : undefined} />
            <StatCard label="Being cleaned" value={s.col.cleaning} href="/board" />
            <StatCard
              label="Awaiting inspection"
              value={s.col.awaiting}
              href="/inspections"
              tone={s.col.awaiting ? "amber" : undefined}
            />
            <StatCard label="Ready rooms" value={s.col.ready} href="/board" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Open tasks" value={s.openTasks} href="/tasks" />
            <StatCard label="Overdue" value={s.overdue} href="/tasks" tone={s.overdue ? "red" : undefined} />
            <StatCard label="Open issues" value={counts.issues} href="/issues" />
            <StatCard label="Low supplies" value={lowItems} href="/supplies" tone={lowItems ? "amber" : undefined} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-medium text-slate-800">Rooms to get ready first</h2>
              {s.urgent.length === 0 ? (
                <p className="text-sm text-slate-500">Every room is ready.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {s.urgent.map(({ room, next }) => (
                    <li key={room.id} className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-800">{room.name}</span>
                      <span className="flex items-center gap-2">
                        {next && (
                          <span className="text-slate-500">
                            {sameDay(next.date, now) ? "Guest today" : "Next guest " + fmtDateTime(next.date)}
                          </span>
                        )}
                        <Badge tone={roomTone(room.cleaningStatus)}>
                          {ROOM_STATUS_LABELS[room.cleaningStatus]}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <RecentActivity />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="My open tasks" value={s.mine.length} href="/my-tasks" />
            <StatCard label="Available to take" value={s.pool} href="/my-tasks" />
            <StatCard label="Done today" value={s.doneToday} />
          </div>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-medium text-slate-800">Next up</h2>
            {s.mine.length === 0 ? (
              <Empty>No tasks assigned to you. Open My tasks to take one.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {s.mine.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{t.roomName}</span>
                    <span className="text-slate-500">{t.type.replace("-", " ")}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/my-tasks"
              className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Go to my tasks
            </Link>
          </div>
        </>
      )}
    </ProtectedPage>
  );
}
