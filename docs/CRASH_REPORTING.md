# Crash Reporting & Symbolication

## Setup

**Package:** `@sentry/react-native` v8  
**Sentry project:** `plateoffs-native` (org: `curate-my-plate`)  
**Initialized in:** `app/_layout.tsx` — module-level `Sentry.init()` runs before any component mounts  
**Disabled in dev:** `enabled: !__DEV__` — Sentry is off during local development  

### Required secrets (one-time setup)

| What | Where | How |
|------|-------|-----|
| `SENTRY_AUTH_TOKEN` | EAS project secrets | `eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>` |
| `EXPO_PUBLIC_SENTRY_DSN` | `.env.production` or `.env.local` | Copy DSN from sentry.io → Project Settings → Client Keys |

The auth token is at **sentry.io → Settings → Auth Tokens**. It needs `project:releases` and `org:read` scopes.

### How symbols get uploaded

The `@sentry/react-native/expo` config plugin in `app.json` hooks into the EAS build. On every `eas build --profile production`:

- **iOS dSYMs** are uploaded automatically after the Xcode archive step
- **Hermes source maps** are generated and uploaded so JS stack frames resolve to TypeScript line numbers

No manual steps needed after the initial secrets setup.

---

## Reading a crash report

### From Sentry dashboard (after setup)

Future crashes will appear in sentry.io with fully symbolicated stack traces. Native frames show file/line, JS frames show the TypeScript source location.

### From a raw `.ips` file (e.g. from a TestFlight tester)

The `.ips` is JSON. Key fields to read first:

```
exception.type       — crash type (EXC_CRASH, EXC_BAD_ACCESS, etc.)
termination.indicator — human-readable signal (Abort trap: 6, etc.)
asi                  — Apple crash reporter message (e.g. "abort() called")
faultingThread       — index into threads[] for the crashing thread
legacyInfo.threadTriggered.queue — the dispatch queue name
```

Find the faulting thread in `threads[]`, then read its `frames[]` top-to-bottom. Frames with `"imageIndex": 0` are your app binary — they'll only show `imageOffset` until symbolicated.

To symbolicate manually using Xcode:

```bash
# Download the dSYM from EAS:
eas build:list --platform ios --profile production
# Click the build → Download dSYM bundle

# Symbolicate:
xcrun symbolicatecrash crashlog.ips Plateoffs.app.dSYM > symbolicated.txt
```

### Common crash patterns in React Native

| Signal | `exception.type` | Typical cause |
|--------|-----------------|---------------|
| `SIGABRT` | `EXC_CRASH` | Uncaught ObjC exception, `assert()`, or `abort()` in native code |
| `SIGSEGV` | `EXC_BAD_ACCESS` | Null pointer dereference, use-after-free |
| `SIGBUS` | `EXC_BAD_ACCESS` | Unaligned memory access |
| Watchdog | `EXC_CRASH` | App hung >20s at launch (0x8badf00d in termination code) |

If the faulting thread queue is `com.meta.react.turbomodulemanager.queue`, the crash originated from a JavaScript call into a native TurboModule. Look for the `ObjCTurboModule::perform*Invocation` frame — the frame above it in the native library is where the exception was thrown.

---

## Known issues fixed

### startup crash on iOS 26 — `EXC_CRASH` on `turbomodulemanager.queue` (May 2026)

**Build:** v1.0.0 (build 5)  
**Device:** iPad Air M2 (`iPad15,3`) running iOS 26.5  
**Incident:** `BE91F594-3A0C-47DA-8E42-CDB13CE04CF0`

**Root cause:** `lib/notifications.ts` called `Notifications.setNotificationHandler()` at module scope. Expo Router's `require.context()` loads all route files at startup, so `lobby.tsx` → `notifications.ts` was evaluated immediately on launch. `setNotificationHandler` registers a listener on `ExpoNotificationsHandlerModule` (a TurboModule); on iOS 26, this throws an uncaught ObjC exception. Because the call is dispatched to the turbomodule background queue, there is no surrounding ObjC catch block — the exception reaches `std::terminate` → `abort()`.

The Simulator did not reproduce because iOS Simulator stubs out `UNUserNotificationCenter` calls without throwing.

**Fix:** Moved `setNotificationHandler` into an exported `initNotificationHandler()` function wrapped in try-catch, called once from `_layout.tsx`'s `useEffect`. See `lib/notifications.ts` and `app/_layout.tsx`.
