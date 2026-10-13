"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import * as T from "@/lib/services/tasks";
import * as O from "@/lib/services/ops";

// Every write the app can do, already bound to the signed-in staff member, the room list and the
// "require inspection" setting. Components just call actions.startTask(task).
export function useActions() {
  const { actor } = useAuth();
  const { roomsById, requireInspection, rooms, tasksById } = useData();

  return useMemo(() => {
    const ctx = { actor, roomsById, requireInspection };
    return {
      // tasks
      createTask: (input) => T.createTask(ctx, input),
      claimTask: (task) => T.claimTask(ctx, task),
      assignTask: (task, member) => T.assignTask(ctx, task, member),
      startTask: (task) => T.startTask(ctx, task),
      toggleChecklistItem: (task, i) => T.toggleChecklistItem(task, i),
      saveTaskNote: (task, note) => T.saveTaskNote(task, note),
      completeTask: (task) => T.completeTask(ctx, task),
      inspectTask: (task, result) => T.inspectTask(ctx, task, result),
      cancelTask: (task, reason) => T.cancelTask(ctx, task, reason),
      setTaskPriority: (task, p) => T.setTaskPriority(ctx, task, p),
      setRoomStatus: (room, status) => T.setRoomStatus(ctx, room, status),
      // setup and sync
      setRequireInspection: (v) => O.setRequireInspection(ctx, v),
      initializeRooms: () => O.initializeRooms(ctx, rooms),
      syncCheckouts: (days) => O.syncCheckouts(ctx, { rooms, tasksById, days }),
      refreshDueTimes: (tasks, arrivals) => O.refreshDueTimes(ctx, { tasks, arrivals }),
      // supplies
      addSupply: (d) => O.addSupply(ctx, d),
      adjustSupply: (item, delta, reason) => O.adjustSupply(ctx, item, delta, reason),
      setMinStock: (item, v) => O.setMinStock(ctx, item, v),
      // lost and found
      addLostItem: (d) => O.addLostItem(ctx, d),
      updateLostItem: (item, patch, msg) => O.updateLostItem(ctx, item, patch, msg),
    };
  }, [actor, roomsById, requireInspection, rooms, tasksById]);
}

// Friendly text for a failed write
export function errorText(e) {
  const code = (e && e.code) || "";
  if (code.includes("permission-denied")) {
    return "Firestore blocked this. Publish the rules in firestore.rules.housekeeping-additions.txt.";
  }
  if (code.includes("unavailable")) return "No connection. Try again when you are back online.";
  return (e && e.message) || "Something went wrong.";
}
