"use client";

// Small shared UI pieces. Same look as the Operations Hub: slate neutrals, brand green accent.
import { useEffect } from "react";
import Link from "next/link";

export const cx = (...a) => a.filter(Boolean).join(" ");

export const BTN = {
  primary:
    "rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60",
  secondary:
    "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60",
  danger:
    "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60",
  big: "w-full rounded-lg bg-brand-600 px-4 py-3 text-base font-medium text-white hover:bg-brand-700 disabled:opacity-60",
};

export const INPUT =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";

const TONES = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
  sky: "bg-sky-100 text-sky-800",
  brand: "bg-brand-100 text-brand-700",
};

export function Badge({ tone = "slate", children, className }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone] || TONES.slate,
        className
      )}
    >
      {children}
    </span>
  );
}

export const priorityTone = (p) => (p === "urgent" ? "red" : p === "high" ? "amber" : "slate");
export const taskTone = (status) =>
  ({ open: "slate", "in-progress": "amber", done: "sky", inspected: "green", cancelled: "slate" })[status] ||
  "slate";
export const roomTone = (status) =>
  ({ dirty: "red", cleaning: "amber", clean: "sky", inspected: "green" })[status] || "green";

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cx(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
      {children}
    </p>
  );
}

export function Notice({ tone = "error", children }) {
  const styles = {
    error: "bg-red-50 text-red-700",
    ok: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-800",
  };
  return <p className={cx("rounded-md px-3 py-2 text-sm", styles[tone])}>{children}</p>;
}

export function Loading({ children = "Loading..." }) {
  return <p className="text-slate-500">{children}</p>;
}

export function StatCard({ label, value, hint, href, tone }) {
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={cx(
          "mt-1 text-3xl font-semibold",
          tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-slate-800"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );
  const cls = "rounded-xl border border-slate-200 bg-white p-5";
  return href ? (
    <Link href={href} className={cx(cls, "hover:border-brand-500")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
