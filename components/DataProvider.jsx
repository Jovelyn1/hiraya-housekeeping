"use client";

// One set of live listeners for the whole app. Every page reads from here, so a change made by
// the Hub, the booking site or another cleaner shows up everywhere within a second.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, SETTINGS_DOC, TASK_STATUS } from "@/lib/contract";
import { toDate } from "@/lib/dates";
import { listenToArrivingBookings } from "@/lib/bookings";
import { isActive, isLowStock, naturalCompare, nextArrivalByRoom } from "@/lib/logic";
import { useAuth } from "./AuthProvider";

const DataContext = createContext(null);

export function normalizeTask(id, d) {
  return {
    ...d,
    id,
    checklist: Array.isArray(d.checklist) ? d.checklist : [],
    createdAt: toDate(d.createdAt),
    startedAt: toDate(d.startedAt),
    doneAt: toDate(d.doneAt),
    inspectedAt: toDate(d.inspectedAt),
    dueBy: toDate(d.dueBy),
  };
}

export function DataProvider({ children }) {
  const { user, allowed, isSupervisor, actor } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [supplies, setSupplies] = useState([]);
  const [crew, setCrew] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loaded, setLoaded] = useState({});
  const [errors, setErrors] = useState({});
  const [now, setNow] = useState(() => new Date());

  // Keeps "overdue" and "time ago" fresh
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const uid = user ? user.uid : null;

  useEffect(() => {
    if (!uid || !allowed) return undefined;
    const unsubs = [];

    const done = (key) => setLoaded((l) => ({ ...l, [key]: true }));
    const ok = (key) => setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    const fail = (key) => (err) => {
      done(key);
      setErrors((e) => ({ ...e, [key]: err.code || err.message || "error" }));
    };
    const listen = (key, q, onData) =>
      unsubs.push(
        onSnapshot(
          q,
          (snap) => {
            onData(snap);
            done(key);
            ok(key);
          },
          fail(key)
        )
      );

    listen("rooms", collection(db, COLLECTIONS.rooms), (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return { ...data, id: d.id, name: data.name || data.roomName || data.title || d.id };
      });
      list.sort((a, b) => naturalCompare(a.name, b.name));
      setRooms(list);
    });

    // The 500 newest tasks: plenty for a resort, and no extra Firestore index needed
    listen(
      "tasks",
      query(collection(db, COLLECTIONS.tasks), orderBy("createdAt", "desc"), limit(500)),
      (snap) => setTasks(snap.docs.map((d) => normalizeTask(d.id, d.data())))
    );

    unsubs.push(
      onSnapshot(
        doc(db, COLLECTIONS.settings, SETTINGS_DOC),
        (snap) => {
          setSettings(snap.exists() ? snap.data() : {});
          done("settings");
          ok("settings");
        },
        fail("settings")
      )
    );

    listen("supplies", collection(db, COLLECTIONS.supplies), (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      list.sort((a, b) => naturalCompare(a.name, b.name));
      setSupplies(list);
    });

    if (isSupervisor) {
      listen(
        "crew",
        query(collection(db, COLLECTIONS.staff), where("role", "==", "housekeeping")),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          list.sort((a, b) => naturalCompare(a.name || "", b.name || ""));
          setCrew(list);
        }
      );
      unsubs.push(
        listenToArrivingBookings(
          (list) => {
            setBookings(list);
            done("bookings");
            ok("bookings");
          },
          fail("bookings")
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
      setRooms([]);
      setTasks([]);
      setSettings(null);
      setSupplies([]);
      setCrew([]);
      setBookings([]);
      setLoaded({});
      setErrors({});
    };
  }, [uid, allowed, isSupervisor]);

  const roomsById = useMemo(() => {
    const m = {};
    rooms.forEach((r) => (m[r.id] = r));
    return m;
  }, [rooms]);

  const tasksById = useMemo(() => {
    const m = {};
    tasks.forEach((t) => (m[t.id] = t));
    return m;
  }, [tasks]);

  const arrivals = useMemo(() => nextArrivalByRoom(bookings, rooms, now), [bookings, rooms, now]);

  // Set to false in Settings to skip the supervisor's inspection step
  const requireInspection = !settings || settings.requireInspection !== false;

  const counts = useMemo(() => {
    const mine = actor ? actor.uid : null;
    return {
      myTasks: tasks.filter((t) => isActive(t) && t.assignedTo === mine).length,
      inspections: tasks.filter((t) => t.status === TASK_STATUS.DONE).length,
      issues: tasks.filter((t) => t.type === "maintenance-report" && isActive(t)).length,
      lowStock: supplies.filter(isLowStock).length,
    };
  }, [tasks, supplies, actor]);

  const value = {
    rooms,
    roomsById,
    tasks,
    tasksById,
    settings,
    supplies,
    crew,
    bookings,
    arrivals,
    requireInspection,
    counts,
    loaded,
    errors,
    now,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
