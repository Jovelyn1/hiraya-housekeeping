import { format, parseISO, isValid, formatDistanceToNowStrict } from "date-fns";

// Booking systems store dates in different ways. This turns any of them into a JS Date,
// or null when the value is empty or unreadable.
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value.toDate === "function") return value.toDate(); // Firestore Timestamp
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  if (typeof value === "string") {
    const iso = parseISO(value);
    if (isValid(iso)) return iso;
    const fallback = new Date(value);
    return isValid(fallback) ? fallback : null;
  }
  if (typeof value === "number") return new Date(value);
  return null;
}

export function fmtDate(value) {
  const d = toDate(value);
  return d ? format(d, "MMM d, yyyy") : "-";
}

export function fmtDateTime(value) {
  const d = toDate(value);
  return d ? format(d, "MMM d, h:mm a") : "-";
}

export function fmtTime(value) {
  const d = toDate(value);
  return d ? format(d, "h:mm a") : "-";
}

export function timeAgo(value) {
  const d = toDate(value);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : "just now";
}

export function startOfDayLocal(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sameDay(a, b) {
  if (!a || !b) return false;
  return startOfDayLocal(a).getTime() === startOfDayLocal(b).getTime();
}

export function atHour(date, hour) {
  const x = new Date(date);
  x.setHours(hour, 0, 0, 0);
  return x;
}

export function minutesLabel(min) {
  if (min === null || min === undefined || Number.isNaN(min)) return "-";
  if (min < 60) return Math.round(min) + " min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h + " h" + (m ? " " + m + " min" : "");
}

// For <input type="datetime-local">
export function toInputValue(d) {
  return d ? format(d, "yyyy-MM-dd'T'HH:mm") : "";
}
