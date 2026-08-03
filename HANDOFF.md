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
| 11 | Cloud planner, Supabase persistence, Drive deploy/import, Vercel | Done — see §4 and §6 |

## 2. Architecture

### Process model

`server.mjs` owns the socket. Next.js cannot take the HTTP upgrade itself, and
the live session needs one, so a single Node process:

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

**Cloud planning and live audio are deliberately separate.** The Vercel app is
the authenticated setlist planner. Supabase owns each user's working setlist.
The church Mac runs `server.mjs` locally, owns Web Audio/MIDI and exposes only
the current LAN join session. Vercel never hosts the pad engine or the church
WebSocket session.

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
- Desktop 1440×900, tablet landscape 1024×768 and tablet portrait 768×1024 were
  reviewed; the portrait rail collapses to a compact band so the performance
  stage stays above the fold.
- The production cloud planner deploys the current schema-valid JSON to the
  fixed Drive file through the service account.
- The local main UI imports that fixed Drive file with one click through the
  paired-host route: real production verification returned HTTP 200, the exact
  file name, and the Drive setlist name. A direct unauthenticated production
  request returns HTTP 401.
- The stable Vercel production URL is
  <https://worship-keys-psi.vercel.app>.

Two real bugs were found this way and fixed:

1. A reversed fade-out left its completion timer running, which later told the
   transition machine the pad had stopped while it was still playing. The timer
   now asks the engine for the truth before acting.
2. The host's `run-command` handler was re-registered on every render, so its
   cleanup removed the handler in the same commit that delivered an inbound
   command — every leader command timed out. It is now registered once behind a
   ref.

## 5. Testing

`npm test` runs the Vitest unit and asset suites. `npm run test:e2e` exercises
song-owned preset activation/persistence and setlist export/import in Chrome.

The current verification baseline is **144 passing Vitest tests across 9 test
files**, plus typecheck, ESLint and a successful Next production build. Dynamic
routes include `/api/deploy-setlist` and `/api/open-setlist-from-drive`.

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
  join and rejoin, leader handover, revisions, idempotency, snapshot hygiene.

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
  local setlist, pads, MIDI and LAN join session continue to run on the church
  Mac; the live session is not routed through Vercel.
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
- **`npm audit` reports two transitive advisories** (`postcss`, `sharp`) that
  come from Next and whose only offered "fix" is downgrading Next to v9. Left
  as-is deliberately; revisit when Next ships updated transitive deps.

## 7. Not done yet

- Drag-and-drop setlist reordering (buttons and keyboard move songs today).
- Broader Playwright coverage for the complete host → leader → viewer flow and
  real Web Audio/MIDI devices.
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
8. LAN only. No relay.

## 9. Repository

- Repository: <https://github.com/ahaz6/worship-keys> (private)
- Branch: `main`
- Feature baseline before this handoff update: `aa993c6`
  (`Pair church host for Drive reads`).
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
   Drive` on the church Mac, verify the song count, and only then start audio.
