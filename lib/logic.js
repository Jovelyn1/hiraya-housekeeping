// Pure helpers: no Firebase, no React. Easy to test and to reuse in other apps.
import { TASK_STATUS, TASK_TYPES } from "./contract";
import { startOfDayLocal } from "./dates";

// ---- Rooms ----
// Which column of the room board a room belongs in
export function roomColumn(room) {
  switch (room && room.cleaningStatus) {
    case "dirty":
      return "dirty";
    case "cleaning":
      return "cleaning";
    case "clean":
      return "awaiting";
    default:
      return "ready";
  }
}

export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

// ---- Tasks ----
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2 };

export const isActive = (t) => t.status === TASK_STATUS.OPEN || t.status === TASK_STATUS.IN_PROGRESS;
export const isFinal = (t) => t.status === TASK_STATUS.INSPECTED || t.status === TASK_STATUS.CANCELLED;

export function isOverdue(task, now = new Date()) {
  return isActive(task) && !!task.dueBy && task.dueBy.getTime() < now.getTime();
}

// Most urgent first: priority, then due time, then oldest
export function sortTasks(list) {
  return [...list].sort((a, b) => {
    const p = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
    if (p !== 0) return p;
    const ad = a.dueBy ? a.dueBy.getTime() : Infinity;
    const bd = b.dueBy ? b.dueBy.getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
  });
}

export function taskStatusLabel(task) {
  const type = TASK_TYPES[task.type] || {};
  switch (task.status) {
    case TASK_STATUS.OPEN:
      return task.assignedTo ? "Assigned" : "Open";
    case TASK_STATUS.IN_PROGRESS:
      return "In progress";
    case TASK_STATUS.DONE:
      return "Awaiting inspection";
    case TASK_STATUS.INSPECTED:
      return type.needsInspection && task.inspectedBy !== "auto" ? "Inspected" : "Completed";
    case TASK_STATUS.CANCELLED:
      return "Cancelled";
    default:
      return task.status;
  }
}

export function checklistProgress(task) {
  const list = Array.isArray(task.checklist) ? task.checklist : [];
  return { done: list.filter((i) => i.done).length, total: list.length };
}

// ---- Bookings (supervisor view) ----
export function matchRoomId(booking, rooms) {
  if (booking.roomId && rooms.some((r) => r.id === booking.roomId)) return booking.roomId;
  const name = String(booking.roomName || "").trim().toLowerCase();
  if (!name) return null;
  const hit = rooms.find((r) => String(r.name || "").trim().toLowerCase() === name);
  return hit ? hit.id : null;
}

// Earliest guest still to arrive, per room: { [roomId]: { date, guestName } }
export function nextArrivalByRoom(bookings, rooms, now = new Date()) {
  const from = startOfDayLocal(now).getTime();
  const out = {};
  for (const b of bookings) {
    if (!b.checkIn || b.checkIn.getTime() < from) continue;
    const roomId = matchRoomId(b, rooms);
    if (!roomId) continue;
    if (!out[roomId] || b.checkIn.getTime() < out[roomId].date.getTime()) {
      out[roomId] = { date: b.checkIn, guestName: b.guestName };
    }
  }
  return out;
}

// ---- Supplies ----
export const isLowStock = (item) => Number(item.stock) <= Number(item.minStock || 0);
