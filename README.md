# Hiraya Housekeeping

Housekeeping system for Hiraya Farm Resort. It uses the same Firebase project as the Room Booking system and the
Operations Hub (`hotel-63c74`), so a check-out in the Hub becomes a cleaning task here, and a room passed by the
supervisor shows as Ready everywhere. Same design and colors as the Hub.

## What it does

| Module | Who | What |
| --- | --- | --- |
| Dashboard | everyone | Supervisor: room counts, overdue, issues, low supplies, activity. Cleaner: my day. |
| My tasks | cleaners | Take or start tasks, tick the checklist, add notes, mark done, report issues |
| Room board | supervisors | Rooms in four columns (Dirty, Being cleaned, Awaiting inspection, Ready), next guest per room, new task, manual status |
| All tasks | supervisors | Filters, assign cleaners, change priority, cancel, export CSV |
| Inspections | supervisors | Pass a room (it becomes Ready) or send it back with a reason |
| Issues | everyone | Report maintenance problems, flag a room as blocked, resolve |
| Lost & found | everyone | Log found items, mark claimed or disposed |
| Supplies | everyone | Linen, toiletries, cleaning stock; use and restock; low-stock warnings |
| Reports | supervisors | Tasks per day, average time, by cleaner, by type, first-time pass rate |
| Team | supervisors | Cleaner workload; admins set who is a supervisor |
| Activity | supervisors | One feed of what every Hiraya system did |
| Settings | supervisors | Inspection on/off, set up rooms, sync check-outs, ready-by times, connection check |

The app installs on a phone (Add to Home Screen).

## 1. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3001 (port 3001 so it can run beside the Hub on 3000). The Firebase settings are already in
`.env.local`.

## 2. One-time Firebase setup

1. **Rules.** Open `firestore.rules.housekeeping-additions.txt` and paste the helper functions and `match` blocks inside
   your existing rules block. Do not replace the rules you have. Publish. Then open the booking site and confirm guests
   can still book.
2. **Staff.** Housekeeping staff are created in the Hub (Staff page, role Housekeeping). Your Hub admin account can
   already sign in here.
3. **Rooms.** Sign in as admin, open Settings, and click Set missing rooms to Ready.
4. **Check-out link.** Choose one (details in `docs/INTEGRATION.md`):
   * Settings, then Sync check-outs, whenever guests have checked out; or
   * deploy the Cloud Function in `functions/` (Firebase Blaze plan) for fully automatic tasks.
5. Open Settings, then Connection check. Every row should show a count or Connected.

## 3. A normal day

1. Guest checks out in the Hub. A check-out task appears for the room, which turns Dirty.
2. A cleaner opens My tasks, takes the task, taps Start (room: Being cleaned), ticks the checklist, taps Mark done
   (room: Awaiting inspection).
3. The supervisor opens Inspections and taps Pass (room: Ready). Or Send back with a reason, and the cleaner gets it
   again.

Turn inspection off in Settings if you do not use a supervisor check: rooms then become Ready when the cleaner finishes.

## 4. Match the booking system

The app guesses booking field names (`roomId`, `roomName`, `checkIn`, `checkOut`, `status`, `guestName`). If a next
arrival or a check-out does not match a room, open `lib/bookings.js` and add your real field name to the front of the
right list in `normalizeBooking`. The Cloud Function has the same lists in `functions/index.js`.

## 5. Deploy

1. Push to a new private GitHub repo `hiraya-housekeeping`.
2. Import it in Vercel and add the `NEXT_PUBLIC_FIREBASE_*` variables from `.env.local` (and `NEXT_PUBLIC_BASE_PATH` if it
   runs under the portal).
3. Firebase, Authentication, Settings, Authorized domains: add the Vercel domain.

## Project layout

```
app/          pages: dashboard, my-tasks, board, tasks, inspections, issues, lost-found, supplies, reports, team, activity, settings, login
components/   AuthProvider, DataProvider (live listeners), Shell, ProtectedPage, TaskCard, Modals, ui
hooks/        useActions (every write, bound to the signed-in user)
lib/          contract.js (shared data contract), logic.js, bookings.js, dates.js, csv.js, services/ (batched writes)
functions/    hkOnCheckout Cloud Function
docs/         INTEGRATION.md
```
