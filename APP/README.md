# Digital Bus Pass — standalone frontend

A self-contained HTML/CSS/JS recreation of the **eTMS Digital Bus Pass** screens,
built to match the real-device photos in **`reference/`**. Frontend only — no login,
PIN, maps, notifications, feedback or backend. Add / edit / delete passes, persisted
locally in the browser.

## Run
Open **`index.html`** in any browser (double-click it). No build, no server, no
internet needed.

> If a browser blocks `localStorage` on `file://` (rare), serve the folder instead:
> `python -m http.server 8777` then open `http://127.0.0.1:8777`.

## Screens (match the reference photos)
- **Welcome** — "Welcome To / TCS eTMS", three service pills (Bus / Cab / Geocode).
  **Bus Services** opens the bus pass; Cab / Geocode are stubs (toast).
- **Digital Bus Pass** — gradient route card (start → ⇄ → destination, with
  Office In/Out timings; "Both" shows both times left/right), white "Confirmed Bus
  Pass" card with the **green corner accent**, details grid (Name, Employee ID,
  Bus Stop, Route Type, Start/End Date as "1st Oct, 2026"), the "Route : …" line,
  an optional Bus Number + Seat row, a **View QR / View Details** toggle, and the
  TCS logo footer.
- **QR** — real, scannable QR encoding the pass as JSON; regenerates on edit. The
  code alone fills the card, with no name printed underneath (as in the photos).
- **Buspass Request Status** — lists all passes; tap to view, edit or delete; the
  active pass is marked. "+ Apply New Bus Pass" adds one.
- **Apply / Edit Bus Pass** — edit every field: name, employee ID, stops, route
  type, Office In / Out timings, dates, route text, and optional bus number / seat.

## Navigation drawer (☰) — matches the app
Home · Apply Bus Pass · Buspass Request Status · FeedBack History · Back To Home
Page · Settings · Logout. FeedBack History and Settings are stubs; Back To Home
Page / Logout return to the Welcome screen.

## Files
```
index.html        app shell + inline SVG icons
css/style.css     all styling; colours/metrics from the APK + the reference photos
js/app.js         state, screens, add/edit/delete, QR generation (no framework)
js/qrcode.min.js  bundled QR encoder (qrcode-generator 1.4.4, MIT) — fully offline
assets/tcs_logo.png   TATA Consultancy Services logo (from the APK)
reference/        the original device screenshots used as the design target
```

## Data & reset
Passes live in `localStorage` (keys `dbp_passes_v3`, `dbp_active_v3`) in that one
browser. Two placeholder passes (JOHN DOE / JANE DOE, dummy employee IDs) are seeded on
first run - edit them with your own details. To wipe
everything, clear site data or run `localStorage.clear()` in the dev console.

## Packaged as an app
This same folder is what ships inside the Android and iOS apps. The parent project
wraps it with Capacitor: `npm run stage` copies these files into `dist/`, and
`npx cap sync` copies `dist/` into both native projects. See the parent `README.md`
sections 7 (Android) and 8 (iOS).

The layout keeps clear of the iPhone notch, Dynamic Island and home indicator via
`env(safe-area-inset-*)`, which resolves to 0 in a browser and on Android, so those
rules change nothing outside iOS. Form inputs are 16px because anything smaller
makes iOS zoom the page in when a field takes focus.

## Notes
Personal organiser for your own bus-pass details. Not an official TCS application.
Responsive — works on any screen size; the phone column is centred on larger screens.
