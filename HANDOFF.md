# Worship Keys — Handoff

State of the product, why it is built the way it is, what is genuinely finished,
and what the next person should know before touching it.

Built against `Worship-Keys.md` (product spec) and `Design-Art.md` (art
direction). Both stay in the repository as the reference.

## 1. Where the product stands

Phases 1–8 of the spec are implemented and exercised against a running build.
Phase 9 hardening is done for typecheck, lint, unit tests, production build,
desktop and tablet review; Playwright end-to-end coverage is not in place yet.

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
lib/hooks/           The React seams over each of the above
scripts/             Pad synthesis and icon derivation
tests/               Vitest suites
```

Audio, MIDI and music theory are pure modules with no React in them. That is
what makes the 125 unit tests possible and it is worth preserving.

## 3. Decisions worth knowing

**Pad audio is synthesised, not sampled.** `scripts/generate-pads.mjs` renders 3
presets × 12 keys. Seamless looping is a property of the maths rather than a
crossfade at the seam: every partial and modulator frequency is snapped to an
integer multiple of `1 / loopSeconds`, so after exactly one loop each oscillator
has completed a whole number of cycles and both value and slope match at the
join. Measured seam step equals the typical inter-sample step, so there is no
click. This also means the shipped audio is unambiguously the project's own work.

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

Two real bugs were found this way and fixed:

1. A reversed fade-out left its completion timer running, which later told the
   transition machine the pad had stopped while it was still playing. The timer
   now asks the engine for the truth before acting.
2. The host's `run-command` handler was re-registered on every render, so its
   cleanup removed the handler in the same commit that delivered an inbound
   command — every leader command timed out. It is now registered once behind a
   ref.

## 5. Testing

`npm test` runs 125 Vitest cases:

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
- **Imported pads live in memory for the session.** IndexedDB persistence for
  imported audio is designed for (`PadAssetLoader.registerLocalAudio` is the
  seam) but not wired up yet.
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

- Playwright end-to-end coverage for the central UI flows.
- Drag-and-drop setlist reordering (buttons and keyboard move songs today).
- Setlist JSON export/import UI (`toExportJson` exists and is tested).
- IndexedDB persistence for imported pad audio.
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

- Remote: see `git remote -v` — the private GitHub repository `worship-keys`.
- Main branch: `main`.
- The final commit SHA is recorded in the release notes of the publishing commit
  and can be read with `git rev-parse HEAD`.

Nothing secret is committed. `.env*` is ignored, no tokens are in the tree, and
all audio in `public/pads/` is generated by the committed script.

## 10. If you are picking this up

1. Read `Design-Art.md`, then this file, then `Worship-Keys.md` for detail.
2. `npm install && npm run verify` should be green before you change anything.
3. Keep audio, MIDI and music theory out of React components. The tests depend
   on those modules staying pure, and so does anyone debugging at 9am on a Sunday.
4. When you add a control, add the accessible version too. Every XY surface in
   this app also has sliders, and every colour state also has a word.
