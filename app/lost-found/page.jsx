"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import ProtectedPage from "@/components/ProtectedPage";
import { useData } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { Badge, BTN, Empty, Field, INPUT, Loading, Modal, Notice } from "@/components/ui";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/contract";
import { toDate, timeAgo } from "@/lib/dates";

const STATUS_TONE = { stored: "amber", claimed: "green", disposed: "slate" };

function AddModal({ onClose }) {
  const { rooms } = useData();
  const actions = useActions();
  const [form, setForm] = useState({ item: "", description: "", roomId: "", storedAt: "Front desk" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const room = rooms.find((r) => r.id === form.roomId);
      await actions.addLostItem({
        item: form.item.trim(),
        description: form.description.trim(),
        roomId: form.roomId,
        roomName: room ? room.name : "",
        storedAt: form.storedAt.trim(),
      });
      onClose();
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <Modal title="Log a found item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="What was found?">
          <input required value={form.item} onChange={set("item")} placeholder="Black wallet" className={INPUT} />
        </Field>
        <Field label="Details (color, brand, where exactly)">
          <textarea rows={2} value={form.description} onChange={set("description")} className={INPUT} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Found in room">
            <select value={form.roomId} onChange={set("roomId")} className={INPUT}>
              <option value="">Not in a room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stored at">
            <input value={form.storedAt} onChange={set("storedAt")} className={INPUT} />
          </Field>
        </div>
        {err && <Notice>{err}</Notice>}
        <button className={BTN.primary + " w-full"} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      </form>
    </Modal>
  );
}

export default function LostFoundPage() {
  const { isSupervisor } = useAuth();
  const actions = useActions();
  const [items, setItems] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("stored");
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.lostFound), orderBy("createdAt", "desc"), limit(200));
    return onSnapshot(
      q,
      (snap) =>
        setItems(
          snap.docs.map((d) => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) }))
        ),
      (e) => {
        setItems([]);
        setLoadErr(e.code || e.message);
      }
    );
  }, []);

  async function run(fn) {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(errorText(e));
    }
  }

  const shown = (items || []).filter((i) => (tab === "all" ? true : i.status === tab));

  return (
    <ProtectedPage
      title="Lost & found"
      actions={
        <button className={BTN.primary} onClick={() => setShowAdd(true)}>
          Log found item
        </button>
      }
    >
      <div className="mb-4 flex gap-1">
        {[
          ["stored", "Being kept"],
          ["claimed", "Claimed"],
          ["disposed", "Disposed"],
          ["all", "All"],
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
      {loadErr && (
        <div className="mb-4">
          <Notice>Could not load ({loadErr}). Publish the Firestore rules for lostFound.</Notice>
        </div>
      )}
      {err && (
        <div className="mb-4">
          <Notice>{err}</Notice>
        </div>
      )}

      {items === null ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty>No items here.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((i) => (
            <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{i.item}</p>
                  {i.description && <p className="text-sm text-slate-600">{i.description}</p>}
                </div>
                <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {i.roomName ? "Found in " + i.roomName + " · " : ""}
                by {i.foundByName || "staff"} · {timeAgo(i.createdAt)}
                {i.storedAt ? " · kept at " + i.storedAt : ""}
              </p>
              {i.status === "claimed" && i.claimedBy && (
                <p className="mt-1 text-sm text-emerald-700">Claimed by {i.claimedBy}</p>
              )}
              {i.status === "stored" && (
                <div className="mt-3 flex gap-2">
                  <button
                    className={BTN.secondary}
                    onClick={() => {
                      const who = window.prompt("Who claimed it? (guest name)");
                      if (who) {
                        run(() =>
                          actions.updateLostItem(
                            i,
                            { status: "claimed", claimedBy: who, claimedAt: new Date() },
                            i.item + " claimed by " + who
                          )
                        );
                      }
                    }}
                  >
                    Mark claimed
                  </button>
                  {isSupervisor && (
                    <button
                      className={BTN.secondary}
                      onClick={() =>
                        window.confirm("Mark " + i.item + " as disposed?") &&
                        run(() => actions.updateLostItem(i, { status: "disposed" }, i.item + " disposed"))
                      }
                    >
                      Dispose
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </ProtectedPage>
  );
}
