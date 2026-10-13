// =====================================================================================
// HIRAYA RESORT DATA CONTRACT: housekeeping side
//
// This file has no React and no Firebase imports, so any Hiraya app can import it
// (Hub, Bar Counter, Booking, Cloud Functions). In the monorepo, move it to
// packages/shared and import it as "@hiraya/shared". See docs/INTEGRATION.md.
// =====================================================================================

export const APP_ID = "housekeeping";

// Collection names. Owner = the only app that creates documents in it.
export const COLLECTIONS = {
  bookings: "bookings", // owner: Room Booking. Housekeeping only READS it (supervisors)
  rooms: "rooms", // owner: Room Booking. Housekeeping updates cleaningStatus only
  staff: "staff", // owner: Operations Hub
  tasks: "housekeepingTasks", // owner: Housekeeping
  activity: "activityLog", // any app appends
  lostFound: "lostFound", // owner: Housekeeping
  supplies: "supplies", // owner: Housekeeping
  settings: "settings", // settings/housekeeping, owner: Housekeeping
};

export const SETTINGS_DOC = "housekeeping";

// Hour of the day (resort local time) used as the "room must be ready by" time
// when the next guest arrives that day.
export const STANDARD_CHECKIN_HOUR = 14;

// ---- Rooms --------------------------------------------------------------------------
// rooms/{id}.cleaningStatus
export const ROOM_STATUS = {
  DIRTY: "dirty", // needs cleaning (set at check-out)
  CLEANING: "cleaning", // a cleaner has started
  CLEAN: "clean", // cleaned, waiting for the supervisor's inspection
  INSPECTED: "inspected", // checked and READY for the next guest
};

export const ROOM_STATUS_LABELS = {
  dirty: "Dirty",
  cleaning: "Being cleaned",
  clean: "Awaiting inspection",
  inspected: "Ready",
};

// A room is ready for a guest when it was inspected, or when it never had a cleaning status
// (rooms that existed before the Housekeeping app).
export function isRoomReady(room) {
  const s = room && room.cleaningStatus;
  return !s || s === ROOM_STATUS.INSPECTED;
}

// ---- Tasks --------------------------------------------------------------------------
// housekeepingTasks/{id}.status
export const TASK_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in-progress",
  DONE: "done", // finished by the cleaner, waiting for inspection
  INSPECTED: "inspected", // final: inspected, or finished with no inspection needed
  CANCELLED: "cancelled",
};

export const PRIORITIES = ["normal", "high", "urgent"];

// affectsRoom: the task changes rooms/{id}.cleaningStatus
// needsInspection: a supervisor must pass it (only when inspection is switched on in Settings)
export const TASK_TYPES = {
  "checkout-clean": {
    label: "Check-out clean",
    affectsRoom: true,
    needsInspection: true,
    checklist: "checkout",
  },
  turndown: {
    label: "Turndown / stay-over",
    affectsRoom: false,
    needsInspection: false,
    checklist: "turndown",
  },
  "deep-clean": {
    label: "Deep clean",
    affectsRoom: true,
    needsInspection: true,
    checklist: "deep",
  },
  "guest-request": {
    label: "Guest request",
    affectsRoom: false,
    needsInspection: false,
    checklist: null,
  },
  "maintenance-report": {
    label: "Maintenance issue",
    affectsRoom: false,
    needsInspection: false,
    checklist: null,
  },
};

export const CHECKLISTS = {
  checkout: [
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
  ],
  turndown: [
    "Tidy the bed",
    "Replace used towels",
    "Empty trash bins",
    "Restock water and toiletries",
    "Wipe bathroom surfaces",
  ],
  deep: [
    "Move furniture and clean underneath",
    "Wash windows and screens",
    "Clean aircon filter",
    "Scrub bathroom tiles and grout",
    "Wash curtains or wipe blinds",
    "Sanitize remote, switches and door handles",
    "Rotate the mattress",
    "Replace pillows or covers if worn",
  ],
};

export const ISSUE_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Aircon",
  "Furniture",
  "Linen or supplies",
  "Pests",
  "Other",
];

export const SUPPLY_CATEGORIES = ["Linen", "Toiletries", "Cleaning", "Other"];

// Booking statuses that mean "a guest is expected" (used for next-arrival times)
export const BOOKING_ARRIVING_STATUSES = ["approved", "confirmed", "paid"];

export function checklistFor(type) {
  const key = TASK_TYPES[type] && TASK_TYPES[type].checklist;
  return key ? CHECKLISTS[key].map((label) => ({ label, done: false })) : [];
}

// Same booking always gives the same task ID, so the Cloud Function, the Hub and the
// "Sync check-outs" button can never create two cleaning tasks for one check-out.
export function checkoutTaskId(bookingId) {
  return "checkout_" + bookingId;
}

// Builds a housekeepingTasks document. `now` is the timestamp value to use for createdAt:
// pass serverTimestamp() (web SDK) or FieldValue.serverTimestamp() (Admin SDK).
export function buildTaskDoc(input) {
  const {
    roomId,
    roomName = "",
    bookingId = null,
    type,
    priority = "normal",
    note = "",
    category = null,
    blocksRoom = false,
    dueBy = null,
    source = APP_ID,
    createdBy = null,
    createdByName = "",
    assignedTo = null,
    assignedToName = "",
    extra = {},
    now,
  } = input;

  return {
    roomId: roomId || null,
    roomName,
    bookingId,
    type,
    priority,
    status: TASK_STATUS.OPEN,
    assignedTo,
    assignedToName,
    note,
    category,
    blocksRoom: !!blocksRoom,
    checklist: checklistFor(type),
    dueBy,
    source,
    createdAt: now,
    createdBy,
    createdByName,
    startedAt: null,
    doneAt: null,
    inspectedAt: null,
    inspectedBy: null,
    inspectionNote: "",
    durationMin: null,
    rejectedCount: 0,
    ...extra,
  };
}
