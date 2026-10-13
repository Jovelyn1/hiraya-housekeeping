"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { cx } from "./ui";

// supervisor: only supervisors see the page. badge: a live count shown next to the label.
const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/my-tasks", label: "My tasks", badge: "myTasks" },
  { href: "/board", label: "Room board", supervisor: true },
  { href: "/tasks", label: "All tasks", supervisor: true },
  { href: "/inspections", label: "Inspections", supervisor: true, badge: "inspections" },
  { href: "/issues", label: "Issues", badge: "issues" },
  { href: "/lost-found", label: "Lost & found" },
  { href: "/supplies", label: "Supplies", badge: "lowStock" },
  { href: "/reports", label: "Reports", supervisor: true },
  { href: "/team", label: "Team", supervisor: true },
  { href: "/activity", label: "Activity", supervisor: true },
  { href: "/settings", label: "Settings", supervisor: true },
];

export default function Shell({ children }) {
  const { profile, role, isSupervisor, logout } = useAuth();
  const { counts } = useData();
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.supervisor || isSupervisor);
  const roleLabel = role === "admin" ? "Admin" : isSupervisor ? "Supervisor" : "Housekeeping";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-lg font-semibold text-brand-700">Hiraya Housekeeping</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">
                {profile?.name || "Staff"}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {roleLabel}
                </span>
              </span>
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          </div>
          <nav className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-1">
            {items.map((i) => {
              const active = pathname === i.href;
              const n = i.badge ? counts[i.badge] : 0;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                    active
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {i.label}
                  {n > 0 ? (
                    <span className="rounded-full bg-brand-600 px-1.5 text-xs font-medium text-white">
                      {n}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
