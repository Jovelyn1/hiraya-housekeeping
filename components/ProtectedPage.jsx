"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import Shell from "./Shell";

// Wrap every page in this. Signed-out visitors go to /login; roles that are not allowed
// (or not a supervisor, on supervisor pages) get a plain message.
export default function ProtectedPage({ supervisorOnly = false, title, actions, children }) {
  const { user, allowed, isSupervisor, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
          <p>This app is for housekeeping staff and admins. Your role does not have access.</p>
          <button
            onClick={logout}
            className="mt-4 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-900"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      {supervisorOnly && !isSupervisor ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
          This page is for supervisors.
        </div>
      ) : (
        <>
          {(title || actions) && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              {title ? <h1 className="text-2xl font-semibold text-slate-800">{title}</h1> : <span />}
              {actions}
            </div>
          )}
          {children}
        </>
      )}
    </Shell>
  );
}
