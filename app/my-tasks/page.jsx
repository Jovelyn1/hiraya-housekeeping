"use client";

import { useMemo, useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import TaskCard from "@/components/TaskCard";
import { ReportIssueModal } from "@/components/Modals";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { BTN, Empty, Loading } from "@/components/ui";
import { isActive, sortTasks } from "@/lib/logic";
import { sameDay } from "@/lib/dates";

export default function MyTasksPage() {
  const { actor } = useAuth();
  const { tasks, loaded, now } = useData();
  const [showIssue, setShowIssue] = useState(false);
  const uid = actor ? actor.uid : null;

  const { mine, pool, doneToday } = useMemo(() => {
    const active = tasks.filter(isActive);
    return {
      mine: sortTasks(active.filter((t) => t.assignedTo === uid)),
      pool: sortTasks(
        active.filter((t) => t.status === "open" && !t.assignedTo && t.type !== "maintenance-report")
      ),
      doneToday: tasks.filter(
        (t) => t.assignedTo === uid && t.doneAt && sameDay(t.doneAt, now) && !isActive(t)
      ),
    };
  }, [tasks, uid, now]);

  return (
    <ProtectedPage
      title="My tasks"
      actions={
        <button className={BTN.secondary} onClick={() => setShowIssue(true)}>
          Report an issue
        </button>
      }
    >
      {!loaded.tasks ? (
        <Loading />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-medium text-slate-800">Assigned to me ({mine.length})</h2>
            {mine.length === 0 ? (
              <Empty>Nothing assigned to you right now.</Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {mine.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-medium text-slate-800">Available to take ({pool.length})</h2>
            {pool.length === 0 ? (
              <Empty>No open tasks. New check-outs appear here by themselves.</Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pool.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            )}
          </section>

          {doneToday.length > 0 && (
            <section>
              <h2 className="mb-3 font-medium text-slate-800">Finished today ({doneToday.length})</h2>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
                {doneToday.map((t) => (
                  <li key={t.id} className="flex justify-between px-4 py-2">
                    <span className="text-slate-800">{t.roomName}</span>
                    <span className="text-slate-500">
                      {t.durationMin ? t.durationMin + " min" : "-"}
                      {t.status === "done" ? " · waiting for inspection" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      {showIssue && <ReportIssueModal onClose={() => setShowIssue(false)} />}
    </ProtectedPage>
  );
}
