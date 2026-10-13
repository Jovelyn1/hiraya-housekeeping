// Setup, sync, supplies, lost and found, settings.
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  APP_ID,
  COLLECTIONS,
  ROOM_STATUS,
  SETTINGS_DOC,
  STANDARD_CHECKIN_HOUR,
  buildTaskDoc,
  checkoutTaskId,
} from "../contract";
import { atHour, sameDay, startOfDayLocal } from "../dates";
import { normalizeBooking } from "../bookings";
import { matchRoomId } from "../logic";
import { logActivity, setRoom } from "./tasks";

// ---- Settings ----
export async function setRequireInspection(ctx, value) {
  await setDoc(
    doc(db, COLLECTIONS.settings, SETTINGS_DOC),
    { requireInspection: !!value, updatedAt: serverTimestamp(), updatedBy: ctx.actor.uid },
    { merge: true }
  );
}

// ---- Rooms ----
// Rooms created before this app have no cleaningStatus. Mark them Ready once.
export async function initializeRooms(ctx, rooms) {
  const missing = rooms.filter((r) => !r.cleaningStatus);
  for (let i = 0; i < missing.length; i += 400) {
    const batch = writeBatch(db);
    missing.slice(i, i + 400).forEach((r) => setRoom(batch, ctx, r.id, ROOM_STATUS.INSPECTED));
    await batch.commit();
  }
  if (missing.length) {
    const batch = writeBatch(db);
    logActivity(batch, ctx.actor, {
      action: "rooms-initialized",
      message: "Set " + missing.length + " rooms to Ready",
    });
    await batch.commit();
  }
  return missing.length;
}

// ---- Check-out sync (fallback when the Cloud Function is not deployed) ----
// Finds bookings the Hub checked out recently and creates ONE cleaning task for each.
// The task ID comes from the booking ID, so running this twice, or alongside the Cloud
// Function, never creates duplicates.
export async function syncCheckouts(ctx, { rooms, tasksById, days = 3 }) {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.bookings), where("status", "==", "checked-out"))
  );
  const since = startOfDayLocal(new Date(Date.now() - days * 86400000)).getTime();
  const result = { created: 0, existing: 0, unmatched: [] };

  for (const d of snap.docs) {
    const b = normalizeBooking(d.id, d.data());
    const when = b.checkedOutAt || b.checkOut;
    if (!when || when.getTime() < since) continue;

    const id = checkoutTaskId(b.id);
    if (tasksById[id]) {
      result.existing++;
      continue;
    }
    const roomId = matchRoomId(b, rooms);
    if (!roomId) {
      result.unmatched.push(b.guestName + " (" + (b.roomName || "no room") + ")");
      continue;
    }

    const room = ctx.roomsById[roomId];
    const ref = doc(db, COLLECTIONS.tasks, id);
    const made = await runTransaction(db, async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists()) return false;
      tx.set(
        ref,
        buildTaskDoc({
          roomId,
          roomName: room ? room.name : b.roomName,
          bookingId: b.id,
          type: "checkout-clean",
          source: "sync",
          createdBy: ctx.actor.uid,
          createdByName: ctx.actor.name,
          extra: { guestName: b.guestName },
          now: serverTimestamp(),
        })
      );
      if (room && room.cleaningStatus !== ROOM_STATUS.CLEANING) {
        setRoom(tx, ctx, roomId, ROOM_STATUS.DIRTY);
      }
      logActivity(tx, ctx.actor, {
        action: "task-created",
        refId: id,
        roomId,
        message: "Check-out clean created for " + (room ? room.name : b.roomName) + " (sync)",
      });
      return true;
    });
    if (made) result.created++;
    else result.existing++;
  }
  return result;
}

// Sets "ready by" on open tasks from the next arrival in that room, and raises the priority when
// a guest arrives today.
export async function refreshDueTimes(ctx, { tasks, arrivals }) {
  const now = new Date();
  const batch = writeBatch(db);
  let changed = 0;
  for (const t of tasks) {
    if (t.status !== "open" && t.status !== "in-progress") continue;
    const next = t.roomId && arrivals[t.roomId];
    if (!next) continue;
    const due = atHour(next.date, STANDARD_CHECKIN_HOUR);
    const patch = {};
    if (!t.dueBy || t.dueBy.getTime() !== due.getTime()) patch.dueBy = due;
    if (sameDay(next.date, now) && t.priority === "normal") patch.priority = "high";
    if (Object.keys(patch).length) {
      batch.update(doc(db, COLLECTIONS.tasks, t.id), patch);
      changed++;
    }
  }
  if (changed) await batch.commit();
  return changed;
}

// ---- Supplies ----
export async function addSupply(ctx, data) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, COLLECTIONS.supplies));
  batch.set(ref, {
    name: data.name,
    category: data.category,
    unit: data.unit || "pcs",
    stock: Number(data.stock) || 0,
    minStock: Number(data.minStock) || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: ctx.actor.uid,
  });
  logActivity(batch, ctx.actor, {
    action: "supply-added",
    refId: ref.id,
    message: "Added supply item " + data.name,
  });
  await batch.commit();
}

// delta > 0 restock, delta < 0 used
export async function adjustSupply(ctx, item, delta, reason = "") {
  const next = Math.max(0, Number(item.stock) + Number(delta));
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.supplies, item.id), {
    stock: next,
    updatedAt: serverTimestamp(),
    updatedBy: ctx.actor.uid,
  });
  logActivity(batch, ctx.actor, {
    action: "supply-adjusted",
    refId: item.id,
    message:
      item.name + ": " + (delta > 0 ? "+" : "") + delta + " " + (item.unit || "") +
      (reason ? " (" + reason + ")" : "") + ", now " + next,
  });
  await batch.commit();
}

export async function setMinStock(ctx, item, minStock) {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.supplies, item.id), {
    minStock: Number(minStock) || 0,
    updatedAt: serverTimestamp(),
    updatedBy: ctx.actor.uid,
  });
  await batch.commit();
}

// ---- Lost and found ----
export async function addLostItem(ctx, data) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, COLLECTIONS.lostFound));
  batch.set(ref, {
    item: data.item,
    description: data.description || "",
    roomId: data.roomId || null,
    roomName: data.roomName || "",
    storedAt: data.storedAt || "",
    status: "stored",
    foundBy: ctx.actor.uid,
    foundByName: ctx.actor.name,
    createdAt: serverTimestamp(),
    claimedBy: "",
    claimedAt: null,
  });
  logActivity(batch, ctx.actor, {
    action: "lost-item-logged",
    refId: ref.id,
    roomId: data.roomId,
    message: "Found " + data.item + (data.roomName ? " in " + data.roomName : ""),
  });
  await batch.commit();
}

export async function updateLostItem(ctx, item, patch, message) {
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.lostFound, item.id), patch);
  logActivity(batch, ctx.actor, {
    action: "lost-item-updated",
    refId: item.id,
    roomId: item.roomId,
    message: message || item.item + " updated",
  });
  await batch.commit();
}

export { APP_ID };
