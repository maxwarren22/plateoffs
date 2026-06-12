# Future Features — Plateoffs

Two features targeting Apple App Store featuring consideration. Both extend the core bracket/voting loop into social and ambient surfaces.

---

## 1. Group Vote Sessions (Anonymous Multiplayer)

### What it is
A host starts a Plateoffs showdown and shares an invite link. Friends join via deep link with no account required — everyone votes on the same bracket in real time, majority rules, results are live.

### Why it fits
The app's core premise is already "decide together what to eat." This makes that literal without requiring a FaceTime call or SharePlay entitlements. Works over iMessage, group chat, or anywhere a link can be shared.

### Entry Point
The intro screen ("START THE SHOWDOWN") is replaced with two mode buttons:
- **SOLO** — existing flow, no changes
- **MULTIPLAYER** — creates a session, then proceeds to the lobby to pick a division

This keeps the decision at the very start of the experience, giving the app a game-like identity from the first tap.

### User Flow
1. Host taps **MULTIPLAYER** on the intro screen
2. App silently creates a pending session and proceeds to the lobby
3. Host picks a division — at this point the session is activated and a short code + deep link are generated: `plateoffs://session/X7K2`
4. A share sheet appears automatically so the host can send the link before the bracket starts
5. Friends tap link → app opens to a waiting room → session begins once host starts, or after a countdown
6. Each matchup waits for a configurable window (e.g. 60s) or until all participants have voted
7. Votes aggregate live — all participants see a running tally as votes come in
8. Majority winner advances; bracket plays out to a group champion

### Identity Without Accounts
Use **Supabase Anonymous Auth**. On first app launch (or first session join), the app silently calls `supabase.auth.signInAnonymously()`. This gives every device a stable UUID with no signup friction. That UUID is used to enforce one vote per device per matchup.

Anonymous sessions persist across app restarts via Supabase's session storage. If a user later creates a real account, Supabase supports linking the anonymous identity to the new account.

### Data Model

```sql
-- New migration needed

CREATE TABLE vote_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,           -- short human-readable join code
  division_id   uuid REFERENCES plateoffs_divisions(id),
  host_device_id uuid NOT NULL,                 -- anon user id of creator
  status        text NOT NULL DEFAULT 'waiting', -- waiting | active | complete
  current_matchup_index int NOT NULL DEFAULT 0,
  recipe_ids    uuid[] NOT NULL,                -- ordered bracket, inherited from division
  created_at    timestamptz DEFAULT now(),
  expires_at    timestamptz                     -- e.g. 24h TTL
);

CREATE TABLE session_votes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid REFERENCES vote_sessions(id) ON DELETE CASCADE,
  matchup_index int NOT NULL,
  voter_id      uuid NOT NULL,                  -- anon user id
  recipe_id     uuid NOT NULL,
  voted_at      timestamptz DEFAULT now(),
  UNIQUE (session_id, matchup_index, voter_id)  -- one vote per matchup per device
);

CREATE TABLE session_participants (
  session_id    uuid REFERENCES vote_sessions(id) ON DELETE CASCADE,
  voter_id      uuid NOT NULL,
  joined_at     timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, voter_id)
);
```

### Deep Link Handler
App scheme is already `plateoffs://` (configured in `app.json`). Add a route at `app/session/[code].tsx` that:
- Fetches the session by code
- Calls `signInAnonymously()` if no session exists
- Registers the device in `session_participants`
- Navigates into the live bracket UI

### Real-time
Use **Supabase Realtime** (postgres_changes on `session_votes`) to push vote counts to all participants as they come in. The host screen shows a live vote bar per matchup. No polling needed.

### Session Lifecycle
- Sessions expire after 24 hours (enforced by `expires_at` + a Supabase cron or edge function)
- A session with no activity for 30 minutes auto-closes
- The host can end early

### Open Questions
- Does the bracket need to be the same division the host is in, or can the host pick any active division?
- Should the vote window be time-based (60s countdown) or "all votes in" or both?
- Do results get saved to the host's champion history?

---

## 2. iOS Home Screen Widget

### What it is
An interactive widget on the iOS home screen showing the active matchup so users can vote without opening the app.

### Why it fits
Reduces friction on the core loop. If someone glances at their phone mid-afternoon and sees two recipes facing off, they vote. This drives daily engagement passively.

### Widget Sizes

| Size | Content |
|------|---------|
| **Small** | Current division champion — recipe name + cover photo. Taps open the app. |
| **Medium** | Two-card matchup side by side — tap left or right to vote. Requires iOS 17+ interactive widgets. |
| **Lock Screen** | Division rotation countdown, or "🏆 [Recipe] won last night" |

### Interactive Widget (Medium)
iOS 17 introduced interactive widgets via `AppIntent`. Tapping a recipe card in the widget fires an intent that records the vote and updates the widget state — no app launch required.

The medium widget needs to know the current matchup. It reads from a shared `App Group` container that the main app writes to on each matchup load. The widget reads from the same container on its timeline refresh.

### Implementation Stack
Expo does not have a first-party widget SDK. Options:

**Option A — `expo-widget` (community, early):** Some community config plugins exist but are not production-ready as of mid-2025.

**Option B — Native Swift widget target (recommended):** Add a `WidgetExtension` target in Xcode. Write the widget in SwiftUI. Communicate with the React Native app via:
- Shared `UserDefaults` in an App Group (the RN app writes current matchup JSON; widget reads it)
- A native module that the RN app calls to push matchup data into the shared container

This requires bare workflow (already implied by the native SharePlay work if pursued).

### App Group Setup
Bundle ID: `com.curatemyplate.plateoffs`
App Group ID: `group.com.curatemyplate.plateoffs`

Both the main app and widget extension must be members of this group in the Apple Developer portal + `eas.json`.

### Data the Widget Needs
```json
{
  "matchupIndex": 3,
  "recipeA": { "id": "...", "name": "Chicken Tikka", "imageUrl": "..." },
  "recipeB": { "id": "...", "name": "Shrimp Tacos", "imageUrl": "..." },
  "divisionName": "Weeknight Warriors",
  "rotationExpiresAt": 1720000000000
}
```
Written to App Group UserDefaults by the RN app whenever the lobby loads or a matchup advances.

### Vote Recording from Widget
The `AppIntent` handler (Swift) writes the vote choice back into the App Group container and posts a notification the main app observes on next launch to reconcile. For anonymous group sessions, the intent would also need to call the Supabase REST API directly from Swift — doable but adds complexity. For v1, widget voting only applies to solo sessions.

### Open Questions
- Does the widget show the global division matchup (same for everyone) or the user's in-progress personal bracket?
- Image caching: widget timelines refresh infrequently — images need to be pre-downloaded into the App Group container, not fetched at render time.

---

## Priority & Sequencing

| Feature | Effort | App Store Differentiation |
|---------|--------|--------------------------|
| Group Vote Sessions | Medium — pure JS/Supabase, no native code | High — social hook, shareable, screenshot-worthy |
| iOS Widget (small, read-only) | Medium — native Swift but no interactivity | Medium — visible on home screen in App Store screenshots |
| iOS Widget (medium, interactive) | High — AppIntent + App Group sync | High — rare for food apps |

**Recommended order:** Group Vote Sessions first (ships faster, no native work, strong editorial story), then widget small/read-only, then interactive widget.
