# Worship Keys

## Installation auf einem neuen Computer

Die vollständige, anfängerfreundliche Anleitung für macOS und Windows steht in
[SETUP.md](./SETUP.md). Die Installer richten Node.js LTS,
den privaten GitHub-Download sowie lokale Start-/Stop-Werkzeuge automatisch ein.

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
- **Setlists** are prepared directly in `/play` and automatically saved in the
  current browser through IndexedDB. A manual `Save setlist` action is included.
- **Phone-to-Mac Drive handoff** lives inside `/play`: an authorized account
  deploys the one current JSON file from a phone and opens it on the church Mac.
- **Voice commands** as progressive enhancement (`Prepare G`, `Crescendo`, …).
- **Cloud Live session**: the Vercel host creates a QR link and musician devices
  receive Nashville, setlist, keyboard and leader controls through Supabase
  Realtime. Pad audio remains in the host browser; no local server is required.
- **Offline Church Mode**: the installed macOS launcher starts the complete
  audio host without Terminal, detects the church-router address, verifies the
  saved setlist and all 12 pad keys, and creates a private local Join QR. Live
  audio, MIDI, Nashville and leader control continue without internet.

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

For the standalone app, open the Vercel `/play` page, choose **Show join code**
and scan the QR code. Keep that host tab open during the service.

For Sunday offline use, install the one-click macOS launcher once:

```bash
npm run church:install
```

Then open **Worship Keys Church** from the system Applications folder. Use
**Stop Worship Keys** from the same folder to stop the local host and free port
3000.
The host automatically chooses the best private Ethernet/Wi-Fi address and
shows **READY · INTERNET NOT REQUIRED** after the local setlist and all pad keys
have been checked. Full instructions are in `OFFLINE-CHURCH.md`.

The command-line host remains available and prints its LAN address and PIN:

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
| `npm run church:install` | Build and install the one-click Offline Church macOS app |
| `npm test` | Music theory, MIDI, audio curve, setlist and session tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify` | Typecheck, lint, tests and build in one go |
| `npm run pads:prepare` | Re-render the final Sound Walls pack from the owner-supplied sources |
| `npm run icons:generate` | Re-derive the icon variants from the source artwork |

## Audio assets

**Sound Wall Pads** is the only bundled pack. It contains all twelve keys and is
prepared from the project owner's 48 kHz stereo recordings with
`scripts/prepare-sound-walls.mjs`. The 30-minute source recordings remain on the
external SSD and are deliberately excluded from Git. No catalogue preview audio
is included.

## Documentation

- `HANDOFF.md` — architecture, decisions, known limits and next steps
- `ARC42.md` — vollständige arc42-Architekturdokumentation des Gesamtsystems
- `OFFLINE-CHURCH.md` — deutsche Einrichtung und Sonntags-Checkliste ohne Internet
- `SETUP.md` — anfängerfreundliche Installation auf macOS und Windows ohne Git-Befehle
- `Worship-Keys.md` — the product specification this was built from
- `Design-Art.md` — the shared Worship suite art direction
