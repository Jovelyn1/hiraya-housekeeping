// All task writes live here. Each action changes the task, the room and the activityLog in ONE
// batch, so the apps sharing the database never see a half-finished change.
//
// ctx = { actor: { uid, name }, roomsById, requireInspection }  (built by hooks/useActions)
import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  APP_ID,
  COLLECTIONS,
  ROOM_STATUS,
  TASK_STATUS,
  TASK_TYPES,
  buildTaskDoc,
} from "../contract";

const taskRef = (id) => doc(db, COLLECTIONS.tasks, id);
const typeOf = (task) => TASK_TYPES[task.type] || {};
const labelOf = (task) => (task.roomName || "Room") + " (" + (typeOf(task).label || task.type) + ")";

// Works with a write batch or a transaction (both have .set)
export function logActivity(writer, actor, data) {
  const ref = doc(collection(db, COLLECTIONS.activity));
  writer.set(ref, {
    app: APP_ID,
    action: data.action,
    refId: data.refId || null,
    roomId: data.roomId || null,
    message: data.message || "",
    staffId: actor.uid,
    staffName: actor.name,
    createdAt: serverTimestamp(),
  });
}

// Only touches rooms that exist in the rooms collection
export function setRoom(writer, ctx, roomId, status) {
  if (!roomId || !ctx.roomsById[roomId]) return;
  writer.update(doc(db, COLLECTIONS.rooms, roomId), {
    cleaningStatus: status,
    cleaningUpdatedAt: serverTimestamp(),
    cleaningUpdatedBy: ctx.actor.uid,
  });
}

// ---- Create ----
export async function createTask(ctx, input) {
  const room = ctx.roomsById[input.roomId];
  const type = TASK_TYPES[input.type] || {};
  const batch = writeBatch(db);
  const ref = input.id ? taskRef(input.id) : doc(collection(db, COLLECTIONS.tasks));

  const data = buildTaskDoc({
    ...input,
    roomName: (room && room.name) || input.roomName || "",
    createdBy: ctx.actor.uid,
    createdByName: ctx.actor.name,
    now: serverTimestamp(),
  });
  batch.set(ref, data);

  // A clean of an empty room makes the room "dirty" until it is done and inspected
  if (type.affectsRoom && room && room.cleaningStatus !== ROOM_STATUS.CLEANING) {
    setRoom(batch, ctx, input.roomId, ROOM_STATUS.DIRTY);
  }
  logActivity(batch, ctx.actor, {
    action: "task-created",
    refId: ref.id,
    roomId: input.roomId,
    message: "Created " + labelOf(data),
  });
  await batch.commit();
  return ref.id;
}

// ---- Claim and assign ----
export async function claimTask(ctx, task) {
  await runTransaction(db, async (tx) => {
    const ref = taskRef(task.id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("This task no longer exists.");
    const cur = snap.data();
    if (cur.assignedTo && cur.assignedTo !== ctx.actor.uid) {
      throw new Error("Someone else already took this task.");
    }
    if (cur.status !== TASK_STATUS.OPEN) throw new Error("This task is no longer open.");
    tx.update(ref, {
      assignedTo: ctx.actor.uid,
      assignedToName: ctx.actor.name,
      claimedAt: serverTimestamp(),
    });
    logActivity(tx, ctx.actor, {
      action: "task-claimed",
      refId: task.id,
      roomId: task.roomId,
      message: "Took " + labelOf(task),
    });
  });
}

// member = { id, name } or null to unassign
export async function assignTask(ctx, task, member) {
  const batch = writeBatch(db);
  batch.update(taskRef(task.id), {
    assignedTo: member ? member.id : null,
    assignedToName: member ? member.name : "",
  });
  logActivity(batch, ctx.actor, {
    action: "task-assigned",
    refId: task.id,
    roomId: task.roomId,
    message: member
      ? "Assigned " + labelOf(task) + " to " + member.name
      : "Unassigned " + labelOf(task),
  });
  await batch.commit();
}

// ---- Work on a task ----
export async function startTask(ctx, task) {
  const batch = writeBatch(db);
  const patch = {
    status: TASK_STATUS.IN_PROGRESS,
    assignedTo: task.assignedTo || ctx.actor.uid,
    assignedToName: task.assignedTo ? task.assignedToName : ctx.actor.name,
  };
  if (!task.startedAt) patch.startedAt = serverTimestamp();
  batch.update(taskRef(task.id), patch);
  if (typeOf(task).affectsRoom) setRoom(batch, ctx, task.roomId, ROOM_STATUS.CLEANING);
  logActivity(batch, ctx.actor, {
    action: "task-started",
    refId: task.id,
    roomId: task.roomId,
    message: "Started " + labelOf(task),
  });
  await batch.commit();
}

export async function toggleChecklistItem(task, index) {
  const list = (task.checklist || []).map((item, i) =>
    i === index ? { ...item, done: !item.done } : item
  );
  const batch = writeBatch(db);
  batch.update(taskRef(task.id), { checklist: list });
  await batch.commit();
}

export async function saveTaskNote(task, note) {
  const batch = writeBatch(db);
  batch.update(taskRef(task.id), { note });
  await batch.commit();
}

export async function completeTask(ctx, task) {
  const type = typeOf(task);
  const needsInspection = !!(ctx.requireInspection && type.needsInspection);
  let durationMin = null;
  if (task.startedAt) {
    const mins = Math.round((Date.now() - task.startedAt.getTime()) / 60000);
    durationMin = Math.min(Math.max(mins, 1), 24 * 60);
  }

  const batch = writeBatch(db);
  const patch = {
    status: needsInspection ? TASK_STATUS.DONE : TASK_STATUS.INSPECTED,
    doneAt: serverTimestamp(),
    durationMin,
  };
  if (!needsInspection) {
    patch.inspectedAt = serverTimestamp();
    patch.inspectedBy = "auto"; // finished with no inspection step
  }
  batch.update(taskRef(task.id), patch);
  if (type.affectsRoom) {
    setRoom(batch, ctx, task.roomId, needsInspection ? ROOM_STATUS.CLEAN : ROOM_STATUS.INSPECTED);
  }
  logActivity(batch, ctx.actor, {
    action: needsInspection ? "task-done" : "task-completed",
    refId: task.id,
    roomId: task.roomId,
    message: (needsInspection ? "Finished " : "Completed ") + labelOf(task),
  });
  await batch.commit();
}

// ---- Supervisor actions ----
export async function inspectTask(ctx, task, { pass, note = "" }) {
  const batch = writeBatch(db);
  if (pass) {
    batch.update(taskRef(task.id), {
      status: TASK_STATUS.INSPECTED,
      inspectedAt: serverTimestamp(),
      inspectedBy: ctx.actor.uid,
      inspectionNote: note,
    });
    setRoom(batch, ctx, task.roomId, ROOM_STATUS.INSPECTED);
  } else {
    // Send back to the same cleaner with the reason, checklist reset
    batch.update(taskRef(task.id), {
      status: TASK_STATUS.OPEN,
      startedAt: null,
      doneAt: null,
      durationMin: null,
      inspectedAt: null,
      inspectedBy: null,
      inspectionNote: note,
      rejectedCount: increment(1),
      checklist: (task.checklist || []).map((i) => ({ ...i, done: false })),
    });
    setRoom(batch, ctx, task.roomId, ROOM_STATUS.DIRTY);
  }
  logActivity(batch, ctx.actor, {
    action: pass ? "inspection-passed" : "inspection-failed",
    refId: task.id,
    roomId: task.roomId,
    message: (pass ? "Passed " : "Sent back ") + labelOf(task) + (note ? ": " + note : ""),
  });
  await batch.commit();
}

export async function cancelTask(ctx, task, reason = "") {
  const batch = writeBatch(db);
  batch.update(taskRef(task.id), {
    status: TASK_STATUS.CANCELLED,
    inspectionNote: reason,
  });
  logActivity(batch, ctx.actor, {
    action: "task-cancelled",
    refId: task.id,
    roomId: task.roomId,
    message: "Cancelled " + labelOf(task) + (reason ? ": " + reason : ""),
  });
  await batch.commit();
}

export async function setTaskPriority(ctx, task, priority) {
  const batch = writeBatch(db);
  batch.update(taskRef(task.id), { priority });
  logActivity(batch, ctx.actor, {
    action: "task-priority",
    refId: task.id,
    roomId: task.roomId,
    message: "Set " + labelOf(task) + " to " + priority,
  });
  await batch.commit();
}

// Manual override from the room board (for example a room cleaned outside the app)
export async function setRoomStatus(ctx, room, status) {
  const batch = writeBatch(db);
  setRoom(batch, ctx, room.id, status);
  logActivity(batch, ctx.actor, {
    action: "room-status",
    roomId: room.id,
    message: (room.name || "Room") + " set to " + status + " by hand",
  });
  await batch.commit();
}
