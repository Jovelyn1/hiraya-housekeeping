"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/contract";

const AuthContext = createContext(null);

// Roles that may use the Housekeeping app. Everyone shares the staff/{uid} document
// created in the Operations Hub.
const ALLOWED_ROLES = ["housekeeping", "admin"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // staff/{uid}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.staff, fbUser.uid));
        if (!snap.exists() || snap.data().active === false) {
          setError("This account is not set up as active staff. Ask an admin to add you in the Hub.");
          await signOut(auth);
          setUser(null);
          setProfile(null);
        } else {
          setError("");
          setUser(fbUser);
          setProfile({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        setError("Could not read your staff profile. Check the Firestore rules for the staff collection.");
        await signOut(auth);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email, password) => {
    setError("");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const role = profile?.role || null;
  const allowed = !!role && ALLOWED_ROLES.includes(role);
  // Admins supervise. A housekeeping account becomes a supervisor with staff/{uid}.supervisor = true
  const isSupervisor = allowed && (role === "admin" || profile?.supervisor === true);
  const actor = user ? { uid: user.uid, name: profile?.name || user.email || "Staff" } : null;

  const value = {
    user,
    profile,
    role,
    allowed,
    isSupervisor,
    actor,
    loading,
    error,
    setError,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
