import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { BOOKING_ARRIVING_STATUSES, COLLECTIONS } from "./contract";
import { toDate } from "./dates";

// The booking site may name fields differently, so each field lists the names to try, in order.
// If your booking documents use other names, add them to the FRONT of the right list.
function pick(data, names, fallback = "") {
  for (const n of names) {
    if (data[n] !== undefined && data[n] !== null && data[n] !== "") return data[n];
  }
  return fallback;
}

export function normalizeBooking(id, data) {
  return {
    id,
    guestName: pick(data, ["guestName", "name", "fullName", "customerName"], "Guest"),
    roomId: pick(data, ["roomId", "room_id"], ""),
    roomName: pick(data, ["roomName", "roomType", "room", "accommodation"], ""),
    checkIn: toDate(pick(data, ["checkIn", "checkInDate", "startDate", "arrivalDate"], null)),
    checkOut: toDate(pick(data, ["checkOut", "checkOutDate", "endDate", "departureDate"], null)),
    checkedOutAt: toDate(data.checkedOutAt || null),
    status: pick(data, ["status"], "pending"),
  };
}

// Supervisors only: bookings with a guest still to arrive, to show "next arrival" per room.
export function listenToArrivingBookings(onData, onError) {
  const q = query(
    collection(db, COLLECTIONS.bookings),
    where("status", "in", BOOKING_ARRIVING_STATUSES)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => normalizeBooking(d.id, d.data()))),
    onError
  );
}
