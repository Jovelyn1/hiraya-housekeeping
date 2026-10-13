// Cloud Function: when the Hub checks a guest out, create the cleaning task.
//
// Needs the Firebase Blaze plan. Without it, use "Sync check-outs" in the app's Settings page:
// it makes exactly the same task (same document ID), so the two never create duplicates.
//
// Keep the task fields in sync with buildTaskDoc() in lib/contract.js.
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

// Same field names the app tries on bookings. Add yours to the front if they differ.
function pick(data, names) {
  for (const n of names) {
    if (data[n] !== undefined && data[n] !== null && data[n] !== "") return data[n];
  }
  return "";
}

const CHECKLIST = [
  "Strip beds and collect used linen",
  "Make bed with fresh linen",
  "Dust and wipe all surfaces",
  "Clean bathroom: toilet, shower, sink, mirror",
  "Restock towels and toiletries",
  "Empty trash bins",
  "Sweep and mop floor",
  "Check under beds and drawers for left items",
  "Check aircon, lights and appliances work",
  "Close windows and leave the room ready",
];

exports.hkOnCheckout = onDocumentUpdated("bookings/{bookingId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after) return;
  // Only the moment the status BECOMES checked-out
  if (before.status === "checked-out" || after.status !== "checked-out") return;

  const db = getFirestore();
  const bookingId = event.params.bookingId;
  const roomId = pick(after, ["roomId", "room_id"]) || null;
  const taskRef = db.collection("housekeepingTasks").doc("checkout_" + bookingId);
  const roomRef = roomId ? db.collection("rooms").doc(roomId) : null;

  await db.runTransaction(async (tx) => {
    // Reads first, then writes
    const [taskSnap, roomSnap] = await Promise.all([tx.get(taskRef), roomRef ? tx.get(roomRef) : null]);
    if (taskSnap.exists) return; // already created (by the app's sync button, or an earlier run)

    const room = roomSnap && roomSnap.exists ? roomSnap.data() : null;
    const roomName = (room && (room.name || room.roomName || room.title)) || pick(after, ["roomName", "roomType", "room"]);

    tx.set(taskRef, {
      roomId,
      roomName,
      bookingId,
      type: "checkout-clean",
      priority: "normal",
      status: "open",
      assignedTo: null,
      assignedToName: "",
      note: "",
      category: null,
      blocksRoom: false,
      checklist: CHECKLIST.map((label) => ({ label, done: false })),
      dueBy: null,
      source: "function",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: null,
      createdByName: "System",
      startedAt: null,
      doneAt: null,
      inspectedAt: null,
      inspectedBy: null,
      inspectionNote: "",
      durationMin: null,
      rejectedCount: 0,
      guestName: pick(after, ["guestName", "name", "fullName", "customerName"]) || "Guest",
    });

    if (room && room.cleaningStatus !== "cleaning") {
      tx.update(roomRef, {
        cleaningStatus: "dirty",
        cleaningUpdatedAt: FieldValue.serverTimestamp(),
        cleaningUpdatedBy: "system",
      });
    }

    tx.set(db.collection("activityLog").doc(), {
      app: "housekeeping",
      action: "task-created",
      refId: taskRef.id,
      roomId,
      message: "Check-out clean created for " + (roomName || "room") + " (check-out)",
      staffId: "system",
      staffName: "System",
      createdAt: FieldValue.serverTimestamp(),
    });
  });
});
