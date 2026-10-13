"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import ProtectedPage from "@/components/ProtectedPage";
import { Badge, Empty, INPUT, Loading, Notice } from "@/components/ui";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/contract";
import { toDate, fmtDateTime } from "@/lib/dates";

const APP_TONE = { housekeeping: "green", hub: "sky", bar: "amber", booking: "slate" };

// The shared activityLog: every Hiraya app writes here, so this is the cross-system feed.
export default function ActivityPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [app, setApp] = useState("");

  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.activity), orderBy("createdAt", "desc"), limit(200));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) }))),
      (e) => {
        setItems([]);
        setError(e.code || e.message);
      }
    );
  }, []);

  const apps = useMemo(() => [...new Set((items || []).map((i) => i.app).filter(Boolean))], [items]);
  const shown = (items || []).filter((i) => !app || i.app === app);

  return (
    <ProtectedPage
      supervisorOnly
      title="Activity"
      actions={
        <select value={app} onChange={(e) => setApp(e.target.value)} className={INPUT + " !w-44"}>
          <option value="">All systems</option>
          {apps.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      }
    >
      {error && (
        <div className="mb-4">
          <Notice>Could not load the activity log ({error}). Publish the Firestore rules.</Notice>
        </div>
      )}
      {items === null ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty>No activity yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {shown.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div>
                <Badge tone={APP_TONE[a.app] || "slate"} className="mr-2">
                  {a.app || "app"}
                </Badge>
                <span className="font-medium text-slate-800">{a.staffName || "Staff"}</span>
                <span className="text-slate-600">: {a.message || a.action}</span>
              </div>
              <span className="shrink-0 text-slate-400">{fmtDateTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </ProtectedPage>
  );
}
