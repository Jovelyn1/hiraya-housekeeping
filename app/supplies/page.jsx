"use client";

import { useState } from "react";
import ProtectedPage from "@/components/ProtectedPage";
import { useData } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import { useActions, errorText } from "@/hooks/useActions";
import { Badge, BTN, Empty, Field, INPUT, Loading, Modal, Notice } from "@/components/ui";
import { SUPPLY_CATEGORIES } from "@/lib/contract";
import { isLowStock } from "@/lib/logic";

function AddModal({ onClose }) {
  const actions = useActions();
  const [form, setForm] = useState({
    name: "",
    category: SUPPLY_CATEGORIES[0],
    unit: "pcs",
    stock: "0",
    minStock: "0",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await actions.addSupply({ ...form, name: form.name.trim() });
      onClose();
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <Modal title="Add supply item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input required value={form.name} onChange={set("name")} placeholder="Bath towel" className={INPUT} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={form.category} onChange={set("category")} className={INPUT}>
              {SUPPLY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit">
            <input value={form.unit} onChange={set("unit")} className={INPUT} />
          </Field>
          <Field label="Stock now">
            <input type="number" min="0" value={form.stock} onChange={set("stock")} className={INPUT} />
          </Field>
          <Field label="Warn me at or below">
            <input type="number" min="0" value={form.minStock} onChange={set("minStock")} className={INPUT} />
          </Field>
        </div>
        {err && <Notice>{err}</Notice>}
        <button className={BTN.primary + " w-full"} disabled={busy}>
          {busy ? "Saving..." : "Add item"}
        </button>
      </form>
    </Modal>
  );
}

function AdjustModal({ item, onClose }) {
  const actions = useActions();
  const [mode, setMode] = useState("used");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    const n = Number(qty);
    if (!n || n < 0) return setErr("Enter a quantity.");
    setBusy(true);
    setErr("");
    try {
      await actions.adjustSupply(item, mode === "used" ? -n : n, mode === "used" ? "used" : "restocked");
      onClose();
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <Modal title={item.name} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          In stock: {item.stock} {item.unit}
        </p>
        <div className="flex gap-2">
          {[
            ["used", "Used"],
            ["restock", "Restock"],
          ].map(([k, label]) => (
            <button
              type="button"
              key={k}
              onClick={() => setMode(k)}
              className={
                "flex-1 rounded-md px-3 py-2 text-sm " +
                (mode === k ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200")
              }
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="Quantity">
          <input
            type="number"
            min="1"
            autoFocus
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={INPUT}
          />
        </Field>
        {err && <Notice>{err}</Notice>}
        <button className={BTN.primary + " w-full"} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      </form>
    </Modal>
  );
}

export default function SuppliesPage() {
  const { isSupervisor } = useAuth();
  const { supplies, loaded, errors } = useData();
  const actions = useActions();
  const [showAdd, setShowAdd] = useState(false);
  const [adjust, setAdjust] = useState(null);
  const [err, setErr] = useState("");

  return (
    <ProtectedPage
      title="Supplies"
      actions={
        isSupervisor ? (
          <button className={BTN.primary} onClick={() => setShowAdd(true)}>
            Add item
          </button>
        ) : null
      }
    >
      {errors.supplies && (
        <div className="mb-4">
          <Notice>Could not load supplies ({errors.supplies}). Publish the Firestore rules for supplies.</Notice>
        </div>
      )}
      {err && (
        <div className="mb-4">
          <Notice>{err}</Notice>
        </div>
      )}
      {!loaded.supplies ? (
        <Loading />
      ) : supplies.length === 0 ? (
        <Empty>
          {isSupervisor
            ? "No supply items yet. Add towels, linens, toiletries and cleaning supplies."
            : "No supply items yet. Ask a supervisor to add them."}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">In stock</th>
                <th className="px-4 py-2 font-medium">Warn at</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {supplies.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-2 text-slate-600">{s.category}</td>
                  <td className="px-4 py-2 text-slate-800">
                    {s.stock} {s.unit}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {isSupervisor ? (
                      <button
                        className="underline decoration-dotted"
                        onClick={async () => {
                          const v = window.prompt("Warn when stock is at or below:", String(s.minStock || 0));
                          if (v === null) return;
                          setErr("");
                          try {
                            await actions.setMinStock(s, v);
                          } catch (e) {
                            setErr(errorText(e));
                          }
                        }}
                      >
                        {s.minStock || 0}
                      </button>
                    ) : (
                      s.minStock || 0
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isLowStock(s) ? <Badge tone="amber">Low</Badge> : <Badge tone="green">OK</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className={BTN.secondary} onClick={() => setAdjust(s)}>
                      Use / restock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
      {adjust && <AdjustModal item={adjust} onClose={() => setAdjust(null)} />}
    </ProtectedPage>
  );
}
