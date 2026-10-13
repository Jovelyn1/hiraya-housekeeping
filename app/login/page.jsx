"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { user, loading, error, login, setError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setLocalError("");
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err) {
      const code = err?.code || "";
      if (
        code.includes("invalid-credential") ||
        code.includes("wrong-password") ||
        code.includes("user-not-found")
      ) {
        setLocalError("Wrong email or password.");
      } else if (code.includes("too-many-requests")) {
        setLocalError("Too many attempts. Wait a few minutes and try again.");
      } else {
        setLocalError("Could not sign in. Please try again.");
      }
    }
    setBusy(false);
  }

  const shownError = localError || error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold text-brand-700">Hiraya Housekeeping</h1>
          <p className="text-sm text-slate-500">Staff sign in</p>
        </div>

        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
          />
        </label>

        {shownError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{shownError}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
