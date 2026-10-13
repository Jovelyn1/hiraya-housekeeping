# Housekeeping: how it connects to the other systems

Housekeeping shares the **same Firebase project** as Room Booking, the Operations Hub and the Bar Counter
(`hotel-63c74`). There is no sync code and no server between the apps: they read and write the same documents,
and a change in one app shows up in the others within a second.

The single source of truth for names, statuses and task fields is `lib/contract.js`. It has no React and no
Firebase imports, so every app can use the same file.

## 1. What Housekeeping owns and what it touches

| Collection | Owner | Housekeeping may | Notes |
| --- | --- | --- | --- |
| `housekeepingTasks` | Housekeeping | create, update | The work itself. The Hub may also create tasks. |
| `lostFound` | Housekeeping | create, update | |
| `supplies` | Housekeeping | create, update | Stock and low-stock warnings |
| `settings/housekeeping` | Housekeeping | admin writes | `requireInspection` |
| `rooms` | Room Booking | update `cleaningStatus`, `cleaningUpdatedAt`, `cleaningUpdatedBy` only | Everything else is read only |
| `bookings` | Room Booking | **read only, supervisors only** | Next arrivals and check-out sync. Cleaners cannot read bookings. |
| `staff` | Operations Hub | read own profile; supervisors list housekeeping staff; admins set `supervisor` | Roles come from the Hub |
| `activityLog` | any app | append | One feed for all systems |

## 2. Room cleaning status (the field other systems read)

`rooms/{roomId}.cleaningStatus`

| Value | Meaning | Set by |
| --- | --- | --- |
| `dirty` | Needs cleaning | Check-out (Cloud Function or Sync button), new clean task |
| `cleaning` | A cleaner has started | Cleaner taps Start |
| `clean` | Cleaned, waiting for inspection | Cleaner taps Mark done (when inspection is on) |
| `inspected` | **Ready for the next guest** | Supervisor passes the room, or cleaner finishes when inspection is off |

A room with **no** `cleaningStatus` counts as ready. Use `isRoomReady(room)` from `lib/contract.js`:

```js
import { isRoomReady } from "@hiraya/shared"; // or the copied contract.js
if (!isRoomReady(room)) { /* show "being cleaned", do not assign to a new guest */ }
```

## 3. Task lifecycle

`housekeepingTasks/{id}.status`: `open` then `in-progress` then `done` (waiting for inspection) then `inspected`
(final). `cancelled` ends a task early. A task that needs no inspection (turndown, guest request, maintenance, or
any clean while inspection is off) goes straight from `in-progress` to `inspected`, which the app labels
"Completed". A failed inspection returns the task to `open` for the same cleaner with the reason and
`rejectedCount + 1`.

Task types: `checkout-clean`, `turndown`, `deep-clean`, `guest-request`, `maintenance-report`. Add a new type
by adding one entry to `TASK_TYPES` in `lib/contract.js`.

## 4. The events that link the systems

| When this happens | In this app | Housekeeping reacts by |
| --- | --- | --- |
| Booking approved | Room Booking | Nothing yet. Supervisors see the guest as the room's next arrival. |
| Guest checked out (`status` becomes `checked-out`) | Hub | Cloud Function (or Sync button) creates task `checkout_<bookingId>` and sets the room `dirty` |
| Cleaner starts, finishes, supervisor passes | Housekeeping | Writes the task, the room status and an `activityLog` line in one batch |
| Room becomes `inspected` | Housekeeping | Hub and Room Booking read it and treat the room as available |
| Guest asks for extra towels or a late clean | Hub | Hub creates a `guest-request` task (snippet below) |
| Cleaner finds a broken fixture | Housekeeping | `maintenance-report` task; `blocksRoom: true` flags the room |
| Order or charge at the bar | Bar Counter | No link needed |

### Duplicate protection

The check-out task ID is always `checkout_<bookingId>` (`checkoutTaskId()` in the contract). The Cloud Function, the
Sync button and any code you add all use it inside a transaction, so one check-out can never create two tasks.

## 4a. Turn on the automatic check-out hand-off

Choose one:

**A. Sync button (no extra cost).** Settings, then Sync check-outs. Run it once or twice a day, or when the front desk
tells you a guest left.

**B. Cloud Function (automatic, needs the Firebase Blaze plan).**

```bash
npm install -g firebase-tools
firebase login
firebase use hotel-63c74
cd functions && npm install && cd ..
firebase deploy --only functions
```

The function is `hkOnCheckout` in `functions/index.js`. Blaze is pay as you go; a resort's volume is normally
well inside the free monthly allowance.

## 5. Connecting the Hub (Phase 2 and later)

1. **Check-out.** The Hub only changes the booking: `status: "checked-out"` and `checkedOutAt`. Do **not** also touch
   the room. The function (or Sync button) does it.
2. **Show room readiness** on the Hub's room and arrival cards:

```js
import { isRoomReady, ROOM_STATUS_LABELS } from "@hiraya/shared";
const label = isRoomReady(room) ? "Ready" : ROOM_STATUS_LABELS[room.cleaningStatus];
```

3. **Block check-in of a room that is not ready** (optional): disable the Check in button when
   `!isRoomReady(room)`, or require an override reason.
4. **Ask housekeeping for something** (towels, early clean):

```js
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { buildTaskDoc } from "@hiraya/shared";

await addDoc(
  collection(db, "housekeepingTasks"),
  buildTaskDoc({
    roomId: room.id,
    roomName: room.name,
    bookingId: booking.id,
    type: "guest-request",
    priority: "high",
    note: "Two extra towels",
    source: "hub",
    createdBy: user.uid,
    createdByName: profile.name,
    now: serverTimestamp(),
  })
);
```

Rules already allow the `frontdesk` role to create tasks (with `status: "open"` and its own UID as `createdBy`)
and to read tasks, rooms, lost and found, and the activity log.

## 6. Connecting the Bar Counter and Room Booking

* **Bar Counter:** no data link is needed. If you later want bar staff to flag a spill or broken glass in a room, use
  the same `guest-request` snippet with `source: "bar"`.
* **Room Booking:** it must keep ignoring fields it does not know. Housekeeping adds `cleaningStatus`,
  `cleaningUpdatedAt` and `cleaningUpdatedBy` to `rooms`. Optional: show "Being cleaned" on the booking site's
  room availability using `isRoomReady()`.
* Add `checked-in` and `checked-out` to any booking-site code that filters by status (same note as the Hub guide).

## 7. One login, one portal

All apps use Firebase Auth and the same `staff/{uid}` document, so one account works everywhere. To serve this app
under the staff portal (Next.js multi-zones, Step I3 of the guide):

1. In `.env.local` set `NEXT_PUBLIC_BASE_PATH=/housekeeping`.
2. Deploy this app as its own Vercel project.
3. In the portal's `next.config.js` add the rewrite  
   `{ source: "/housekeeping/:path*", destination: "https://YOUR-HOUSEKEEPING.vercel.app/housekeeping/:path*" }`.

Roles that can open this app: `housekeeping` and `admin`. A housekeeping account becomes a supervisor when its
`staff/{uid}` document has `supervisor: true` (Team page, admins only). Admins are always supervisors.

## 8. Moving the contract into the shared package (monorepo, Step I1)

1. Copy `lib/contract.js` to `packages/shared/contract.js` and export it from the package index.
2. In this app, replace imports of `@/lib/contract` with `@hiraya/shared`, or leave `lib/contract.js` as a one-line
   re-export: `export * from "@hiraya/shared";`
3. Do the same for the Hub and the Bar Counter. Now a new task type, status word or checklist is changed once.

## 9. Firestore rules

Paste `firestore.rules.housekeeping-additions.txt` inside your existing rules (do not replace them). The helper
functions are prefixed `hk` so they cannot clash with the Hub's. Test in the Rules Playground as:

* a cleaner (can read tasks and rooms, cannot read bookings, cannot edit another cleaner's task),
* a supervisor (can read bookings, assign, inspect),
* a front desk user (can read, can create a task),
* a signed-out visitor (can read nothing here).

## 10. Test the whole chain

- [ ] Guest books and admin approves (Room Booking)
- [ ] Hub checks the guest in, then out
- [ ] A `checkout_<bookingId>` task appears in Housekeeping and the room is `dirty`
- [ ] A cleaner takes the task, ticks the checklist, taps Mark done; room becomes `clean`
- [ ] Supervisor passes it on the Inspections page; room becomes `inspected` and the Hub shows it as ready
- [ ] Activity shows every step with names and times
- [ ] A cleaner account cannot open the bookings collection (check Settings, Connection check)
