# Worship Keys

**Play the room, see the harmony, prepare the next moment.**

A calm live instrument for worship keyboard players. Worship Keys runs latching
ambient pads in all twelve concert keys, reads the chords you play on a MIDI
keyboard, shows the Nashville number relative to the real concert key, and lets
you arm the next key so the change happens musically instead of abruptly.

It is part of the Worship suite and shares its art direction with Worship Loops.

## What it does

- **Ambient pads** in all twelve keys, major and minor, with equal-power
  crossfades, musical fade in / fade out, and an emergency `Stop now`.
- **Pad sound**: Main Volume, Shimmer, Tone and Pad Motion, plus a Tone/Shimmer
  XY surface that stays in sync with the accessible sliders.
- **Live chord detection** from Web MIDI, including inversions, sustain pedal,
  and a stabiliser that stops the readout flickering.
- **Nashville numbers** relative to the concert key, with honest handling of
  borrowed and chromatic chords and explicit input transpose.
- **Prepared transitions**: arm the next key, then play its tonic to trigger the
  crossfade — or use `Switch now`. Sustained notes from the old key cannot fire it.
- **Setlists** with key, mode, time signature and pad preset, saved locally.
- **Voice commands** as progressive enhancement (`Prepare G`, `Crescendo`, …).
- **Local live session**: musician iPads join over the LAN by QR code and see a
  large read-only monitor; a confirmed pianist iPad gets leader controls.

## Requirements

- Node 22.13 or newer
- A Chromium-based desktop browser for Web MIDI (Chrome is the primary target)
- Optional: a MIDI keyboard, and an audio interface or 3.5 mm cable to the desk

## Running it

```bash
npm install
npm run build
npm start
```

The host prints its LAN address and the leader PIN:

```
  Worship Keys — host ready
  Local     http://localhost:3000
  Network   http://192.168.10.20:3000  (en0)
  Leader PIN 481920
```

Open the local address on the host machine. Musician iPads open the network
address, or scan the QR code from **Show join code** on the host screen.

For development use `npm run dev`. Host-only controls (the join code, the leader
PIN, remote-control lock) are served to loopback callers only, so they never
appear on a device that merely shares the network.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with the live session attached |
| `npm run build` | Production build |
| `npm start` | Production host server, bound to `0.0.0.0` |
| `npm test` | Music theory, MIDI, audio curve, setlist and session tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify` | Typecheck, lint, tests and build in one go |
| `npm run pads:generate` | Re-render the built-in pad packs |
| `npm run icons:generate` | Re-derive the icon variants from the source artwork |

## Audio assets

Every pad shipped with this project is synthesised by
`scripts/generate-pads.mjs` and is original work owned by the project. No audio
is taken from any commercial pad product. You can import your own or properly
licensed files through **Import your own pads**; those stay in your browser and
are never uploaded.

## Documentation

- `HANDOFF.md` — architecture, decisions, known limits and next steps
- `Worship-Keys.md` — the product specification this was built from
- `Design-Art.md` — the shared Worship suite art direction
