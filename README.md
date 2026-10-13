# Digital Bus Pass

A personal organiser for your own employee bus pass details — route, stops, validity
dates and timings — that works offline on the web, on Android and on iOS from one
shared codebase.

It is a private record keeper for your own information. It does not connect to any
employer system, and it is not an official Tata Consultancy Services application.

---

## Contents

1. [What changed](#1-what-changed)
2. [Architecture](#2-architecture)
3. [Requirements](#3-requirements)
4. [Setup and commands](#4-setup-and-commands)
5. [Environment variables](#5-environment-variables)
6. [Web build and deployment](#6-web-build-and-deployment)
7. [Android build and installation](#7-android-build-and-installation)
8. [iOS build and installation](#8-ios-build-and-installation)
9. [Data, storage and editing](#9-data-storage-and-editing)
10. [Testing](#10-testing)
11. [Known limitations](#11-known-limitations)

---

## 1. What changed

The previous version was a single `index.html` (≈430 lines) holding one hard-coded
pass, with a QR/details toggle and a navigation drawer whose links went nowhere. It
is now a small multi-screen application that keeps the same visual identity.

### Bugs fixed

| # | Problem | Fix |
|---|---------|-----|
| 1 | **Page scrolled sideways on every phone.** `.qr-inner` and `.details-inner` were `width: 120%` inside a padded parent. | Rewritten as fluid containers. Verified 0px horizontal overflow at 320 / 375 / 390 / 430 / 768 / 1024 / 1440 px on every route, with the drawer open and with pathological 100-character unbroken strings. |
| 2 | **Five of six drawer links were dead** (`href="#"` with no handler). | Every link now routes to a real screen. "Back to Home Page" (a duplicate of Home) and "Logout" (no accounts exist) were removed rather than left as decoration. |
| 3 | **The notification bell did nothing.** | Opens an Alerts screen with a live badge, derived from the stored passes: expiring within 7 days, expired, pending, rejected. |
| 4 | **Pass data could not be edited.** Changing the month meant hand-editing HTML and committing. | Full create / read / update / delete with validation, persisted to device storage. |
| 5 | **Fixed 350px card height** clipped content on small screens. | Fluid card with `aspect-ratio` on the QR frame. |
| 6 | **`:root` had padding declarations** that do nothing on the root element. | Safe-area insets moved to the elements that need them (header, drawer, footer, sticky action bar). |
| 7 | **QR code was 138 KB, the TCS logo 193 KB** (7429px wide, displayed at 130px). | 76 KB and 15 KB. The QR re-encode is *bit-exact* — verified zero differing pixels; see note below. |
| 8 | **No favicon, no app icons, no manifest, no 404 page, one generic `<title>`.** | Added, with per-route titles and descriptions. |
| 9 | **Router parameters never matched** (`/pass/:id/edit` fell through to 404) — found by the test suite. | Pattern compiler fixed; regression tests added. |
| 10 | **Unsaved edits were lost silently** on navigation. | Confirmation dialog on in-app navigation, browser back, Android hardware back, and page unload. |
| 11 | **Copyright/branding year was absent**; footer was a bare logo. | Footer has working links and a year that updates itself. |
| 12 | **Touch targets as small as 36px.** | Raised to 44px minimum wherever the pointer is coarse. |

> **Why the QR is not compressed harder.** Palettising it to two colours gave 12 KB
> instead of 76 KB, but flipped ~3% of pixels along module edges. On a dense code
> that is a real scanning risk, so the pipeline uses a lossless greyscale re-encode
> instead and still saves 45%. The check is in `scripts/optimize-images.mjs`.

### Added

- Multiple passes with an "active" pass shown on the home screen
- Create, edit, delete, status filtering, intermediate stops
- Profile defaults that prefill new passes
- Backup to JSON and restore (merge or replace)
- Alerts derived from pass dates
- A custom 404 page, both in-app and as a static `404.html`
- Android and iOS applications
- 119 automated tests

### Preserved

Everything that worked: the purple `#6200ea` header, the indigo `#3d4fff` route card,
the near-black surface, the green corner flag on the pass, the QR ⇄ Details toggle,
the TCS mark in the footer, and the original pass record itself — it is seeded into
the store on first run, so the app opens showing the same pass it always did.

---

## 2. Architecture

Vanilla ES modules, no UI framework. The app is small enough that a framework would
be more weight than help: the production bundle is **66 KB (22 KB gzipped)**.

```
.
├── index.html                  Entry document, all page metadata
├── vite.config.js              Build + test configuration
├── capacitor.config.json       Native shell configuration
│
├── src/
│   ├── main.js                 Boot, routing table, store-to-UI wiring
│   ├── config.js               Build-time constants (no secrets)
│   │
│   ├── core/
│   │   ├── dom.js              h() element builder — no innerHTML for user data
│   │   ├── router.js           Hash router with navigation guards
│   │   ├── dates.js            Timezone-free date/time handling
│   │   ├── events.js           Pub/sub
│   │   └── native.js           Capacitor bridge, guarded for the web build
│   │
│   ├── data/
│   │   ├── schema.js           Pass model, defaults, seed, derived status
│   │   ├── validation.js       Field rules, shared by forms and the store
│   │   ├── storage.js          Key/value persistence (swappable backend)
│   │   ├── repository.js       Single source of truth; CRUD + change events
│   │   └── alerts.js           Reminders derived from pass dates
│   │
│   ├── ui/                     shell, field, modal, toast
│   ├── screens/                pass, passes, editor, alerts, settings, notFound
│   └── styles/                 tokens, base, shell, components, screens
│
├── public/                     Static assets copied verbatim (icons, manifest, 404)
├── assets-src/                 Original artwork (input to the asset pipeline)
├── resources/                  Generated 1024px icon + 2732px splash for native
├── scripts/                    Asset pipeline, Gradle runner
├── tests/                      Vitest suites
├── android/                    Capacitor Android project (committed)
└── ios/                        Capacitor iOS project (committed)
```

**Why Capacitor rather than React Native.** The existing code was HTML, CSS and DOM
JavaScript. Capacitor runs exactly that code inside a native shell, so the web app
and both mobile apps share one implementation of every screen, validation rule and
storage call. React Native would have meant rewriting all of it with no shared
runtime, which the brief explicitly ruled out.

**State flow.** Screens never touch storage. They read from `repository.js` and
subscribe to its `change` event; any write re-renders every reactive screen, which is
why an edit shows up immediately on the home screen, the list and the alerts badge at
once. The editor opts out of re-rendering so a half-filled form is never destroyed by
a background change.

---

## 3. Requirements

| | Minimum | Used here |
|---|---|---|
| Node.js | 20.0 | 20.11.0 |
| npm | 9 | 10.2.4 |
| JDK (Android only) | 21 | Temurin 21.0.5 |
| Android SDK | platform 35, build-tools 35 | installed |
| Xcode (iOS only) | 15+, macOS | **not available on Windows** |
| CocoaPods (iOS only) | 1.12+ | **not available on Windows** |

Node 20 pins Capacitor to 7.x and Vite to 6.x. On Node 22+ you can move to Capacitor
8 and Vite 8 if you want; nothing in `src/` depends on either major version.

---

## 4. Setup and commands

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on <http://localhost:5173> (also on your LAN IP, for testing on a real phone) |
| `npm run build` | Optimise assets, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` on port 4173 |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Watch mode |
| `npm run verify` | Tests + production build |
| `npm run images` | Re-run the asset pipeline only |
| `npm run stage` | Copy the shipped app in `APP/` into `dist/` |
| `npm run sync` | Stage and copy the web app into both native projects |
| `npm run android:apk` | Sync, then build a debug APK |
| `npm run android:bundle` | Sync, then build a release AAB for Play |
| `npm run android:open` | Open the project in Android Studio |
| `npm run android:run` | Sync and run on a connected device/emulator |
| `npm run ios:open` | Open the workspace in Xcode (macOS) |
| `npm run ios:run` | Sync and run on a simulator/device (macOS) |
| `npm run ios:pods` | Sync, then resolve CocoaPods (macOS, first build) |
| `npm run ios:sim` | Sync, then build an unsigned app for the Simulator (macOS) |
| `npm run ios:archive` | Sync, then archive a signed Release build (macOS) |

> `stage` is what puts the right app in `dist/`. The app that ships on both
> platforms is the standalone build in **`APP/`** (plain HTML/CSS/JS); `vite
> build` stages the older `src/` app instead, so the native build path goes
> through `stage`, never `build`.

---

## 5. Environment variables

The app needs none to run — it has no backend and no API keys. One optional variable
affects the build:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SITE_URL` | empty | Public origin, used to emit absolute `canonical` and `og:url` values. Leave unset for local or native builds. |

Copy `.env.example` to `.env` to set it. `.env` is git-ignored.

**On secrets:** everything under `src/` is compiled into the client bundle and into
the Android and iOS packages, where anyone can unpack and read it. Never put a key,
token or password there. A real backend, if one is ever added, must hold its secrets
server-side. The only genuine secret in this project is the Android signing keystore,
covered below and git-ignored.

---

## 6. Web build and deployment

```bash
npm run build      # -> dist/
npm run preview    # check it before shipping
```

`dist/` is a static folder; any static host will serve it. The build uses a relative
base (`./`), so it works from a domain root, from a sub-path such as GitHub Pages,
and from the native WebView without changes.

Routing is hash-based (`/#/passes`), so **no server rewrite rules are needed**. Point
your host's 404 handler at the included `404.html` if it supports one.

---

## 7. Android build and installation

### Status: **built, installed and run — verified end to end**

A debug APK was produced, installed on an Android 15 emulator, and driven
through a full edit cycle on this machine:

```
android/app/build/outputs/apk/debug/app-debug.apk    4.8 MB
package           com.vidulbhosale.buspass.debug
minSdkVersion     23   (Android 6.0)
targetSdkVersion  35   (Android 15)
permissions       INTERNET only
BUILD SUCCESSFUL in 4m 30s — 220 tasks
```

What was exercised on the running app (AOSP ATD, API 35, x86_64):

- Launches to the pass screen with the seeded record, no crash, **no warnings or
  errors in logcat**
- QR ⇄ Details toggle switches panels
- "Edit this pass" opens the prepopulated form (this is the path that the router
  parameter bug used to break)
- Typing into **Bus stop name** with the on-screen keyboard, then **Save changes**,
  updates the pass and the route line immediately
- The edit survives `am force-stop` and a cold relaunch
- The data is in `/data/data/.../shared_prefs/CapacitorStorage.xml`, confirming
  `@capacitor/preferences` is the real backing store on device

One defect was found and fixed this way: `Keyboard.setResizeMode` is iOS-only and
returned `UNIMPLEMENTED` on Android. It is now called only on iOS; Android keyboard
resizing comes from `windowSoftInputMode="adjustResize"` in the manifest.

> `adb exec-out screencap` returns a black frame for this app on a software-GPU
> emulator — a known WebView capture limitation, not a render failure. The UI was
> verified through `uiautomator dump`, which reads the real accessibility tree.

`INTERNET` is required by Capacitor itself: the WebView is served from
`https://localhost` by `WebViewAssetLoader`. The app makes no outbound network
requests and requests no other permission. Android auto-backup is **off**, so your
pass data is not copied to Google Drive — matching what the app tells you about where
your data lives.

### Build a debug APK

```bash
npm run android:apk
```

`scripts/gradle.mjs` locates a JDK 21 and the Android SDK automatically and writes
`android/local.properties` for you. Override with `JAVA_HOME` / `ANDROID_HOME` if it
picks the wrong one.

### Install on a phone

```bash
# USB debugging enabled on the phone
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to the device and open it (you will need to allow installation from
unknown sources).

The debug build uses the application id `com.vidulbhosale.buspass.debug`, so it
installs alongside a release build rather than replacing it.

### Release build for Google Play

A release build needs a signing keystore. **You must create this yourself** — it is
the identity of your app, it is not in the repository, and if you lose it you cannot
update the app on Play again.

```bash
keytool -genkey -v -keystore release.keystore \
  -alias buspass -keyalg RSA -keysize 2048 -validity 10000
```

Put it somewhere safe, then create `android/keystore.properties` (git-ignored):

```properties
storeFile=../release.keystore
storePassword=<your store password>
keyAlias=buspass
keyPassword=<your key password>
```

Then:

```bash
npm run android:bundle
# -> android/app/build/outputs/bundle/release/app-release.aab
```

If `keystore.properties` is absent the release task still runs and produces an
unsigned artifact. The version comes from `package.json`: `2.0.0` becomes
`versionName 2.0.0`, `versionCode 20000`.

> R8/ProGuard shrinking is deliberately **off**. Capacitor resolves plugin classes
> reflectively, and a shrunk release build has not been exercised on a physical
> device for this project. Turn `minifyEnabled` on in `android/app/build.gradle` only
> together with a real on-device test of the release build.

---

## 8. iOS build and installation

### Status: **project complete, not yet compiled**

The Xcode project is at `ios/App/App.xcodeproj`, with the app name, bundle id
`com.vidulbhosale.buspass`, version 2.0.0, deployment target iOS 14, the generated
icon and splash sets, a light interface style (the pass UI is a light design, and
this keeps WKWebView's date/time pickers light to match), and `arm64` as the
required capability (Capacitor's template ships `armv7`, which App Store Connect
rejects). The same web app ships here as on Android — `ios/App/App/public` and
`android/app/src/main/assets/public` are copied from one `dist/`, byte for byte.

**It has not been compiled.** Xcode and CocoaPods run only on macOS, and this
project was developed on Windows: `npx cap add ios` warned `Skipping pod install
because CocoaPods is not installed`, so the native dependencies have never been
resolved. The first build may surface issues that cannot be seen from Windows.
Everything that *can* be prepared without a Mac has been — see
[What is ready](#what-is-ready) below.

### Option A — on a Mac

```bash
# once
sudo gem install cocoapods

npm install
npm run sync              # stages APP/ into dist/ and copies it into ios/
npm run ios:pods          # resolves the pods that were skipped on Windows
npm run ios:open          # opens ios/App/App.xcworkspace
```

In Xcode: select the **App** target → **Signing & Capabilities** → choose your Team.
A free Apple ID will sign builds onto your own device for 7 days. Running on a
simulator needs no account at all.

Press ▶ to build and run. From the command line instead:

```bash
npm run ios:sim           # unsigned build for the Simulator - no account needed
npm run ios:archive       # signed Release archive (needs a Team)
```

### Option B — without a Mac, on GitHub Actions

`.github/workflows/ios.yml` builds this project on a macOS runner. It needs no
Apple account, no certificates and no secrets, because it targets the Simulator
and builds unsigned.

```bash
git push                                   # the workflow runs on push to main
gh workflow run "iOS build"                # or trigger it by hand
```

It runs `pod install`, compiles, then boots a simulator, installs the app and
launches it, and uploads `App.app` plus a screenshot of the running app as a build
artifact. That is also the first real check that the project compiles — until that
workflow goes green, the iOS build is unverified.

This path gives a Simulator build. Installing on a **physical iPhone** needs a
signing identity from an Apple account, so it needs either a Mac or signing
secrets added to the workflow; Apple allows no way around that.

### What is ready

| Piece | State |
|---|---|
| Xcode project, target, build settings | generated by Capacitor, bundle id and version set |
| `App.xcworkspace` | **added** — the workspace had no `contents.xcworkspacedata`, so it could not be opened at all |
| Shared `App` scheme | **added** — `xcodebuild -scheme App` needs it, and Xcode only auto-creates schemes in the IDE |
| Interface style | **changed** `Dark` → `Light` to match the white pass UI |
| Safe areas | **added** to the CSS — toolbar and drawer clear the notch / Dynamic Island, content clears the home indicator |
| Form inputs | **16px** — below 16px iOS zooms the page in when a field takes focus |
| Web assets in `ios/App/App/public` | synced, identical to the Android ones |
| Icon and splash sets | generated, light and dark |
| CocoaPods | **not resolved** — needs macOS |
| Compiled app | **not built** — needs macOS or the workflow above |

### Installing on a physical iPhone from Windows

The `device-ipa` job in the workflow produces **`DigitalBusPass-unsigned.ipa`**
(arm64, iphoneos SDK). Download it from the run's artifacts, or run
`gh run download <run-id> -n DigitalBusPass-ipa-unsigned`.

It is **unsigned**, and iOS will not run an unsigned app. Signing needs an Apple
identity, and Apple issues those only through Xcode or a paid Developer account -
CI cannot create one. So the `.ipa` has to be signed on your PC with your own
Apple ID, by a sideloading tool:

1. Install **Sideloadly** (<https://sideloadly.io>) or **AltStore**
   (<https://altstore.io>). Both need Apple's own iTunes and iCloud for Windows -
   the versions from apple.com, not the Microsoft Store ones.
2. Connect the iPhone by USB and trust the computer.
3. Drag `DigitalBusPass-unsigned.ipa` in, pick the device, enter your Apple ID,
   and start. The tool re-signs the app with your account and installs it.
4. On the phone: **Settings → General → VPN & Device Management →** trust the
   developer certificate. The app then opens.

What a free Apple ID costs you: the signature lasts **7 days**, after which the app
stops opening until it is re-signed (AltStore can refresh it over Wi-Fi
automatically; Sideloadly is manual). Three sideloaded apps at a time. A paid
Developer account ($99/year) extends the signature to a year and allows TestFlight.

These tools take your Apple ID credentials. That is inherent to signing with your
own account, not to this app - use an app-specific password where the tool supports
one, and read what you are installing first.

> With a Mac, skip all of it: `npm run ios:open`, pick your Team under
> Signing & Capabilities, plug the phone in, press ▶. A free Apple ID still gives
> the same 7-day limit, but nothing else is needed.

### Distribution

| Route | Needs |
|---|---|
| Simulator | Xcode only |
| Your own device, 7-day | Free Apple ID |
| TestFlight / App Store | Apple Developer Program, **$99/year** |
| Ad-hoc / Enterprise | Paid account, devices registered by UDID |

For TestFlight: **Product → Archive**, then **Distribute App**. `Info.plist` already
declares `ITSAppUsesNonExemptEncryption = false`, so uploads skip the
export-compliance prompt.

---

## 9. Data, storage and editing

### Where data lives

`@capacitor/preferences`, which maps to `SharedPreferences` on Android,
`UserDefaults` on iOS, and `localStorage` in the browser. One storage contract for
all three, and on a phone the data survives clearing the WebView cache.

Nothing is uploaded anywhere. There is no server, no analytics and no telemetry.

### The pass record

| Field | Type | Rules |
|---|---|---|
| `title` | string | Optional; auto-named from stop and month |
| `name` | string | Required, 2–60 chars, letters/spaces/apostrophes/hyphens |
| `employeeId` | string | Required, 3–15 chars, alphanumeric and hyphens |
| `busStop`, `destination` | string | Required, must differ from each other |
| `routeType` | A–F | Required |
| `serviceType` | FAST / SLOW / DIRECT / SHUTTLE | |
| `returnTrip` | boolean | |
| `stops[]` | string[] | Up to 40, no duplicates |
| `startDate`, `endDate` | `YYYY-MM-DD` | Real dates; end ≥ start; span ≤ 400 days |
| `inTime`, `outTime` | `HH:MM` | Required, must differ. An out time earlier in the day is accepted as an overnight shift, with a non-blocking note |
| `status` | confirmed / pending / rejected | A confirmed pass past its end date displays as **expired** |
| `notes` | string | Up to 2000 chars |

Dates are stored as plain strings with no timezone attached, so a pass valid on the
1st is valid on the 1st wherever the phone happens to be.

### Editing

Every screen that shows a pass offers **Edit**. The form opens prepopulated; each
field can be changed on its own. Validation runs on submit and then live on every
keystroke and blur, with the error summary counting unresolved fields and focus
jumping to the first one. Save, Cancel and Delete are always reachable in a sticky
bar above the keyboard.

Changes are written through `repository.js`, which validates again before persisting
— an invalid record cannot reach storage even if a caller bypasses the form. On
success the store broadcasts a change and every open screen re-renders, so an edit is
visible on the home screen, the list and the alerts badge immediately.

Leaving with unsaved edits is caught on in-app navigation, browser back, Android
hardware back, and page unload.

### Backup

**Settings → Your data → Export backup** writes a JSON file (on a phone, where a
WebView cannot write to the downloads folder, it copies to the clipboard instead).
**Restore** reads one back, offering merge or replace. Unreadable records are skipped
and counted rather than failing the whole restore.

---

## 10. Testing

```bash
npm run verify     # build + 119 tests
```

### Automated — 119 tests, all passing

| Suite | Tests | Covers |
|---|---|---|
| `dates.test.js` | 13 | Leap years, month ends, year boundaries, 12/24-hour formatting, overnight spans, local-vs-UTC date derivation |
| `validation.test.js` | 18 | Every field rule, accented and hyphenated names, single-day passes, duplicate stops, overnight shifts as warnings not errors |
| `schema.test.js` | 21 | Normalisation of malformed input, expiry derivation, route line, alert generation and badge counting, 2000-id collision check |
| `repository.test.js` | 21 | Seeding, CRUD, persistence across reload, partial updates leaving other fields untouched, rejected writes leaving records untouched, active-pass reconciliation on delete, export/import round-trip, corrupt-JSON recovery |
| `router.test.js` | 19 | Parameter extraction and encoding, 404 fallthrough, pattern isolation, guards on programmatic and external navigation, teardown |
| `dom.test.js` | 12 | Markup in user input is rendered as text, never parsed |
| `build.test.js` | 15 | Production output: metadata, manifest, every referenced icon exists, no `console.log`, no source maps, bundle under 250 KB, images under budget |

### Manual — browser, verified

Driven against the running app in Chrome:

- **Horizontal overflow: 0px** at 320 / 375 / 390 / 430 / 768 / 1024 / 1440 px, on all
  six routes, with the drawer open, the details tab active, and 100-character
  unbroken strings in every text field.
- **Edit flow:** form prepopulates; changing stop, in-time and end date and saving
  shows a success toast, returns home, updates the home screen *and* the list, and
  survives a reload.
- **Validation:** empty submit is blocked with an error summary, `aria-invalid`
  fields, an error toast and no write; end-before-start is blocked and flagged.
- **Unsaved-changes guard:** dialog appears, the URL does not advertise the
  destination while it is open, "Keep editing" preserves the typed value, "Discard"
  completes the navigation the user asked for.
- **Delete:** confirmation shown, record removed, empty state rendered.
- **Dead controls:** every button, link, tab and field audited across all six routes —
  **no placeholder links, no empty handlers**.
- **Console:** no errors or warnings across all routes and interactions; no failed
  network requests; all images load.

### Manual — Android device, verified

Full detail in section 7. In short: installed on an Android 15 emulator, launched,
navigated, edited, saved, force-stopped and relaunched, with the change persisted to
`SharedPreferences`. Logcat clean.

### Not verified

- **The iOS app at all** — see section 8.
- **A physical Android handset.** Testing was on an x86_64 emulator; real hardware
  differs in GPU, WebView version and keyboard behaviour.
- **A release (signed, R8) Android build at runtime** — only the debug build was run.
- Browsers other than Chromium. The code targets `es2020 / chrome90 / safari14` and
  uses no API outside that baseline, but Safari and Firefox were not opened.
- Screen readers. ARIA roles, labels, focus trapping and focus restoration are
  implemented and inspected in the accessibility tree, but not driven with VoiceOver,
  TalkBack or NVDA.

---

## 11. Known limitations

1. **No backend.** Data lives on one device. Two phones do not sync; moving device
   means exporting and restoring a backup.
2. **No authentication.** Anyone holding the unlocked phone can edit the pass. Access
   control would only be meaningful with a server to enforce it; the device lock
   screen is the real boundary here.
3. **The QR image is a fixed picture**, carried over from the original. The app
   displays it; it does not generate or verify it. Replacing it means replacing
   `assets-src/QR.png` and re-running `npm run images`.
4. **iOS is unbuilt** — a Mac is required.
5. **Release Android builds are unsigned** until you supply a keystore.
6. **No offline service worker.** The native apps are fully offline because their
   assets are packaged in the app. The *web* build still needs its first load from
   the network; after that the browser cache usually covers it, but there is no
   explicit offline guarantee.
