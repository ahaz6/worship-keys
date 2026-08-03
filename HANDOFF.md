# Worship Keys — Handoff

State of the product, why it is built the way it is, what is genuinely finished,
and what the next person should know before touching it.

Built against `Worship-Keys.md` (product spec) and `Design-Art.md` (art
direction). Both stay in the repository as the reference.

## 1. Where the product stands

Phases 1–8 of the spec are implemented and exercised against a running build.
Phase 9 hardening covers typecheck, lint, unit tests, production build,
desktop/tablet review and the central Playwright host flows.

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Foundation, design system, three-area shell, logo and favicon | Done |
| 2 | Pad engine, fades, crossfade, sound controls, audio I/O, local import | Done |
| 3 | Web MIDI, note state, sustain, chord detection | Done |
| 4 | Nashville numbers, enharmonics, input transpose and calibration | Done |
| 5 | Prepare / Crescendo / Switch, transition state machine | Done |
| 6 | Setlists, song CRUD, IndexedDB persistence and migration | Done |
| 7 | Voice commands as progressive enhancement | Done |
| 8 | Local live session: host, leader, viewer over WebSocket | Done |
| 9 | Hardening | Partial — see §7 |
| 10 | GitHub publication | Done — see §9 |
| 11 | Public Vercel performance app and Drive import endpoints | Done — see §4 and §6 |
| 12 | Serverless Cloud Live host + QR Join UI through Supabase Realtime | Done — see §3 and §4 |

## 2. Architecture

### Process model

There are two live transports behind the same React session hook. Cloud Live is
the Vercel default: the host browser is the authority and Supabase Realtime
Broadcast carries compact snapshots and commands. Audio, MIDI and transitions
remain in that host tab, so no local process is required.

For the optional offline/LAN fallback, `server.mjs` owns the socket. Next.js
cannot take the HTTP upgrade itself, so a single Node process:

- serves the app through the Next request handler,
- answers `/api/session/*` itself,
- routes `/session` WebSocket upgrades to the session server.

Keeping the session endpoints in this process rather than in Next route handlers
is deliberate: the HTTP endpoints and the socket must share one `SessionStore`
instance, and Next bundles its server code separately from `server.mjs`.

`server.mjs` imports the session runtime as TypeScript directly. Node 22 strips
types natively, which is why `lib/session/*.ts` uses relative imports with
explicit `.ts` extensions while the rest of the codebase uses the `@/` alias.

### Layers

```
app/                 Next App Router pages; worship-keys-app.tsx is the host screen
components/          Presentational React, grouped by concern
lib/audio/           Pad engine, crossfade maths, asset loading
lib/midi/            Web MIDI access, byte parsing, sounding-note state
lib/music/           Pitch, chord templates, detector, stabiliser, Nashville, notation
lib/transitions/     Prepared-key state machine and the qualifying-chord rule
lib/voice/           Speech adapter seam and the command parser
lib/io/              Device enumeration and honest browser-capability reporting
lib/session/         Wire protocol, authorization, canonical store, WS server, client
lib/storage/         Zod schemas, migrations, IndexedDB repository, setlist edits
lib/google-drive/    Service-account Drive upload/download and paired-host access
lib/supabase/        Browser auth plus server-side bearer-token verification
lib/hooks/           The React seams over each of the above
app/api/             Protected Drive deploy and current-setlist download routes
scripts/             Pad synthesis and icon derivation
tests/               Vitest suites
```

Audio, MIDI and music theory are pure modules with no React in them. That is
what makes the fast unit-test suite possible and it is worth preserving.

## 3. Decisions worth knowing

**Sound Wall Pads is the single visible pad pack.** `scripts/prepare-sound-walls.mjs`
extracts all twelve keys from the project owner's supplied 48 kHz stereo
recordings, loudness-normalises them and creates 24-second loops with an eight-second
equal-power seam. The original 30-minute files stay on the external SSD and
outside Git. The live graph adds bounded shimmer, tone, brightness, motion and
mid/side width controls without modifying playback rate or loop pitch.

**Three gain stages, never fighting.** Fades automate `fadeGain`, the volume
fader owns `volumeGain`, crescendo owns `crescendoGain`, and a key change
automates the two per-voice `keyGain` nodes. Fade in and fade out therefore aim
at the *stored* main volume without ever rewriting it, and a crossfade during a
fade does not corrupt either automation.

**Shimmer is a real octave layer.** `public/worklets/shimmer-processor.js` is a
granular pitch shifter: it keeps a short delay line of the pad and reads it back
at twice the write rate through two overlapping windowed grains. Changing
`playbackRate` was not an option — that would move the pad's own pitch and loop
length. If `AudioWorklet` is unavailable the send degrades to a filtered reverb
and the UI says so rather than pretending.

**Pad Motion never touches pitch.** `AudioBufferSourceNode.playbackRate` stays
at 1.0. Motion drives filter cutoff, a slow pan and the shimmer send only.

**The concert key is the only transpose applied to pads; input transpose is the
only one applied to MIDI.** There is deliberately no third, hidden transpose.

**Nashville degrees are measured against the parallel major scale.** That one
rule reproduces both the major and the minor tables in the spec, so only the
*expected* quality differs by mode — and the expected quality never overrides
what was actually played. A D major in C reads `2`, not `2m`.

**The detector prefers `Ambiguous` to a confident wrong answer.** The active key
is only a weak tiebreaker (+0.03), so a borrowed or chromatic chord still wins.

**The prepared switch is hard to fire by accident.** It needs a target armed, a
chord above the confidence floor, a chord that started *after* arming, at least
one physically held note, ~140 ms of stability, and by default the target tonic
with a matching mode. `Switch now` is always available.

**The live session is command → host → acknowledge → broadcast.** The server
validates role and expected revision, forwards to the host, and only advances
the canonical revision once the host confirms it actually performed the audio
action. A host that does not answer within 2.5 s produces "Command not applied"
rather than a leader screen that lies.

**A LAN is not a trust boundary.** Viewers are refused server-side, not by
hidden buttons. The host bootstrap secret is served to loopback callers only.
The leader PIN is stored as a salted hash for the session's lifetime.

**Cloud Live is browser-owned, not a Vercel WebSocket server.** Vercel serves
the public host at `/` and `/play`. The host tab creates a random high-entropy
room, displays a `/join?cloud=1&t=…` QR link, publishes its snapshot through
Supabase Realtime and executes acknowledged Leader commands. Web Audio and MIDI
never leave that tab. Setlist preparation now happens directly in `/play`;
`/cloud` redirects there. `server.mjs` is only an optional offline/LAN fallback.

**Prepared pad loops belong in the Vercel artifact.** `.vercelignore` excludes
the owner-supplied source recordings but deliberately includes `public/pads/`.
Excluding that directory leaves a UI that builds successfully while every WAV
returns 404, so production verification must always request at least one real
pad URL and complete a 12-key preload.

**Google Drive has one canonical handoff file.** `Deploy to Google Drive`
updates the existing file `Worship Keys Current.worship-keys.json`; it does not
create timestamped copies. The service account has writer access to that file
only, not to the whole Drive folder. The main audio UI's `Open setlist from
Drive` button downloads and schema-validates that exact file without opening a
native file picker.

**The paired church host has read-only authority.** The local Mac has no Google
private key. A random read token lives in the macOS Keychain under service
`com.worship-keys.drive-read` and as a Sensitive Vercel environment variable.
The local API forwards it server-to-server; it is never sent to the browser.
Production rejects unauthenticated reads. Signed-in, allowlisted Supabase users
remain a supported fallback.

**The Sound Wall mixer is service-global, not song-owned.** Song changes update
the key and tempo, but they do not reset main volume, tone, shimmer, brightness,
stereo width or fade timings. The host and Join Leader therefore see one stable
live mixer for the whole setlist. Song changes always use an equal-power
crossfade, including two adjacent songs that happen to use the same pad asset.

**Join automation telemetry is deliberately non-semantic.** Fade progress,
crossfade progress and the held Crescendo state are broadcast by the host, but
those animation frames do not advance the command revision. Unrelated partial
state messages also do not inject schema defaults. This prevents valid leader
commands from becoming stale and prevents a held Crescendo or spatial XY value
from being reset by another fader packet.

**The Vercel Join UI supports Cloud Live and Offline Church Mode.** Cloud
links subscribe to the host's opaque Supabase room without private-IP browser
permission. The installed macOS church host shows a private
`http://<private-ip>/join?t=…` QR and also retains the public
`/join?host=…&t=…` compatibility URL. The Join page opens
`ws://<private-ip>/session` directly after the browser's
Local Network Access permission and never relays live notes through Vercel.
Only RFC1918, link-local, loopback and `.local` destinations are accepted. The
leader-PIN HTTP exchange has exact-origin CORS/LNA headers for the production
Vercel origin. Tokens are stored per LAN host so two churches cannot reuse each
other's device identity accidentally.

**Offline Church Mode is the recommended Sunday runtime.** `npm run
church:install` creates `~/Applications/Worship Keys Church.app` with the
original app icon. It launches the production host without a Terminal window,
prefers a physical private interface over VPN/bridge interfaces, and writes its
log to `~/Library/Logs/Worship Keys/church-host.log`. The host UI never renders
the Vercel URL in this mode: its QR points directly at the selected RFC1918
address. The readiness card verifies local hosting, a private router address, a
non-empty saved setlist and all 12 decoded pad keys. Once ready, host and Join
pages make no external browser requests. Internet, Vercel, Supabase and Google
Drive are therefore outside the live-service path.

The church Mac may connect by Ethernet. Phones and tablets still need a Wi-Fi
access point bridged into that router if the router itself has no wireless
radio. No internet uplink is required. See `OFFLINE-CHURCH.md` for the complete
pre-service and Sunday checklist.

## 4. Verified behaviour

Exercised in a production build in a real browser, not only in unit tests:

- All 12 keys decode and become available; the ribbon reports `12 of 12 ready`.
- `Fade in` moves through `Fading in` → `Playing` with the output meter rising.
- Reversing a fade mid-flight continues from the current level and does not
  start a second copy of the pad.
- Prepare → `Switch now` → crossfade → complete: the meter never drops out
  during the crossfade, and the concert key is adopted only at the end.
- A viewer WebSocket is refused on all three attack shapes it can try:
  a leader command (`This device is view only.`), a host command
  (`Only the host can change session settings.`), and a forged engine-state
  patch (`Only the host reports engine state.`).
- Join by QR token lands as viewer; the correct PIN upgrades that device to
  leader; the host panel then shows `Remove leader` and `Revoke`.
- A leader `Fade in` and a leader `Prepare D` both reach the host, change real
  audio, and come back as a confirmed snapshot.
- The Join Leader transport mirrors the host's fade-in/fade-out progress bars,
  shows live song-crossfade progress and keeps Crescendo held at its peak until
  the same button is pressed as `Release Crescendo`.
- Moving Main Volume or any fade-time control on Join does not move the
  Brightness/Stereo Width XY surface. A manual spatial edit also cancels any
  stale Crescendo-return animation before it can overwrite that position.
- Previous/next song from Join performs the same smooth equal-power crossfade
  as the main host UI while all Sound Wall mixer values remain stationary.
- Desktop 1440×900, tablet landscape 1024×768 and tablet portrait 768×1024 were
  reviewed; the portrait rail collapses to a compact band so the performance
  stage stays above the fold.
- The legacy protected Drive endpoints remain available, but there is no
  separate cloud-planner UI anymore.
- The local main UI imports that fixed Drive file with one click through the
  paired-host route: real production verification returned HTTP 200, the exact
  file name, and the Drive setlist name. A direct unauthenticated production
  request returns HTTP 401.
- The stable Vercel production URL is
  <https://worship-keys-psi.vercel.app>.
- That production root opens the public performance UI without authentication,
  exposes `Connect MIDI keyboard`, loads all twelve Sound Wall keys after the
  required audio gesture and advertises an installable standalone web manifest.
- `/play` is the single preparation and performance route. `/cloud` redirects
  there, including on the local server for verification.
- `/play` contains the protected Google Drive handoff dialog. The authorized
  account can deploy the current browser setlist from a phone and import the
  same fixed JSON file on the church Mac; there is still no setlist database.
- `Show join code` on the Vercel host creates a Cloud Live QR link. A clean
  second Chrome profile was verified joining as Viewer, receiving the complete
  snapshot, upgrading with the six-digit PIN and changing songs through the
  same equal-power host crossfade. No `npm start` or LAN IP was involved.
- The previous local `host=…` Join URL remains supported as a fallback.
- The local direct Join URL remains visible in the QR dialog as a fallback for
  Safari or managed browsers that deny cross-network WebSockets.

Five real bugs were found this way and fixed:

1. A reversed fade-out left its completion timer running, which later told the
   transition machine the pad had stopped while it was still playing. The timer
   now asks the engine for the truth before acting.
2. The host's `run-command` handler was re-registered on every render, so its
   cleanup removed the handler in the same commit that delivered an inbound
   command — every leader command timed out. It is now registered once behind a
   ref.
3. Zod defaults on partial session patches silently supplied Brightness, Width
   and automation values that were absent from the packet. Patch schemas now
   preserve true partial-update semantics; full snapshots still provide all
   required values explicitly.
4. Song selection re-applied song-owned mixer settings and made the Pad Sound
   panel jump. The live mixer is now service-global and remains unchanged
   across setlist navigation.
5. Same-key adjacent songs skipped the pad transition because they shared an
   asset URL. Song navigation now requests a deliberate same-asset restart and
   crossfades the two independent voices.

## 5. Testing

`npm test` runs the Vitest unit and asset suites. `npm run test:e2e` exercises
setlist workflows plus the live host → viewer → leader session in Chrome.

The current verification baseline is **162 passing Vitest tests across 11 test
files**, plus typecheck, ESLint, all **7 Playwright browser flows** (including a
real two-profile Supabase Cloud Live session and an offline host/device request
audit) and a successful Next production build. Dynamic routes include `/api/deploy-setlist`,
`/api/open-setlist-from-drive` and `/api/session/qr`.

- `tests/nashville.test.ts` — every mandatory case from spec 12.4, all 12 roots
  × major/minor, all 12 keys × diatonic degrees in both modes, borrowed chords,
  inversions, the full −12…+12 transpose range, enharmonic spelling.
- `tests/midi.test.ts` — note on/off, velocity-0 note off, repeated notes,
  sustain hold and release, device disconnect, the stabiliser's gather and
  release windows, calibration suggestions.
- `tests/audio-curves.test.ts` — equal-power crossfade holds constant power,
  fades land exactly on their target, volume mapping round-trips, motion labels.
- `tests/transitions.test.ts` — the whole state machine plus every rejection
  reason for the qualifying-chord rule.
- `tests/setlist.test.ts` — add never overwrites, duplicate/move/remove,
  time-signature maths by denominator, persistence and schema migration.
- `tests/session.test.ts` — PIN hashing, loopback detection, role permissions,
  join and rejoin, leader handover, revisions, idempotency, snapshot hygiene,
  non-resetting partial settings and automation telemetry revisions.
- `tests/lan-endpoint.test.ts` — private-IP allowlist, hostile/public endpoint
  rejection and deterministic cloud/local Join URL generation.

## 6. Honest limits

- **Web MIDI needs Chromium.** Safari and Firefox get a clear "not supported"
  state; everything else in the app still works.
- **Speech recognition may be a remote service.** The privacy notice is shown
  before the microphone is opened. When `SpeechRecognition.start(track)` is not
  available the browser transcribes the *system* input, and the panel says so
  instead of pretending the chosen device is being used.
- **Output selection needs `selectAudioOutput` + `AudioContext.setSinkId`.**
  Without them the app shows `System default` and points at system settings
  rather than offering a dropdown that does nothing.
- **The browser will not hand over 32 SQ channels.** Only the channels actually
  present on the open track are offered. The Connection help explains the
  reliable route: patch what you need onto SQ USB 1–2.
- **The app cannot tell whether a cable is plugged in.** The meter shows what
  Worship Keys is producing and the UI never claims `Cable connected`.
- **Imported pads are browser-local.** Audio and preset metadata persist in
  IndexedDB but never sync to another browser or upload to the host.
- **Opening the Drive setlist requires internet access.** Once imported, the
  local setlist, pads and MIDI keep working. Cloud Live also needs Supabase;
  the optional `server.mjs` LAN mode does not.
- **Cloud Live needs internet access to Supabase.** Pad audio keeps running in
  the host tab during an interruption, but Join screens become stale until
  Realtime reconnects. Use the optional LAN host when offline operation is a
  hard requirement.
- **Vercel-to-LAN requires browser permission.** Current Chromium prompts for
  Local Network Access when the public Join UI opens the private WebSocket.
  Other browsers or managed policies may block it. The generated local HTTP
  Join URL is the reliable fallback; top-level navigation is not mixed content.
- **Wi-Fi client isolation still wins.** No cloud code can make two devices on
  a guest network reach each other. Use a dedicated router/SSID, keep all
  devices on the same subnet and give the host Mac a stable DHCP reservation.
- **The web manifest does not make pads offline-first.** The app is installable,
  but a first load still needs internet to download the selected WAV files.
  Browser HTTP caching helps later visits; no service worker promises offline
  audio yet.
- **The current Drive file can legitimately be empty.** At this handoff it is
  named `Sunday Setlist 02. August 2026` and contains zero songs because that is
  the most recently deployed cloud state. Deploy a populated setlist from the
  Cloud Planner before Sunday if songs are expected in the one-click import.
- **Supabase registration currently auto-confirms email addresses.** This avoids
  the built-in SMTP rate limit but means addresses are unverified. Before broad
  public signup, configure custom SMTP and re-enable email verification.
- **Local HTTPS is not set up.** For a PWA install and for Web MIDI outside
  localhost you will want a trusted local certificate.
- **`next dev` did not hydrate in the sandboxed browser used for verification.**
  The production build hydrates correctly and all browser verification above was
  done against `npm start`. Worth a look on a normal machine before assuming it
  is a project problem.
- **`npm audit` reports zero known vulnerabilities** at this handoff.

## 7. Not done yet

- Drag-and-drop setlist reordering (buttons and keyboard move songs today).
- Hardware-in-the-loop coverage for real MIDI and audio devices.
- The optional 32×32 CoreAudio bridge (spec 17.8) — the browser stereo path is
  the shipped mode and the UI explains the limit.
- Separate major/minor pad audio. The shipped packs are root/fifth/octave drones
  with no third, so one set serves both modes; spec 27.2 leaves this open.

## 8. Open product questions

Spec section 27 lists these; the safe defaults are what shipped:

1. Only the target tonic triggers a prepared switch. `Allow the target key's 4
   and 5` is an opt-in checkbox.
2. Neutral drones with no third, one set for both modes.
3. Minor Nashville is relative with explicit `♭3`, `♭6`, `♭7`.
4. Crescendo prepares only; it does not switch on its own.
5. Voice phrases are English first; German is selectable and untested in a room.
6. Output routing works where the browser supports it, with a documented fallback.
7. The PIN is enough for the first leader; a second device always needs host
   confirmation.
8. Cloud Live through Supabase is the Vercel default; LAN remains the optional
   offline fallback.

## 9. Repository

- Repository: <https://github.com/ahaz6/worship-keys> (private)
- Branch: `main`
- Feature baseline before this Cloud Live update: `525c782`
  (`Connect Vercel Join UI to LAN hosts`).
- Relevant Drive/cloud commits:
  - `e98f92c` — secure Google Drive setlist deployment
  - `1fd78fc` — one-click Drive setlist import
  - `aa993c6` — paired church-host read access

The handoff update itself is necessarily a later commit than the feature
baseline above. `main` is the deployment source of truth.

Nothing secret is committed. `.env*` is ignored, no tokens are in the tree, and
all audio in `public/pads/` is generated by the committed script. Production
secrets are Sensitive Vercel variables; the local read token is in macOS
Keychain, and the Google service-account private key is not stored on the Mac.

### Production services

- Vercel project: `worship-keys`
- Production alias: <https://worship-keys-psi.vercel.app>
- Supabase project: `mmoizwtjnpfmowoqpmfa`
- Google Cloud project: `our-axon-504401-e7`
- Drive folder: <https://drive.google.com/drive/folders/1pD8L0WbTM-i_HdhGT13vM3kbNDVWVcpB>
- Canonical Drive file: <https://drive.google.com/file/d/1_nJtZGkdWrD5kKfSLGlhsDos-dDZNAcy/view>

Required server-only Vercel variables are documented in `.env.example`:
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_DRIVE_FILE_ID`,
`GOOGLE_DRIVE_DEPLOY_USER_IDS` and `WORSHIP_KEYS_DRIVE_READ_TOKEN`. Never add a
`NEXT_PUBLIC_` prefix to any of them.

## 10. If you are picking this up

1. Read `Design-Art.md`, then this file, then `Worship-Keys.md` for detail.
2. `npm install && npm run verify` should be green before you change anything.
3. Keep audio, MIDI and music theory out of React components. The tests depend
   on those modules staying pure, and so does anyone debugging at 9am on a Sunday.
4. When you add a control, add the accessible version too. The two XY surfaces
   expose labelled keyboard operation and every colour state also has a word.
5. Do not move Google credentials into the local host. Keep Drive writes on
   Vercel and keep the Mac's authority limited to the paired read token.
6. Before a service, deploy the intended cloud setlist, click `Open setlist from
   Drive` on the church Mac while internet is available, verify the song count,
   and confirm `Saved on this device`.
7. On Sunday, open `Worship Keys Church.app`, run `Check all offline pads`, wait
   for `READY · INTERNET NOT REQUIRED`, then share only the local QR.
