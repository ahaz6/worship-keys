# Worship Keys — Master Build Specification

> Diese Datei ist gleichzeitig Produktkonzept, technisches Handout und ausführlicher Start-Prompt für den Bau der Web-App **Worship Keys**.
>
> Version: 1.0 · Stand: 2. August 2026

## 0. Auftrag an die nächste Codex-Session

Baue eine produktionsnahe Web-App namens **Worship Keys**. Sie gehört zur gleichen visuellen Produktfamilie wie Worship Loops, ist funktional aber ein eigenständiges Live-Worship-Instrument.

Arbeite selbstständig und ausführlich:

1. Lies dieses Dokument vollständig.
2. Lies `Design-Art.md` vollständig.
3. Untersuche das bestehende Worship-Loops-Projekt **nur lesend** als Design- und Qualitätsreferenz:

   `/Users/ahazsubramaniyam/Documents/Codes/Worship Loops`

4. Prüfe dort insbesondere:

   - `HANDOFF.md`
   - `app/globals.css`
   - `app/worship-loops-app.tsx`
   - `app/layout.tsx`
   - `public/worship-loops-icon.png`
   - `app/icon.png`

5. Übernimm Farben, Ruhe, Markenposition und Qualitätsniveau — nicht die Waveform-, Stem- oder Loop-Funktionalität.
6. Verwende das Worship-Keys-Logo aus dieser verbindlichen Quelldatei:

   `/Users/ahazsubramaniyam/Documents/Codes/Worship Keys/Worship Keys Icon.png`

   Die Datei existiert bereits. Kopiere sie beim Projekt-Setup verlustfrei in einen passenden Projektpfad wie `public/worship-keys-icon.png`; verändere oder überschreibe die Quelldatei nicht. Verwende das Logo oben links neben der Wortmarke. Erzeuge zusätzlich eine separat zugeschnittene, quadratische Favicon-/App-Icon-Variante, damit es im kleinen Browser-Tab sauber und nicht gequetscht erscheint.
7. Halte die gesamte sichtbare App auf **Englisch**.
8. Implementiere in nachvollziehbaren Etappen, teste jede Etappe und dokumentiere relevante Entscheidungen.
9. Initialisiere Git frühzeitig und committe abgeschlossene, getestete Meilensteine mit klaren Commit-Nachrichten. Keine Secrets committen.
10. Lege für das Projekt ein **neues privates GitHub-Repository** mit dem Namen `worship-keys` an und pushe den vollständigen, getesteten Stand dorthin. Verwende den `main`-Branch als stabilen Hauptbranch. Falls unter diesem Namen bereits ein Repository oder Remote existiert, überschreibe es nicht ungeprüft, sondern kontrolliere zuerst Eigentümer, URL und vorhandenen Inhalt.

## 1. Produktvision

Worship Keys ist ein ruhiges Live-Werkzeug für Keyboarder und Worship-Leader. Die App verbindet vier bisher getrennte Aufgaben:

- sofort spielbare Ambient-/Drone-Pads in allen Tonarten,
- Live-Akkorderkennung über ein angeschlossenes MIDI-Keyboard,
- Nashville Number System passend zur tatsächlichen Konzerttonart,
- sichere Song-, Tonart- und Atmosphärenwechsel während eines Sets.

Später ergänzt eine Mikrofonfunktion die Bedienung durch sichtbare Sprachkommandos wie `Prepare G`, `Key switch`, `Crescendo` oder `Next song`.

Der wichtigste Produktsatz lautet:

> **Play the room, see the harmony, prepare the next moment.**

## 2. Zielnutzer und Hauptsituationen

### Zielnutzer

- Keyboarder in Worship-Teams
- Worship-Leader, die zwischen Songs oder spontanen Momenten Pads benötigen
- Musiker, die mit Nashville Numbers proben oder lernen
- Gemeinden ohne komplexes Playback-/Ableton-System

### Hauptsituationen

- ruhiger Pad-Untergrund während Gebet, Ansage oder Altar Call
- Wechsel vom Ende eines Songs in eine neue Tonart
- spontanes Spielen bei gleichzeitig sichtbarer Nashville-Zahl
- Vorbereitung einer Setlist vor dem Gottesdienst
- schneller Wechsel zwischen Songs ohne neue Audio-Datei laden zu müssen
- freihändige Ankündigung eines Key-Wechsels oder Crescendos

## 3. Nicht-Ziele des ersten Releases

Der erste Release ist keine vollständige DAW und kein Logic-Pro-Ersatz. Nicht Teil des MVP:

- Audioaufnahme oder Mehrspuraufnahme
- automatische Akkorderkennung aus dem Mikrofon-Audiosignal
- Notensatz oder vollständige Leadsheets
- VST/AU-Plugin-Hosting im Browser
- Cloud-Marketplace für fremde Pad-Pakete
- automatische Songerkennung aus Spotify/YouTube
- Nachbau oder Kopie der Presence-Oberfläche

MIDI ist im MVP die autoritative Quelle für gespielte Noten und Akkorde.

## 4. Produktreferenz: Presence Ambient Drone Pads

Die Inspirationsquelle ist [Presence Ambient Drone Pads von MK Bailey Music](https://mkbaileymusic.com/#!/Presence-Ambient-Drone-Pads/p/779067686).

Die öffentlich beschriebene Kernidee von Presence ist wertvoll:

- Pads sind sofort per Tastendruck verfügbar,
- sie „latchen“, bleiben also aktiv, ohne eine Taste halten zu müssen,
- verschiedene Presets und Klangfarben sind wählbar,
- die Sounds sollen sich entwickeln, aber den Musiker nicht überdecken,
- die Bedienung ist für Kirche, Prayer, Übergänge und spontane Worship-Momente gedacht.

Die Produktseite beschreibt diese Ausrichtung ausdrücklich: [MK Bailey Music — Presence](https://mkbaileymusic.com/). Der Hintergrundartikel erklärt außerdem, dass gute Drone-Pads Wärme und Tiefe liefern, sich aber unter das eigentliche Spiel legen sollen; für Live-Routing empfiehlt der Hersteller eine getrennte Audioausgabe für Pads: [The Power of Ambient Drone Pads in Worship Music](https://mkbaileymusic.com/blog/Blog%20Post%20Title%20One-3zaa9-zlxng-s9stg-a3ak5).

Zusätzlich recherchierte Medien:

- [Presence Ambient Drone Pads — offizieller Audio-Preview auf SoundCloud](https://soundcloud.com/mkbaileymusic)
- [Ankündigung und Funktionsbeschreibung von Kell Bailey](https://www.patreon.com/KellBailey/posts/presence-ambient-139193014)

### Was Worship Keys davon übernimmt

- wenige, große und sichere Live-Aktionen,
- latchende Ambient-Pads,
- Presetwahl,
- direkter Tonartzugriff,
- musikalische Übergänge statt harter Audio-Sprünge.

### Was Worship Keys eigenständig entwickelt

- MIDI-Akkorderkennung,
- Nashville Numbers,
- klare Behandlung von Transposition,
- Major-/Minor-Modus,
- vorbereitete Key-Transitionen,
- Setlists,
- sichtbare Voice Commands,
- Worship-Suite-Design aus `Design-Art.md`.

Keine Audio-Samples, Grafiken, Markenbestandteile oder exakten UI-Kompositionen von Presence übernehmen. Eigene oder sauber lizenzierte Pad-Audios verwenden.

## 5. Klärung der Prepare-/Crescendo-Idee

Diese Spezifikation interpretiert die gewünschte Funktion so:

1. Ein Pad läuft in der aktuellen Tonart.
2. Der Nutzer wählt eine nächste Tonart und optional Major/Minor.
3. `Prepare` schaltet die nächste Tonart **noch nicht** hörbar ein, sondern „armed“ sie.
4. Die App wartet auf einen eindeutig erkannten Akkord, der zur vorbereiteten Zieltonart gehört.
5. Sobald dieser Zielakkord mit ausreichender Sicherheit gespielt wird, beginnt automatisch ein musikalischer Crossfade vom aktuellen Pad zum Ziel-Pad.
6. `Crescendo` kann zusätzlich Lautstärke und Klangöffnung des laufenden Pads vor dem Crossfade anheben.

Diese Interpretation verhindert versehentliche Key-Wechsel und entspricht dem Wunsch, dass nach dem Prepare-Button ein Akkord in der neuen Tonart den Wechsel auslöst.

Die UI benötigt immer auch:

- `Switch now` als manuellen Override,
- `Cancel preparation`,
- eine sichtbare Zieltonart,
- eine klar sichtbare Transition-Phase.

## 6. Informationsarchitektur

### 6.1 Desktop-Layout

```text
┌────────────────────┬───────────────────────────────────────┬──────────────────────┐
│ WORSHIP KEYS       │ Current song / key / time signature  │ Pad & Device Control │
│ Logo               │                                       │                      │
│                    │ Current Nashville chord               │ Pad preset           │
│ + Add song         │ Current detected chord                │ Volume / ambience    │
│                    │                                       │ MIDI input           │
│ SETLIST            │ 12-key pad selector                  │ Input transpose      │
│ Song 1             │ MIDI keyboard activity               │ Voice commands       │
│ Song 2             │                                       │                      │
│ Song 3             │ Prepare / Crescendo / Switch         │ Diagnostics          │
└────────────────────┴───────────────────────────────────────┴──────────────────────┘
```

### 6.2 Linke Sidebar

- Worship-Keys-Logo aus `/Users/ahazsubramaniyam/Documents/Codes/Worship Keys/Worship Keys Icon.png` oben links
- zweizeilige Wortmarke `WORSHIP / KEYS`
- primäre Aktion `+ Add song`
- Setlistname und Songs in Reihenfolge
- pro Song kompakt: Titel, Tonart/Modus, Taktart
- aktiver Song deutlich, aber ruhig markiert
- Drag-and-drop-Sortierung erst nach stabiler Basisfunktion

### 6.3 Center Performance Stage

Von oben nach unten:

1. Songtitel, optional Künstler und Setlistposition
2. aktuelle Konzerttonart, Modus und Taktart
3. größte Anzeige: Nashville-Zahl
4. darunter: erkannter Akkordname und Confidence
5. chromatische Auswahl aller zwölf Tonarten
6. MIDI-Tastaturleiste mit aktuell gehaltenen Noten
7. Pad Transport mit `Fade in`, `Fade out` und `Stop now`
8. Transition Dock mit `Prepare`, `Crescendo`, `Switch now`, `Cancel`
9. dezente Statuszeile für MIDI, Audio und Voice

### 6.4 Rechte Sidebar

- Pad status: `Stopped`, `Playing`, `Prepared`, `Transitioning`
- Presetwahl
- Main Volume
- Shimmer Level
- Pad Motion Speed
- Tone / Brightness
- Fade-in duration
- Fade-out duration
- Reverb/Ambience
- Crossfade duration
- Audio Output with current-device status
- MIDI Input device selector
- Voice/Microphone Input selector
- Input transpose
- Voice Command toggle und Sprache
- getrennte Output-/Routing-Optionen nur soweit der Browser sie zuverlässig unterstützt

### 6.5 Live Mode

Ein optionaler `Live mode` blendet Einstellungen aus und vergrößert:

- Songtitel,
- aktuelle Tonart,
- Nashville-Zahl,
- erkannten Akkord,
- vorbereitete Zieltonart,
- Next Song.

## 7. Tonarten und Modi

Die Formulierung „C bis B“ wird vollständig chromatisch umgesetzt. Unterstützt werden alle zwölf Konzerttonarten:

`C`, `Db/C#`, `D`, `Eb`, `E`, `F`, `Gb/F#`, `G`, `Ab`, `A`, `Bb`, `B`

Jede Tonart unterstützt:

- `Major`
- `Minor`

### Enharmonische Schreibweise

Die App speichert Tonhöhen intern als Pitch Class `0–11`, zeigt sie aber musikalisch passend an.

- Flat-orientierte Keys bevorzugen `Bb`, `Eb`, `Ab`, `Db`, `Gb`.
- Sharp-orientierte Keys dürfen `F#`, `C#` verwenden.
- Nutzer kann in Settings `Prefer flats`, `Prefer sharps` oder `Auto` wählen.
- Nashville-Zahlen bleiben von enharmonischer Schreibweise unabhängig.

## 8. Ambient-Pad-Engine

### 8.1 Grundverhalten

- Ein Pad wird mit einer einzigen Aktion gestartet und bleibt gelatcht.
- `Fade in` startet das gewählte Pad langsam und musikalisch aus Stille heraus.
- `Fade out` beendet das laufende Pad langsam, statt es hart abzuschneiden.
- Die Standarddauer beträgt jeweils 4 Sekunden und ist getrennt von 0,5 bis 20 Sekunden einstellbar.
- `Stop now` bleibt als klar gekennzeichneter Sofort-Stopp für Notfälle verfügbar.
- Ein Klick auf die aktive Tonart stoppt nicht versehentlich sofort; dafür gibt es den klaren `Fade out`-Button sowie `Stop now` für Notfälle.
- Tonartwechsel erfolgen nicht hart, sondern als Equal-Power-Crossfade.
- Standard-Crossfade: 4 Sekunden, einstellbar beispielsweise 1–12 Sekunden.
- Alle Pad-Assets werden vor dem Live-Einsatz vorgeladen und dekodiert.
- Die App zeigt deutlich, wenn ein Ziel-Pad noch lädt.

### 8.2 Web-Audio-Architektur

Empfohlener Signalfluss:

```text
AudioBufferSourceNode (current pad) ─ Key Gain ─┐
                                                ├─ Tone Filter ─ Pad Bus ─┬─ Dry ───────────────┐
AudioBufferSourceNode (next pad) ─── Key Gain ─┘                         │                       │
                                                                         └─ Shimmer Send/Return ─┤
                                                                                                 ├─ Master Gain ─ Limiter ─ Destination
Motion LFO/Automation ───────────────> Filter / Pan / Texture modulation ────────────────────────┘
```

Nutze einen einzigen langlebigen `AudioContext`. Zeitkritische Änderungen werden über die Audio-Clock und `AudioParam` geplant, nicht über React-Renderzyklen oder ausschließlich `setTimeout`.

`AudioBufferSourceNode` unterstützt definierte Loop-Grenzen; die Web-Audio-Spezifikation beschreibt loopende Buffer und sample-nahe Wiedergabe: [MDN — AudioBufferSourceNode.loop](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop) und [W3C — Web Audio API](https://www.w3.org/TR/webaudio-1.1/).

### 8.3 Main Volume

`Main Volume` kontrolliert die gesamte Worship-Keys-Pad-Ausgabe nach Dry-/Shimmer-Mix und vor dem finalen Safety Limiter.

- UI-Wert: `0–100%`; intern bevorzugt logarithmisch in dB abbilden.
- Sinnvoller Startwert: ungefähr `70%` beziehungsweise ca. `-6 dB`, nicht automatisch Vollpegel.
- Änderungen mit kurzer Gain-Rampe von ca. 20–50 ms glätten, damit der Regler nicht klickt.
- Fade-in/-out zielen auf den gespeicherten Main-Volume-Wert, verändern diesen gespeicherten Wert aber nicht.
- `Mute` setzt den Ausgang weich stumm; beim Entmuten kehrt er zum vorherigen Wert zurück.
- Optional später per MIDI CC oder Expression Pedal zuweisbar, standardmäßig nicht ungefragt auf einen Controller mappen.

### 8.4 Shimmer Level

`Shimmer Level` bestimmt den Anteil des Pad-Signals, der in einen eigenen Shimmer-Effektweg gesendet wird. Sunday Sounds beschreibt seinen Shimmer-Regler ebenfalls als Menge des Signals, das an den Shimmer-Effekt gesendet wird: [Sunday Sounds — Effects](https://support.sundaysounds.com/article/3140-effects).

- UI-Wert: `0–100%`, Default zurückhaltend bei etwa `20–30%`.
- `0%` bedeutet vollständig dry bezüglich Shimmer, nicht Stille.
- Der Effektweg besteht konzeptionell aus Hochpass/Filter, oktavierter oder harmonisch angehobener Textur, langer Reverb-Fahne und sicher begrenztem Feedback.
- Shimmer Return erhält eigenen Headroom und läuft vor dem Master Limiter.
- Parameteränderungen werden geglättet; kein Knacken beim Bewegen.
- Hohe Werte dürfen den Grundton nicht unkenntlich machen oder die Nashville-/Key-Wahrnehmung verschleiern.
- Feedback und Return Gain erhalten harte sichere Obergrenzen, damit kein unkontrollierter Pegelaufbau entsteht.

Für einen ersten Prototyp darf eine eigens erstellte hohe Atmosphärenlage beigemischt werden. Für hochwertigen Echtzeit-Pitch-Shimmer ist eine isolierte DSP-/`AudioWorklet`-Implementierung vorzusehen; einfach die Wiedergabegeschwindigkeit des Pad-Samples zu ändern ist keine zulässige Shimmer-Implementierung, weil dadurch Tonhöhe und Dauer des Grundpads verändert würden.

### 8.5 Pad Motion Speed

`Pad Motion` regelt, wie schnell sich der Drone-Klang organisch bewegt. Es ist **kein** Songtempo und verändert weder die Pad-Tonart noch die Loop-Wiedergabegeschwindigkeit.

Der Regler kann kontrolliert auf folgende subtile Modulationsziele wirken:

- Filter-Cutoff beziehungsweise Brightness,
- sehr langsames Stereo-Panning,
- Texture-/Layer-Crossfade,
- sanfte Shimmer-Send-Bewegung,
- optional minimale Lautstärkebewegung innerhalb eines sicheren Bereichs.

Empfohlener Wertebereich:

- `0%`: `Still` — praktisch statisch
- `1–35%`: `Slow`
- `36–70%`: `Flowing`
- `71–100%`: `Fast`, weiterhin musikalisch langsam
- technischer LFO-Richtwert: ungefähr `0.02–0.8 Hz`, presetabhängig begrenzt

`AudioBufferSourceNode.playbackRate` bleibt grundsätzlich `1.0`. Nur wenn ein späteres granular/time-stretching System Tonhöhe sicher erhält, darf ein separater Parameter namens `Texture Speed` tatsächlich Audiomaterial zeitlich strecken. Dieser darf nicht mit `Pad Motion` verwechselt werden.

### 8.6 Tone-/Shimmer-Performance-Control

Zusätzlich zu den barrierefreien Einzelreglern kann eine kompakte XY-Fläche angeboten werden, inspiriert vom mentalen Modell des Sunday-Sounds-Tonic-Players:

- X-Achse: `Tone` von dunkel/gefiltert zu hell/offen
- Y-Achse: `Shimmer` von trocken zu stark schimmernd
- großer, gut sichtbarer Handle
- Doppelklick oder `Reset` setzt das Preset auf seinen Default zurück
- Pfeiltasten ermöglichen Feineinstellung
- die separaten Slider bleiben vollständig synchron und zugänglich

Sunday Sounds beschreibt beim Tonic Pad Player, dass eine vertikale Bewegung den Shimmer erhöht oder verringert und dass Filter/Brightness, Fade-Zeit sowie nahtlose Key-/Preset-Crossfades zentrale Funktionen sind: [Sunday Keys — Tonic Pad Player](https://support.sundaysounds.com/article/3298-sunday-keys-for-mainstage-2021-using-the-tonic-pad-player) und [Sunday Sounds — Tonic Ambient Drone Pad Player](https://sundaysounds.com/blogs/news/sunday-keys-using-the-tonic-ambient-drone-pad-player-in-mainstage).

### 8.7 Crossfade

Für musikalisch gleichmäßige Übergänge Equal-Power-Kurven statt zwei linearer Fades verwenden:

```ts
const out = Math.cos(progress * 0.5 * Math.PI);
const incoming = Math.sin(progress * 0.5 * Math.PI);
```

Die Kurven als `Float32Array` mit `setValueCurveAtTime` auf den GainNodes planen. Der alte SourceNode wird erst nach vollständigem Fade gestoppt und getrennt.

### 8.8 Fade in und Fade out

Fade-in/-out sind eigene Transportaktionen und nicht bloß CSS-Animationen:

- `Fade in` erzeugt oder startet den SourceNode bei Gain `0`, plant anschließend eine Equal-Power- oder sanfte S-Kurve bis zur gespeicherten Ziel-Lautstärke und zeigt `Fading in` an.
- `Fade out` übernimmt den **momentanen** Gain als Startwert, plant die Kurve bis `0`, zeigt `Fading out` an und stoppt/disconnectet den SourceNode erst nach Ende der Automation.
- Ein erneuter Befehl während eines Fades muss die laufende Automation mit `cancelAndHoldAtTime()` übernehmen, sofern unterstützt; ansonsten den aktuellen Wert sicher approximieren und von dort weiterfahren.
- Es darf bei Start, Abbruch, Umkehr oder Ende weder klicken noch zu einem kurzen Lautstärkesprung kommen.
- `Fade in` während `Fading out` kehrt den Verlauf vom aktuellen Pegel aus um. Es startet nicht versehentlich eine zweite hörbare Instanz desselben Pads.
- Ein Tonart-Crossfade verwendet weiterhin zwei GainNodes. Fade-in/-out des Masters und Key-Crossfade dürfen nicht dieselbe Automation überschreiben.
- React zeigt nur den Zustand; die zeitkritische Automation wird vollständig mit `AudioContext.currentTime` geplant.

Empfohlene API:

```ts
type PadEnvelopeOptions = {
  durationSeconds: number;
  targetGain: number;
  curve: "equal-power" | "smooth";
};

padEngine.fadeIn(options);
padEngine.fadeOut(options);
padEngine.stopNow();
```

### 8.9 Audio-Assets

Für den MVP pro Preset:

- 12 nahtlose Stereo-Loops, jeweils eine Konzerttonart,
- optional eigene Major- und Minor-Sets,
- einheitliche Sample Rate,
- ähnliche wahrgenommene Lautheit,
- saubere Loop-Punkte ohne Klicks,
- ausreichend Headroom,
- Metadaten für `loopStart`, `loopEnd`, `rootPitch`, `mode`, `gainTrim`.

Alle Sounds müssen selbst erstellt, lizenziert oder ausdrücklich zur Nutzung freigegeben sein. Keine Samples aus Presence extrahieren.

### 8.10 Lokaler Pad-Import

Zum Lernen und Ausprobieren soll die App einen lokalen Import anbieten:

- Nutzer wählt eigene oder rechtmäßig lizenzierte WAV-/FLAC-/MP3-Dateien aus.
- Dateien bleiben standardmäßig lokal im Browser und werden nicht ungefragt hochgeladen.
- Ein Import-Wizard ordnet jede Datei einer Tonart, einem Modus und einem Preset zu.
- Loop Start/End, Gain Trim und optionaler Anzeigename können kontrolliert werden.
- Vor dem Speichern prüft die App Dateiformat, Dekodierbarkeit, Dauer und offensichtliche Pegelprobleme.
- Das Pad-Pack kann als lokale Manifest-Datei referenziert oder — soweit Browser und Dateigröße es erlauben — in IndexedDB gespeichert werden.

Rechtmäßig erworbene kommerzielle Produkte dürfen nur importiert werden, wenn deren Lizenz die Nutzung der betreffenden Audiodateien außerhalb des Originalprodukts erlaubt. Ein Plugin oder eine Website darf nicht rückentwickelt, mitgeschnitten oder technisch umgangen werden, um an seine Sounds zu gelangen. Presence bleibt daher Referenz für Bedienidee und Klangziel, nicht Quelle für zu kopierende Audiodateien.

## 9. Web MIDI

### 9.1 Technische Grundlage

Die Web MIDI API ermöglicht Web-Apps, MIDI-Geräte aufzuzählen sowie MIDI-Nachrichten zu empfangen. Sie liefert bewusst rohe MIDI-Daten, aber keine fertige musikalische Bedeutung; Akkord- und Nashville-Logik muss Worship Keys selbst implementieren. Das ist in der [W3C Web MIDI API](https://www.w3.org/TR/webmidi/) ausdrücklich so beschrieben.

Wichtige Konsequenzen:

- Web MIDI benötigt einen Secure Context: Produktion über HTTPS; localhost ist für Entwicklung geeignet.
- Browserunterstützung ist nicht überall gleich. Primärziel für das MVP: aktuelles Chromium/Chrome Desktop.
- `navigator.requestMIDIAccess({ sysex: false })` erst nach verständlicher Nutzeraktion aufrufen.
- Kein SysEx anfordern, weil es für dieses Produkt nicht gebraucht wird.
- Gerätezustände über `statechange` behandeln.
- Alle Event Listener beim Devicewechsel und Unmount sauber entfernen.

Die API liefert `MIDIMessageEvent.data` als Bytes; siehe [MDN — MIDIMessageEvent](https://developer.mozilla.org/en-US/docs/Web/API/MIDIMessageEvent).

### 9.2 Nachrichtenverarbeitung

Mindestens unterstützen:

- Note On: `0x90`, Velocity größer 0
- Note Off: `0x80`
- Note On mit Velocity 0 ebenfalls als Note Off
- Sustain Pedal: Control Change `CC64`
- optional All Notes Off: `CC123`

State nicht nur als Set von Pitch Classes speichern. Benötigt werden:

- aktive MIDI-Notennummern,
- Anzahl mehrfach gespielter gleicher Noten,
- Velocity,
- Channel,
- Device ID,
- Pressed vs. durch Sustain gehalten,
- Bassnote als niedrigste klingende MIDI-Note.

### 9.3 Akkord-Erkennungsfenster

Keyboarder schlagen Noten nicht samplegenau gleichzeitig an. Deshalb:

- nach der ersten neuen Note ein kurzes Sammelfenster von ca. 45–80 ms verwenden,
- bei zusätzlichen Noten innerhalb des Fensters neu bewerten,
- Änderungen danach unmittelbar, aber stabilisiert anzeigen,
- eine erkannte Bezeichnung nicht wegen eines 20-ms-Loslassens flackern lassen,
- bei Arpeggios und Sustain zwischen `current chord` und `accumulated notes` unterscheiden.

Die Werte müssen mit echtem MIDI-Keyboard getestet und bei Bedarf konfigurierbar werden.

## 10. Akkorderkennung

### 10.1 Internes Modell

Alle klingenden Noten werden auf Pitch Classes normalisiert:

```ts
pitchClass = ((midiNote + effectiveTranspose) % 12 + 12) % 12;
```

Danach werden mögliche Grundtöne gegen Intervall-Templates geprüft.

MVP-Templates:

- Major: `[0, 4, 7]`
- Minor: `[0, 3, 7]`
- Diminished: `[0, 3, 6]`
- Augmented: `[0, 4, 8]`
- Sus2: `[0, 2, 7]`
- Sus4: `[0, 5, 7]`
- Dominant 7: `[0, 4, 7, 10]`
- Major 7: `[0, 4, 7, 11]`
- Minor 7: `[0, 3, 7, 10]`
- Add9: `[0, 2, 4, 7]`
- Minor add9: `[0, 2, 3, 7]`
- 6 und m6
- Power chord: `[0, 7]`, mit niedrigerer Confidence

### 10.2 Scoring

Jeder Kandidat erhält einen Score aus:

- erforderliche Template-Töne vorhanden,
- fehlende essentielle Töne,
- zusätzliche diatonische Töne,
- zusätzliche chromatische Töne,
- Bassnote entspricht Root oder sinnvoller Inversion,
- vorheriger Akkord als Stabilitätsfaktor,
- aktive Songtonart als schwacher Kontextfaktor.

Die Tonart darf die Erkennung nicht „fälschen“. Ein chromatischer Akkord muss als solcher sichtbar bleiben.

### 10.3 Inversionen und Slash Chords

- Akkordroot und Bassnote getrennt bestimmen.
- Ist der Bass nicht der Root, `D/F#` oder entsprechendes Nashville-Format anzeigen.
- Die große Hauptanzeige bleibt die Nashville-Funktion; der konkrete Akkord steht darunter.
- Bei Mehrdeutigkeit `Ambiguous` oder zwei kleine Kandidaten anzeigen, statt selbstsicher einen falschen Akkord zu melden.

### 10.4 Logic-Pro-Referenz richtig einordnen

Logic Pro zeigt eingehende und ausgehende MIDI-Noten und kann gespeicherte Akkorde relativ zu einer Trigger-Taste transponieren. Die offizielle Beschreibung ist eine gute Referenz für sichtbares MIDI-Feedback und Transpositionslogik: [Apple — Chord Trigger overview](https://support.apple.com/guide/logicpro/chord-trigger-overview-lgceb57e806c/mac).

Wichtig: Worship Keys kopiert nicht den Chord Trigger. Logic beweist auch nicht, dass Web MIDI automatisch Akkordnamen liefert. Worship Keys muss eingehende MIDI-Noten selbst sammeln und musikalisch klassifizieren.

## 11. Transposition ohne falsche Nashville-Zahlen

Transposition ist der kritischste Teil des Produkts. Drei Begriffe müssen getrennt bleiben:

1. **Incoming MIDI pitch** — die Note, die das Keyboard tatsächlich an den Browser sendet.
2. **Input transpose** — Korrektur, falls Hardware oder Spieler absichtlich transponiert.
3. **Concert key** — die reale Tonart des Songs und der Pads.

### 11.1 Unvermeidbare technische Grenze

Wenn ein Keyboard intern transponiert und nur die bereits transponierten MIDI-Noten sendet, sieht die Web-App nicht, welche physischen Tasten gedrückt wurden. Ohne herstellerspezifische Zusatzdaten kann sie das nicht automatisch erraten.

Deshalb benötigt Worship Keys:

- `Input transpose` von `-12` bis `+12`,
- eine kurze `Calibrate input`-Funktion,
- sichtbare Anzeige von `Incoming`, `Adjusted` und `Concert` in einem Diagnose-Popover,
- speicherbare Einstellung pro MIDI-Gerät.

### 11.2 Berechnung

```ts
adjustedMidi = incomingMidi + inputTranspose;
pitchClass = mod(adjustedMidi, 12);
nashvilleDegree = mod(chordRootPitchClass - concertKeyPitchClass, 12);
```

Ein optionaler Performance-Transpose für Pads darf nicht heimlich zusätzlich auf MIDI angewendet werden. Alle Transpose-Werte erhalten eindeutige Namen und genau eine Stelle in der Audio-/MIDI-Pipeline.

### 11.3 Kalibrierung

Ein einfacher Flow:

1. App zeigt: `Play middle C on your keyboard`.
2. Empfangene Note wird angezeigt.
3. Erwartet wird MIDI 60, sofern der Nutzer nicht bewusst anders konfiguriert.
4. Differenz wird als vorgeschlagener `Input transpose` angezeigt.
5. Nutzer bestätigt; Einstellung wird gerätebezogen gespeichert.

Kalibrierung niemals still im Hintergrund ändern.

## 12. Nashville Number System

### 12.1 Grundregel

Die Nashville-Zahl beschreibt die Position des erkannten Akkordroots relativ zur aktiven Konzerttonart.

Major-Diatonik:

| Halbtonabstand | Stufe | Erwartete Qualität |
|---:|:---:|:---|
| 0 | `1` | Major |
| 2 | `2m` | Minor |
| 4 | `3m` | Minor |
| 5 | `4` | Major |
| 7 | `5` | Major |
| 9 | `6m` | Minor |
| 11 | `7°` | Diminished |

Minor-Diatonik, standardmäßig natural minor:

| Halbtonabstand | Stufe | Erwartete Qualität |
|---:|:---:|:---|
| 0 | `1m` | Minor |
| 2 | `2°` | Diminished |
| 3 | `♭3` | Major |
| 5 | `4m` | Minor |
| 7 | `5m` | Minor, im Worship-Kontext oft auch Major `5` |
| 8 | `♭6` | Major |
| 10 | `♭7` | Major |

Die erkannte tatsächliche Akkordqualität überschreibt die erwartete Qualität. Wird in C Major ein D Major gespielt, zeigt die App `2` mit Major-Qualität, nicht fälschlich `2m`.

### 12.2 Chromatische Stufen

Nicht-diatonische Roots werden verständlich dargestellt, beispielsweise:

- `♭2`
- `♭3`
- `♯4` oder `♭5` abhängig von Notation Preference
- `♭6`
- `♭7`

Die Notationsrichtlinie wird zentral implementiert und getestet, nicht über verstreute String-Sonderfälle.

### 12.3 Erweiterungen

- `5/7` oder `5 over 7` für Inversionen, abhängig von UI-Modus
- Suffixe `sus`, `7`, `maj7`, `m7`, `add9`
- optional vereinfachter Live-Modus, der nur Root-Funktion und Minorzeichen zeigt

### 12.4 Pflicht-Testfälle

| Concert key | Mode | Gespielte Noten | Erwarteter Akkord | Nashville |
|---|---|---|---|---|
| C | Major | C E G | C | `1` |
| C | Major | D F A | Dm | `2m` |
| G | Major | D F# A | D | `5` |
| Bb | Major | F A C | F | `5` |
| D | Minor | F A C | F | `♭3` |
| A | Major | E G# B D | E7 | `5⁷` oder `5 7` |
| G | Major | raw C E G, input transpose +2 | D | `5` |
| E | Major | B D# F# / D# bass | B/D# | `5/7` |

## 13. Prepare, Crescendo und automatischer Key-Wechsel

### 13.1 Zustandsmaschine

```text
STOPPED
  └─ Start pad ─> PLAYING

PLAYING
  └─ Prepare target ─> ARMED

ARMED
  ├─ Cancel ─> PLAYING
  ├─ Switch now ─> TRANSITIONING
  └─ qualifying target chord ─> TRANSITIONING

TRANSITIONING
  └─ crossfade complete ─> PLAYING in target key
```

### 13.2 Qualifying Target Chord

Ein automatischer Wechsel darf nur ausgelöst werden, wenn:

- ein Ziel-Key und Ziel-Modus vorbereitet sind,
- der erkannte Akkord eine Mindest-Confidence erreicht,
- die Akkordtöne zur Zieltonart plausibel sind,
- der Zustand mindestens ungefähr 100–180 ms stabil ist,
- das Event nach dem Arming begonnen hat,
- es kein bloßes Sustain-Überbleibsel aus dem alten Key ist.

Standardmäßig lösen aus:

- Zieltonika (`1` oder `1m`) mit höchster Sicherheit,
- optional `4` oder `5`, wenn der Nutzer `Allow any target-key chord` aktiviert.

MVP-sicherste Einstellung: Nur Zieltonika löst automatisch aus.

### 13.3 Crescendo

`Crescendo` ist ein vorbereiteter musikalischer Build:

- Dauer wählbar, Standard 4 oder 8 Sekunden,
- moderate Gain-Anhebung innerhalb sicheren Headrooms,
- optional Filter-/Brightness-Öffnung,
- optional Reverb-Send-Anhebung,
- danach entweder halten oder in Ziel-Pad crossfaden,
- jederzeit abbrechbar.

Kein Limiter-Pumpen und keine unkontrollierte Lautheit. Automatische Gain-Anhebung standardmäßig auf wenige dB begrenzen.

## 14. Setlists und Songs

### 14.1 Songdaten

```ts
type Song = {
  id: string;
  title: string;
  artist?: string;
  concertKey: PitchClass;
  displayKey: string;
  mode: "major" | "minor";
  timeSignature: {
    numerator: number;
    denominator: 2 | 4 | 8 | 16;
  };
  bpm?: number;
  padPresetId: string;
  mainVolume?: number;
  shimmerLevel?: number;
  padMotion?: number;
  tone?: number;
  crossfadeSeconds?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  notes?: string;
};
```

### 14.2 Setlistdaten

```ts
type Setlist = {
  id: string;
  name: string;
  date?: string;
  songs: Song[];
  activeSongId?: string;
};
```

### 14.3 Verhalten

- `+ Add song` öffnet einen neuen Songentwurf und überschreibt keinen vorhandenen Song.
- Song kann benannt, gelöscht und dupliziert werden.
- Direkter Wechsel über die linke Liste.
- `Next song` kann Zieltonart automatisch vorbereiten, darf aber ohne Bestätigung nicht abrupt hörbar umschalten.
- Songwechsel aktualisiert Concert Key, Mode, Time Signature und gewünschtes Pad-Preset atomar.
- Ungespeicherte Änderungen werden sichtbar markiert.
- MVP lokal in IndexedDB speichern; Export/Import als JSON als späterer Meilenstein.

## 15. Taktart

Die Taktart ist primär Songmetadatum und muss sichtbar sein. Mindestens unterstützen:

- `4/4`
- `3/4`
- `6/8`
- `4/8`
- `4/16`

Zähler und Nenner separat speichern. `4/8` und `4/16` dürfen nicht nur das Label ändern; alle zukünftigen rhythmischen Berechnungen verwenden:

```ts
beatDurationSeconds = (60 / bpm) * (4 / denominator);
barDurationSeconds = beatDurationSeconds * numerator;
```

Im ersten Worship-Keys-MVP beeinflusst die Taktart vor allem Anzeige und Setlist. Falls später ein Click ergänzt wird, muss dessen Scheduler genau diese Formel und die Web-Audio-Clock nutzen.

## 16. Voice Commands und Mikrofontranskription

### 16.1 Ziel

Der Nutzer kann das Mikrofon bewusst aktivieren. Erkannte Sprache erscheint live als ruhiger Transcript-Strip. Relevante Phrasen erzeugen klar sichtbare Kommandokarten.

Beispiele:

- `Prepare G`
- `Prepare G minor`
- `Key switch`
- `Switch now`
- `Crescendo`
- `Next song`
- `Previous song`
- `Cancel transition`
- `Stop pads`

Optionales Wake Word: `Worship Keys`, um Fehltrigger im Gottesdienst zu reduzieren.

### 16.2 Sicherheit und UX

- Mikrofon niemals automatisch starten.
- Aktives Mikrofon dauerhaft sichtbar anzeigen.
- Transcript und erkannte Aktion getrennt darstellen.
- Niedrige Confidence löst keine Audioaktion aus.
- Kritische Befehle erhalten eine kurze visuelle Bestätigung oder benötigen das Wake Word.
- `Stop pads` darf sofort wirken; destruktive Datenaktionen gibt es per Voice nicht.
- Bei fehlender Unterstützung bleibt die App vollständig manuell nutzbar.

### 16.3 Technische Realität

`SpeechRecognition` kann Sprache aus Mikrofon oder Audio-Track erkennen, besitzt aber eingeschränkte Browserverfügbarkeit. In manchen Browsern, insbesondere Chrome-Konfigurationen, kann die Erkennung einen serverbasierten Dienst verwenden und funktioniert dann nicht offline. Siehe [MDN — SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

Deshalb:

- MVP als Progressive Enhancement implementieren,
- Feature Detection für `SpeechRecognition` und `webkitSpeechRecognition`,
- primär Chrome Desktop dokumentieren,
- Offline- oder Cross-Browser-ASR als spätere austauschbare Provider-Schicht planen,
- Datenschutztext anzeigen, bevor ein externer Erkennungsdienst Audio erhalten könnte.

## 17. Audio I/O und physischer 3,5-mm-Ausgang

### 17.1 Zielbild

Worship Keys soll in der rechten Sidebar ein kompaktes `AUDIO I/O`-Panel besitzen:

```text
AUDIO I/O
● MIDI Input       Arturia KeyLab 61
● Voice Device     SQ-Rack USB Audio
  Input channels   1–2 · 2 channels exposed
● Audio Device     SQ-Rack USB Audio
  Output channels  USB 1–2 · patched on SQ
  Output level     ▰▰▰▰▰▱▱▱

[ Choose input ] [ Choose output ] [ Test output ]
```

Die drei Begriffe dürfen nicht vermischt werden:

- `MIDI Input` empfängt Noten und Controllerdaten vom Keyboard.
- `Voice Input` empfängt ausschließlich Mikrofon-Audio für Sprachkommandos.
- `Audio Output` gibt Pads, Shimmer und Effekte an Kopfhörerausgang, Audiointerface oder Systemlautsprecher aus.
- `Input channels` und `Output channels` zeigen nur Kanäle an, die im aktuellen Browser-/Bridge-Modus tatsächlich adressierbar sind.

Der Output-Meter zeigt den intern berechneten Ausgangspegel des Web-Audio-Graphen. Er beweist nicht, dass ein analoges Kabel korrekt steckt oder dass am Mischpult tatsächlich Signal ankommt.

### 17.2 Anschluss mit 3,5-mm-Klinke

Der gewünschte Live-Weg ist möglich:

```text
Worship Keys Web-App
  → Audioausgang des Mac/PC/iPad
  → 3,5-mm-TRS-Kabel oder passender Adapter/DI
  → AUX IN / LINE IN am Keyboard oder Mischpult
```

Verbindliche Hinweise in einer kleinen `Connection help`-Ansicht:

- Immer einen **Eingang** am Zielgerät verwenden: `AUX IN`, `LINE IN` oder einen geeigneten DI-/Mixer-Eingang.
- Niemals Kopfhörer-/Line-Ausgang des Computers mit einem Ausgang des Keyboards verbinden.
- Vor dem Einstecken `Main Volume` reduzieren und den Pegel anschließend langsam erhöhen.
- Für ein Keyboard mit Stereo-AUX-Eingang das zum Anschluss passende TRS-Kabel verwenden.
- Für ein Mischpult ist live meist ein 3,5-mm-Stereo-auf-2×6,3-mm-Kabel oder besser eine Stereo-DI-/Audiointerface-Lösung geeignet.
- Bei Brummen, langen Kabelwegen oder professionellem Bühneneinsatz ein USB-Audiointerface beziehungsweise eine DI-Box verwenden.
- Das Ziel-Keyboard muss Audio über `AUX IN`/`LINE IN` annehmen können; MIDI allein überträgt keinen Pad-Sound.

### 17.3 Output-Auswahl im Browser

Ohne explizite Auswahl verwendet ein `AudioContext` den Standard-Audioausgang des Betriebssystems. Wo unterstützt, soll Worship Keys eine bewusste Auswahl anbieten:

1. Nutzer klickt `Choose output`.
2. `navigator.mediaDevices.selectAudioOutput()` öffnet den Browserdialog.
3. Die Auswahl wird über `audioContext.setSinkId(deviceId)` auf die Pad-Engine angewendet.
4. Das Panel zeigt den freigegebenen Gerätenamen und `Connected`.
5. Bei `devicechange` wird geprüft, ob das Gerät noch vorhanden ist.

`selectAudioOutput()` benötigt HTTPS und eine konkrete Nutzerinteraktion; die API ist nicht in allen Browsern verfügbar. Die offizielle Beschreibung findet sich bei [MDN — selectAudioOutput](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput) und in der [W3C Audio Output Devices API](https://www.w3.org/TR/audio-output/). Für den Web-Audio-Graphen kann ein unterstützter Browser den Sink direkt mit [`AudioContext.setSinkId()`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId) setzen.

`setSinkId()` wählt das **Audiogerät**, nicht zuverlässig ein beliebiges Hardware-Kanalpaar innerhalb eines 32-kanaligen Interfaces. Die Kanalzuordnung für das SQ-Rack erfolgt im zuverlässigen Web-Modus deshalb über die USB-Patchbay des SQ.

Feature Detection ist verpflichtend:

```ts
const canChooseOutput =
  typeof navigator.mediaDevices?.selectAudioOutput === "function" &&
  typeof audioContext.setSinkId === "function";
```

Wenn die Auswahl nicht unterstützt wird:

- Anzeige: `Audio Output — System default`
- Hilfetext: `Choose the output in your system audio settings.`
- kein kaputter oder wirkungsloser Geräte-Dropdown
- Pad-Wiedergabe funktioniert weiterhin über das System-Default-Gerät

### 17.4 Was die App erkennen kann und was nicht

Die App kann:

- den aktuell gesetzten Sink beziehungsweise `System default` anzeigen,
- freigegebene Audio-Gerätenamen anzeigen,
- Gerätewechsel und Disconnects beobachten,
- den internen Output-Pegel messen,
- einen leisen Testton beziehungsweise Test-Pad-Impuls ausgeben.

Die App kann nicht zuverlässig:

- erkennen, ob im 3,5-mm-Port physisch ein Kabel steckt,
- erkennen, ob das andere Kabelende in einem Keyboard oder Mischpult steckt,
- den tatsächlichen analogen Pegel am Mischpult zurückmessen,
- garantieren, dass das Betriebssystem hinter `System default` nicht später das Gerät wechselt.

Die UI formuliert daher niemals fälschlich `Cable connected`. Korrekte Zustände sind beispielsweise `Output selected`, `System default`, `Device unavailable` und `Test signal playing`.

### 17.5 Input-Sicherheit

- Mikrofon-/Line-Input wird nur nach expliziter Berechtigung geöffnet.
- Voice Input wird standardmäßig **nicht** direkt auf den Audio Output geroutet, weil sonst Feedback entstehen kann.
- Input-Monitoring ist nicht Teil des MVP.
- Der MIDI-Input bleibt vollständig vom Audio-Input getrennt.
- Geräte-IDs nur als lokale Preference speichern und bei jeder Session auf Gültigkeit prüfen.

### 17.6 SQ-Rack als Voice Input und Pad Output

Das Allen & Heath SQ-Rack ist für dieses Setup grundsätzlich sehr geeignet. Laut Hersteller besitzt es ein class-compliant, bidirektionales `32×32`-USB-B-Audiointerface bei 48 oder 96 kHz und erscheint am Mac als Core-Audio-Gerät: [Allen & Heath — SQ-Rack](https://www.allen-heath.com/hardware/sq/sq-rack/) und [SQ-Rack Getting Started Guide](https://support.allen-heath.com/hc/en-gb/articles/41222924565777-SQ-Rack-Getting-Started-Guide).

Wichtig für die Begriffe:

- `SQ USB outputs` sind Signale **vom SQ zum Mac** und damit Inputs für Worship Keys.
- `SQ USB inputs` sind Signale **vom Mac zurück zum SQ** und damit Outputs von Worship Keys.
- Beide Richtungen können gleichzeitig verwendet werden.

#### Setup A — MD-Mikrofon über SQ, Pads analog zum MODX

```text
MD microphone
  → SQ input channel
  → SQ Direct Out / Tie Line
  → SQ USB output 1 (optional 1–2 as stereo pair)
  → Mac Voice Device: SQ-Rack USB Audio
  → Worship Keys transcription

Worship Keys pads
  → Mac 3.5 mm output
  → MODX AUX IN
```

Dieser Weg hält Voice Input und Pad Output auf zwei physischen Geräten getrennt und ist für den ersten Web-Prototyp besonders übersichtlich.

#### Setup B — MD-Mikrofon und Pads beide über SQ USB

```text
MD microphone
  → SQ input channel
  → SQ Direct Out / Tie Line
  → SQ USB output 1–2
  → Mac / Worship Keys Voice Input

Worship Keys pads
  → Mac Audio Output: SQ-Rack USB Audio
  → SQ USB input 1–2
  → dedicated SQ stereo input channel
  → desired mix / Main LR
```

Allen & Heath dokumentiert, dass auf macOS für die Standardausgabe normalerweise USB-Kanäle `1–2` genutzt werden und dass die SQ-Patchbay frei zuweisbar ist. Standardmäßig können SQ-Kanäle 47/48 aus USB 1/2 gespeist werden; dies darf für das konkrete Showfile bewusst geändert werden: [SQ Reference Guide — Connecting to a Computer](https://www.allen-heath.com/content/uploads/2025/02/SQ_ReferenceGuide_V1_6_0_iss1.pdf).

Für Setup B gelten zwingend:

- auf dem SQ einen eigenen Stereo-Return `Worship Keys Pads` anlegen,
- USB 1/2 bewusst auf diesen Return patchen,
- den MD-Mikrofon-Direct-Out bewusst vom SQ auf USB Output 1 oder ein definiertes Paar patchen,
- den Pad-Return niemals wieder in denselben USB-Send zurückführen,
- Routing vor dem Gottesdienst mit niedrigem Pegel testen,
- Sample Rate am SQ festlegen, bevor Browser/App Audio öffnen,
- bei Klicks oder Pops zuerst Sample Rate und Clocking prüfen.

### 17.7 Gerätewahl und Kanalwahl: ehrliche Browsergrenze

Die Web-App soll immer eine Gerätewahl anbieten:

- `Choose voice device` über `enumerateDevices()` und `getUserMedia({ audio: { deviceId } })`
- `Choose output device` über `selectAudioOutput()` und `AudioContext.setSinkId()`
- sichtbare Gerätenamen, Permissionstatus und `devicechange`

Die App darf eine Kanalwahl nur dann aktivieren, wenn der Browser die Kanäle wirklich bereitstellt. `MediaTrackSettings.channelCount` zeigt die tatsächlich konfigurierte Kanalzahl; die Unterstützung ist jedoch nicht in allen Browsern gleich: [MDN — MediaTrackSettings.channelCount](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/channelCount).

Empfohlener Input-Request für das SQ:

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    deviceId: { exact: selectedInputDeviceId },
    channelCount: { ideal: requestedChannelCount },
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
});

const track = stream.getAudioTracks()[0];
const actualChannels = track.getSettings().channelCount ?? 1;
```

Wenn mehrere Kanäle tatsächlich im Track ankommen, kann Web Audio sie mit `ChannelSplitterNode` trennen. Die Web-Audio-Spezifikation unterstützt mehrkanalige Graphen und beschreibt `ChannelSplitterNode`/`ChannelMergerNode`; das garantiert aber nicht, dass Chrome oder Safari alle 32 SQ-Kanäle über `getUserMedia()` freigeben: [W3C — Web Audio API 1.1](https://www.w3.org/TR/webaudio-1.1/).

Darum gelten folgende UI-Regeln:

- Zeige `Channels exposed by browser: 1`, `2`, `8` usw.
- Biete nur tatsächlich vorhandene Kanäle oder Paare zur Auswahl an.
- Wenn nur Stereo ankommt, zeige `Input pair 1–2` und keine erfundene Liste 1–32.
- Ein deaktivierter Hinweis erklärt: `For arbitrary SQ USB channels, patch the desired source to USB 1–2 on the SQ.`
- Output-Auswahl zeigt im reinen Web-Modus `USB 1–2 (route on SQ)`, nicht fälschlich alle 32 Ausgänge.

### 17.8 Advanced 32×32 Bridge als späterer Modus

Wenn freie Auswahl jedes SQ-USB-Kanals direkt innerhalb von Worship Keys wirklich erforderlich wird, benötigt das Produkt zusätzlich zum Browser eine lokale Audio-Bridge beziehungsweise einen nativen Wrapper mit CoreAudio-Zugriff.

Dieser optionale `Advanced I/O Bridge`-Modus soll:

- alle 32 SQ Inputs und Outputs mit stabilen Namen auflisten,
- einen einzelnen MD-Mikrofonkanal als Voice Input wählen,
- ein Stereo-Paar als Pad Output wählen,
- 48/96-kHz-Konfiguration prüfen,
- Pegel messen, ohne den Voice Input zu monitoren,
- Routing lokal über `localhost`/IPC an die Web-Oberfläche melden,
- bei nicht laufender Bridge automatisch auf den sicheren Browser-Stereo-Modus zurückfallen.

Der MVP bleibt eine Web-App. Die Bridge ist eine spätere Erweiterung und darf den normalen Geräte-/USB-1–2-Workflow nicht blockieren.

### 17.9 Spracherkennung mit ausgewähltem SQ-Input

Die Voice-Schicht muss den ausgewählten `MediaStreamTrack` verwenden. Die neuere Variante [`SpeechRecognition.start(audioTrack)`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start) kann einen konkreten Audio-Track annehmen, ist aber ebenfalls nur eingeschränkt verfügbar. Daher:

- wenn `start(audioTrack)` unterstützt wird, den aus dem SQ gewählten/gesplitteten Track verwenden,
- andernfalls den SQ-Voice-Pair als macOS-Standardinput verwenden **oder** auf einen austauschbaren lokalen/serverseitigen ASR-Adapter zurückfallen,
- in der UI klar anzeigen, welcher Input die Transkription tatsächlich speist,
- niemals so tun, als nutze Speech Recognition den gewählten SQ-Kanal, wenn der Browser tatsächlich das Systemmikrofon verwendet.

## 18. Local Live Session für Pianist und Musiker

### 18.1 Zielbild

Ein festes MacBook läuft während des gesamten Gottesdienstes als Worship-Keys-Host und ist direkt mit dem SQ-Rack verbunden. Alle Musiker-iPads befinden sich im selben lokalen Netzwerk und öffnen dieselbe Adresse des Host-MacBooks.

```text
SQ-Rack ⇄ USB Audio ⇄ Host MacBook
                         │
                         ├─ Worship Keys Audio/MIDI/Voice Engine
                         ├─ Local Session Server
                         │
              ┌──────────┴──────────┐
              │                     │
        Pianist iPad           Musician iPads
        LEADER controls        VIEW ONLY
        Key/song/prepare       Nashville/chord/key
        crescendo/switch       transcript/song/status
```

Wichtig: Die iPads öffnen **alle dieselbe Host-URL**, beispielsweise:

`http://192.168.10.20:3000/join`

Jedes iPad besitzt zwar eine eigene IP-Adresse, aber der Server läuft ausschließlich auf der festen IP des MacBooks. Ein QR-Code im Host-Screen enthält die Join-URL.

### 18.2 Autoritative Rollen

#### Host / Audio Engine

Der Host läuft lokal auf dem MacBook und besitzt die höchste Autorität:

- betreibt Pad-, MIDI-, Voice- und Audio-I/O-Engine,
- ist direkt mit SQ-Rack und gegebenenfalls MODX verbunden,
- hält die kanonische Sessionverbindung,
- kann Remote Control jederzeit sperren,
- kann Leader-Geräte genehmigen oder entfernen,
- spielt Audio auch weiter, wenn das WLAN oder alle iPads ausfallen.

#### Leader / Pianist

Der Pianist darf nach sicherem Pairing:

- Song wählen,
- aktuellen Key und Major/Minor ändern,
- nächsten Key vorbereiten,
- `Prepare`, `Crescendo`, `Switch now` und `Cancel` verwenden,
- Setlist vor/zurück navigieren,
- Pad Fade in/out und freigegebene Performance-Controls bedienen,
- Voice-/MIDI-/Outputstatus sehen.

Geräte-, SQ-Kanal-, Sample-Rate-, Audio-Asset- und Git-Einstellungen bleiben standardmäßig Host-only. Dadurch kann der Pianist musikalisch steuern, ohne versehentlich die Hardwareverbindung zu zerstören.

#### Viewer / Musician

Viewer sehen live:

- Songtitel und Setlistposition,
- aktuelle Tonart und Modus,
- Taktart und optional BPM,
- erkannten Akkord,
- große Nashville-Zahl,
- vorbereitete Zieltonart,
- Transition-/Crescendo-Status,
- laufendes Voice-Transcript und erkannte Kommandos,
- Verbindung und Alter des letzten Updates.

Viewer dürfen nichts verändern. Das wird serverseitig erzwungen; ausgeblendete Buttons allein sind keine Zugriffskontrolle.

### 18.3 Pairing und Join Flow

Beim Start einer Session zeigt der Host:

- Sessionname, beispielsweise `Sunday Morning`;
- feste Join-URL;
- QR-Code für Viewer;
- kurzlebigen Viewer-Token in der QR-URL;
- separaten sechsstelligen `Leader PIN`;
- Liste verbundener Geräte mit Rolle und letztem Kontakt;
- `Lock new joins` und `Revoke device`.

Join Flow:

1. Musiker scannt den QR-Code.
2. Gerät erhält zunächst ausschließlich `Viewer`.
3. Pianist wählt `Request leader access` und gibt den Leader PIN ein.
4. Host bestätigt optional das Gerät.
5. Server vergibt genau diesem Gerät eine Leader-Session.
6. Rollenänderung wird auf allen Geräten sichtbar bestätigt.

Der Host kann festlegen, ob genau ein Leader oder mehrere Leader erlaubt sind. Sicherer Default ist **ein aktiver Leader**. Bei einem zweiten Login muss der Host die Übergabe bestätigen.

### 18.4 Netzwerk und feste Adresse

Für den Livebetrieb:

- Host-MacBook möglichst per Ethernet am gleichen dedizierten Netzwerk wie der iPad-Access-Point betreiben.
- Im Router eine DHCP-Reservierung für das MacBook einrichten, damit die Host-IP gleich bleibt.
- Optional einen Bonjour-/mDNS-Namen wie `worship-keys.local` anzeigen.
- Server an `0.0.0.0` statt nur `localhost` binden.
- macOS-Firewallzugriff für den lokalen Server bewusst erlauben.
- Kein öffentliches Gast-WLAN mit Client Isolation verwenden; dort können iPads den Host häufig nicht erreichen.
- Vor dem Gottesdienst QR-Code, Reichweite, Reconnect und Leader-Bedienung mit allen Geräten testen.

Für den ersten lokalen Prototyp kann der Host seine Audio-/MIDI-Funktionen über `localhost` nutzen, während Viewer die LAN-IP öffnen. Für eine installierbare PWA und dauerhaft saubere Browser-Sicherheit ist lokales HTTPS mit einem vertrauenswürdigen Zertifikat oder ein kontrollierter HTTPS-Tunnel/VPN-Modus vorzusehen. Der Gottesdienst darf nicht zwingend von öffentlichem Internet abhängig sein.

### 18.5 Echtzeitarchitektur

Empfehlung: Ein lokaler Node-/Next-Server mit WebSocket-Schicht.

```text
Leader command
  → authenticated WebSocket message
  → server validates role + expected revision
  → canonical session state changes
  → host audio client receives command
  → host executes audio action and acknowledges
  → server broadcasts new snapshot to all clients
```

Audio wird niemals zu den iPads gestreamt. Über das Netzwerk gehen nur kleine Zustandsnachrichten. Dadurch bleiben Audioqualität und Audio-Timing unabhängig vom WLAN.

Jede Nachricht benötigt:

- `sessionId`,
- monotone `revision`,
- `messageId` für Idempotenz,
- `sentAt`/Serverzeit,
- klaren Eventtyp,
- minimales Payload-Schema.

Veraltete oder doppelte Commands werden verworfen. Der Leader zeigt erst nach Server-/Host-Acknowledge einen bestätigten Key-Wechsel an.

### 18.6 Synchronisierter Live-State

```ts
type LiveSessionSnapshot = {
  sessionId: string;
  revision: number;
  serverTime: number;
  hostOnline: boolean;
  remoteControlLocked: boolean;
  activeSong: {
    id: string;
    title: string;
    artist?: string;
    position: number;
    total: number;
  } | null;
  concertKey: string;
  mode: "major" | "minor";
  timeSignature: string;
  bpm?: number;
  detectedChord?: string;
  nashville?: string;
  chordConfidence?: number;
  preparedKey?: string;
  transitionState: "idle" | "armed" | "crescendo" | "transitioning";
  padState: "stopped" | "fading-in" | "playing" | "fading-out";
  transcript: TranscriptSegment[];
};
```

Beim Beitritt erhält jedes Gerät sofort einen vollständigen Snapshot. Danach sendet der Server nur Änderungen und regelmäßig einen kompakten Heartbeat.

### 18.7 Nashville- und Transcript-Übertragung

- Akkord-/Nashville-Updates nur bei musikalisch relevanter Änderung senden, nicht für jedes rohe MIDI-Byte.
- Optional höchstens etwa 10–20 Statusupdates pro Sekunde, damit ältere iPads ruhig bleiben.
- Interim-Transcript klar von finalem Transcript unterscheiden.
- Letzte 3–6 Transcript-Zeilen anzeigen; vollständige Speicherung nur nach ausdrücklicher Aktivierung.
- Ein erkanntes Voice Command wird separat hervorgehoben, beispielsweise `COMMAND · PREPARE G`.
- Viewer erhalten niemals den Mikrofon-Audiostream, sondern ausschließlich Text und Status.
- Bei geringer Chord-Confidence die Zahl visuell als unsicher markieren, statt alte und neue Werte hektisch wechseln zu lassen.

### 18.8 Viewer UI auf dem iPad

Die Viewer-Ansicht ist bewusst reduziert und aus Entfernung lesbar:

```text
WORSHIP KEYS                      ● LIVE
Sunday Morning · Song 3 of 6

             5
          D MAJOR
       Key: G Major · 4/4

Prepared: A Major

VOICE TRANSCRIPT
“We are going to the bridge…”
COMMAND · CRESCENDO

Updated now · Host online
```

Keine ausgegrauten Bedienelemente in der Viewer-Ansicht anzeigen. Sie ist eine echte Monitoroberfläche, nicht die Leader-Oberfläche mit deaktivierten Buttons.

### 18.9 Ausfallsicherheit

- Host-Audio läuft bei Netzwerkverlust unverändert weiter.
- Viewer zeigt nach wenigen Sekunden `Reconnecting…`, behält den letzten Stand und markiert dessen Alter.
- Nach Reconnect immer vollständigen Snapshot anfordern.
- Leader-Commands während Disconnect nicht lokal puffern und später überraschend ausführen.
- Bei Host-Neustart werden alte Leader-Tokens ungültig, sofern Session nicht ausdrücklich wiederhergestellt wird.
- Remote-Key-Wechsel benötigt Host-Acknowledge; Timeout zeigt `Command not applied`.
- Host besitzt einen großen `Lock remote control`-Schalter.
- Wake Lock auf iPads als Progressive Enhancement nutzen; falls nicht verfügbar, Nutzer auf Auto-Lock-Einstellung hinweisen.

### 18.10 Sicherheit und Datenschutz im LAN

- Rolle bei jeder mutierenden Serveraktion prüfen.
- Kurzlebige, zufällige und widerrufbare Tokens verwenden.
- Leader PIN gehasht und nur für die Session speichern.
- Keine Hardware- oder Admin-Endpunkte für Viewer ausliefern.
- Transcript standardmäßig nur im Arbeitsspeicher halten und beim Sessionende löschen.
- Kein Roh-Audio über WebSocket senden.
- Join-Liste und Remote-Steuerung nach dem Soundcheck sperrbar machen.
- Ein lokales Netzwerk ist nicht automatisch vertrauenswürdig; Schutz darf nicht nur auf „gleiche IP Range“ beruhen.

## 19. Empfohlener Tech-Stack

- Next.js App Router
- React und TypeScript strict
- CSS Modules oder bestehendes globales Token-System; keine unnötige schwere UI-Library
- Web Audio API für Pads, Crossfades und Gain-Automation
- Web MIDI API für Geräte und Events
- Web Speech API als MVP-Voice-Adapter
- Audio Output Devices API mit sicherem System-Default-Fallback
- lokale WebSocket-Schicht für Host, Leader und Viewer
- QR-Code-Generator für lokale Join-Links
- IndexedDB, gekapselt hinter einem Repository/Storage-Interface
- Zod für persistierte Daten und Imports
- Vitest für Musiktheorie, MIDI-Parser und State Machines
- Playwright für zentrale UI-Flows
- ESLint und TypeScript Check

### 19.1 Empfohlene Modulstruktur

```text
app/
  page.tsx
  layout.tsx
  globals.css
components/
  brand/
  setlist/
  performance/
  pads/
  midi/
  voice/
  session/
    host-panel.tsx
    leader-view.tsx
    viewer-view.tsx
lib/
  audio/
    pad-engine.ts
    crossfade.ts
    asset-loader.ts
  midi/
    midi-access.ts
    midi-parser.ts
    active-notes.ts
  music/
    pitch.ts
    chord-templates.ts
    chord-detector.ts
    nashville.ts
    notation.ts
    transpose.ts
  transitions/
    transition-machine.ts
  voice/
    speech-adapter.ts
    command-parser.ts
  io/
    media-devices.ts
    routing-capabilities.ts
    sq-routing-profile.ts
  session/
    protocol.ts
    authorization.ts
    session-store.ts
    websocket-server.ts
  storage/
    setlist-repository.ts
types/
tests/
public/
  pads/
  worship-keys-icon.png
```

Die exakte Struktur darf angepasst werden. Audio-, MIDI- und Musiktheorie-Logik dürfen jedoch nicht als großer Block in einer React-Komponente landen.

## 20. Zustandsarchitektur

Trenne mindestens:

- persistente Produktdaten: Setlists, Songs, Preferences
- Geräte-State: MIDI Permission, Device, Sustain, aktive Noten
- Analyse-State: Akkordkandidaten, Confidence, Nashville-Zahl
- Audio-State: geladenes Preset, current pad, target pad, gains
- Transition-State: idle/armed/transitioning
- UI-State: Auswahl, Dialoge, Live Mode
- Voice-State: permission/listening/transcript/command
- I/O-State: selected output, system-default fallback, MIDI input, voice input, device availability
- Session-State: host online, role, connected devices, revision, leader lease, remote-control lock

Audio-Objekte wie `AudioContext`, `AudioBufferSourceNode` und `GainNode` gehören nicht in serialisierbaren globalen State.

## 21. Keyboard Shortcuts

Vorschlag:

- `Space`: Pads starten/stoppen, außer Fokus liegt in einem Eingabefeld
- `P`: Prepare öffnen/auslösen
- `C`: Crescendo
- `Enter`: bestätigten manuellen Switch auslösen
- `Escape`: Prepare/Transition abbrechen oder Dialog schließen
- `Arrow Up/Down`: vorheriger/nächster Song, nur mit zusätzlicher Modifikatortaste im Live Mode, um Fehlbedienung zu vermeiden
- `V`: Voice Commands an/aus
- `L`: Live Mode

Shortcuts immer in Settings/Help sichtbar machen und Eingabefelder respektieren.

## 22. Fehlerfälle

Die App benötigt definierte Reaktionen für:

- Browser unterstützt Web MIDI nicht
- Nutzer verweigert MIDI-Zugriff
- MIDI-Gerät wird während des Spielens getrennt
- Sustain bleibt durch Disconnect hängen
- AudioContext ist suspended
- Pad-Asset kann nicht geladen oder dekodiert werden
- Ziel-Pad ist beim Switch noch nicht bereit
- Mikrofonberechtigung verweigert
- SpeechRecognition endet unerwartet
- gewählter Audioausgang wird getrennt oder ist nach Reload nicht mehr freigegeben
- Browser unterstützt keine direkte Audio-Output-Auswahl
- Host und iPad befinden sich nicht im gleichen erreichbaren Netzwerk
- WLAN aktiviert Client Isolation
- Viewer empfängt veraltete oder ungeordnete Revisionen
- Leader verliert Verbindung während eines Commands
- zwei Geräte fordern gleichzeitig Leader-Rechte an
- Host-Audio läuft, aber Session-Server wurde neu gestartet
- Akkord ist mehrdeutig
- Input-Transpose scheint unplausibel
- gespeicherte Setlist hat eine alte Schema-Version

Keine technischen Promise-Fehler als Vollbilddialog zeigen. Fehler abfangen und in verständliche Nutzeraktionen übersetzen.

## 23. Datenschutz und Rechte

- MIDI-Noten bleiben im MVP lokal.
- Setlists bleiben standardmäßig lokal.
- Mikrofon wird nur nach expliziter Zustimmung aktiviert.
- Wenn Browser-Spracherkennung Audio extern verarbeitet, muss dies vor Aktivierung verständlich erklärt werden.
- Keine geheimen Analytics im Live-Modus.
- Alle Pad-Samples benötigen dokumentierte Nutzungsrechte.
- Presence dient nur als Produktreferenz; keine Assets, Samples oder proprietäre Details kopieren.
- Musiker-iPads erhalten nur Text-/Statusdaten und niemals den MD-Mikrofon-Audiostream.
- Live-Transcripts werden ohne ausdrückliche Aktivierung nicht dauerhaft gespeichert.

## 24. Implementierungsphasen

### Phase 1 — Foundation und Design

- neues Repository und Next.js/TypeScript einrichten
- `Design-Art.md` umsetzen
- `/Users/ahazsubramaniyam/Documents/Codes/Worship Keys/Worship Keys Icon.png` als Logo-Quelle verwenden, ins Projekt kopieren und eine separate Favicon-Variante sauber integrieren
- responsive Drei-Bereich-Shell
- statische Performance-Ansicht und Setlist-Dummy

**Abnahme:** Worship Keys ist als Teil der Worship Suite erkennbar, wirkt aber funktional eigenständig.

### Phase 2 — Pad Engine

- AudioContext nach Nutzeraktion initialisieren
- mindestens ein eigenes/lizenziertes Test-Preset mit 12 Keys laden
- latch, `Fade in`, `Fade out`, `Stop now`, volume und crossfade
- Main Volume, Shimmer Level, Tone und Pad Motion Speed
- getrennt einstellbare Fade-in-/Fade-out-Dauer
- lokaler Import eigener oder lizenzierter Test-Pads
- Fehler- und Ladezustände
- Audio-I/O-Panel, Output-Meter, `Choose output`, `Test output` und System-Default-Fallback

**Abnahme:** Wechsel zwischen beliebigen Keys ist ohne Klick, Lücke oder Lautheitssprung möglich.

### Phase 3 — MIDI und Chords

- Permission-/Device-Flow
- Note On/Off, Sustain und Disconnect
- aktive Keyboardanzeige
- Chord Templates, Inversionen, Confidence
- Unit Tests

**Abnahme:** Pflicht-Testakkorde und echtes Keyboard liefern stabile Resultate ohne hektisches Flackern.

### Phase 4 — Nashville und Transpose

- Major/Minor-System
- chromatische Stufen
- Enharmonik
- Input Transpose und Kalibrierung
- alle Testtabellen automatisieren

**Abnahme:** Nashville-Zahlen bleiben bei allen 12 Keys und Transpose-Werten mathematisch korrekt.

### Phase 5 — Prepare und Crescendo

- Transition-State-Machine
- Zieltonart arming
- Zieltonika-Trigger
- manual switch und cancel
- Audio-Crossfade plus sichtbarer Zustand

**Abnahme:** Keine zufälligen Wechsel durch alte Sustain-Noten oder kurze Passing Notes.

### Phase 6 — Setlists

- Song CRUD
- direkte Songwahl
- Songreihenfolge
- Tonart, Modus, Takt, Preset
- lokale Persistenz und Migration

**Abnahme:** Neue Songs überschreiben keine bestehenden Einträge; Reload erhält die Setlist.

### Phase 7 — Voice Commands

- expliziter Permission-Flow
- Transcript
- Command Parser
- Confidence und Wake Word
- graceful fallback

**Abnahme:** Erkennungsausfall beeinträchtigt MIDI und Pads nicht; keine unbestätigten Fehltrigger.

### Phase 8 — Local Live Session

- lokalen Server auf der LAN-Adresse erreichbar machen
- Host-, Leader- und Viewer-Rollen
- QR-Join, Viewer-Token und Leader PIN
- WebSocket-Snapshot, Revisionen, Acknowledge und Reconnect
- große read-only iPad-Ansicht für Nashville, Akkord, Key, Song und Transcript
- serverseitige Authorization für alle mutierenden Commands
- Remote-Control-Lock und Device Revocation

**Abnahme:** Mehrere iPads sehen denselben aktuellen Zustand; ausschließlich der bestätigte Leader kann musikalische Änderungen auslösen, und Host-Audio bleibt bei WLAN-Ausfall stabil.

### Phase 9 — Hardening

- End-to-End-Tests
- Performance und Memory Leaks
- Device Hotplug
- Accessibility
- Desktop/Tablet Screenshots
- ausführliches `HANDOFF.md`

### Phase 10 — GitHub-Veröffentlichung

- vor dem Staging `git status` und `.gitignore` prüfen
- sicherstellen, dass `.env*`, Tokens, Zugangsdaten, private Audio-Assets und große lokale Cache-/Modelldateien nicht committed werden
- Anwendung, Dokumentation und lizenzierbare Projekt-Assets bewusst stagen
- finalen Typecheck, Lint, Tests und Production Build ausführen
- getesteten Stand mit einer verständlichen Commit-Nachricht committen
- Branch auf `main` setzen
- mit der bereits authentifizierten GitHub CLI ein **privates** Repository `worship-keys` anlegen
- Remote `origin` kontrollieren und `main` pushen
- nach dem Push Repository-URL, Branch und Commit-SHA überprüfen

Beispiel für ein neues, noch nicht vorhandenes Repository:

```bash
git init
git branch -M main
git add .
git commit -m "feat: build Worship Keys MVP"
gh repo create worship-keys --private --source=. --remote=origin
git push -u origin main
```

Diese Befehle nicht blind ausführen: zuerst prüfen, ob `.git`, `origin` oder das GitHub-Repository bereits existieren. Niemals mit Force-Push fremde oder bereits vorhandene Historie überschreiben.

**Abnahme:** Das private GitHub-Repository ist erreichbar, `origin/main` zeigt auf den geprüften finalen Commit und der lokale Arbeitsbaum enthält keine versehentlich ausgelassenen Produktdateien.

## 25. Definition of Done

Worship Keys gilt für den ersten brauchbaren Release als fertig, wenn:

- [ ] alle zwölf chromatischen Keys als Pads funktionieren,
- [ ] Major und Minor auswählbar sind,
- [ ] Pads nahtlos latchen und crossfaden,
- [ ] Fade in und Fade out langsam, klickfrei und mit einstellbarer Dauer funktionieren,
- [ ] ein laufender Fade sicher umgekehrt oder sofort gestoppt werden kann,
- [ ] Main Volume den gesamten Pad-Mix kontrolliert und geglättet reagiert,
- [ ] Shimmer Level nur den Effektanteil regelt und bei `0%` das trockene Pad erhält,
- [ ] Pad Motion die Klangbewegung verändert, ohne Tonhöhe oder Key zu verändern,
- [ ] Tone und Shimmer sowohl einzeln als auch über die optionale XY-Fläche konsistent steuerbar sind,
- [ ] Audio I/O MIDI Input, Voice Input und Audio Output eindeutig getrennt anzeigt,
- [ ] SQ-Rack als Voice Device und als Audio Output gewählt werden kann,
- [ ] die tatsächlich vom Browser bereitgestellte Input-Kanalzahl sichtbar ist,
- [ ] die Kanalwahl ausschließlich reale exponierte Kanäle anbietet,
- [ ] der sichere SQ-USB-1/2-Patching-Workflow in der App erklärt wird,
- [ ] der aktuelle freigegebene Output oder `System default` sichtbar ist,
- [ ] `Choose output` in unterstützten Browsern und der System-Default-Fallback in anderen Browsern funktionieren,
- [ ] Output-Meter und leiser Testton bei der physischen Verkabelung helfen, ohne einen Kabelstatus vorzutäuschen,
- [ ] ein MIDI-Keyboard verbunden und gewechselt werden kann,
- [ ] Note On/Off und Sustain korrekt verarbeitet werden,
- [ ] gängige Akkorde und Inversionen stabil erkannt werden,
- [ ] Nashville Numbers relativ zur Concert Key korrekt sind,
- [ ] Hardware-/Input-Transpose explizit korrigiert werden kann,
- [ ] Prepare einen Ziel-Key armed,
- [ ] ein valider Zielakkord den vorbereiteten Wechsel auslösen kann,
- [ ] Switch Now und Cancel immer verfügbar sind,
- [ ] Songs mit Key, Mode und Time Signature in einer Setlist gespeichert werden,
- [ ] Voice Commands optional und fehlertolerant funktionieren,
- [ ] das Host-MacBook eine lokale Session über feste LAN-Adresse und QR-Code bereitstellt,
- [ ] ein bestätigtes Pianisten-iPad als Leader Key, Song und Transition steuern kann,
- [ ] Viewer-iPads ausschließlich Nashville, Akkord, Key, Song, Transition und Transcript sehen,
- [ ] Viewer serverseitig keine mutierenden Aktionen ausführen können,
- [ ] nur ein Leader gleichzeitig aktiv ist oder eine Übergabe ausdrücklich bestätigt wurde,
- [ ] Host-Audio bei Verlust des Netzwerks oder aller iPad-Verbindungen weiterläuft,
- [ ] Reconnect einen vollständigen, aktuellen Snapshot lädt,
- [ ] alle sichtbaren UI-Texte Englisch sind,
- [ ] Logo oben links und Favicon sauber aussehen,
- [ ] das Design den Regeln aus `Design-Art.md` entspricht,
- [ ] Typecheck, Lint und Tests bestehen,
- [ ] ein neues `HANDOFF.md` Architektur, Setup, bekannte Grenzen und nächste Schritte erklärt,
- [ ] ein privates GitHub-Repository `worship-keys` angelegt wurde,
- [ ] der vollständige geprüfte Stand ohne Secrets und unlizenzierte Audio-Assets auf `origin/main` gepusht wurde,
- [ ] Repository-URL und finaler Commit-SHA im Handoff dokumentiert sind.

## 26. Verbindliche Qualitätstests

### MIDI

- Note On + Note Off
- Note On Velocity 0
- Sustain press/release
- Gerät während gehaltenem Akkord trennen
- zwei MIDI-Geräte, selektiertes Gerät zählt
- wiederholte gleiche Note

### Musiktheorie

- alle 12 Roots × Major/Minor-Triads
- alle 12 Concert Keys × diatonische Stufen
- chromatische Borrowed Chords
- Inversionen
- `-12` bis `+12` Input Transpose
- Flat-/Sharp-Spelling

### Audio

- Start nach User Gesture
- Fade in aus Stille bis zum gespeicherten Zielpegel
- Fade out vom aktuellen Pegel bis Stille
- Fade während des Verlaufs umkehren
- wiederholte schnelle Fade-Befehle erzeugen keine doppelten Sources und keine Klicks
- Main Volume bei schnellen Änderungen bleibt klickfrei
- Shimmer bei `0%`, Default und `100%` bleibt pegelstabil und begrenzt
- Pad Motion bei Minimum/Maximum verändert weder Grundton noch Loop-Länge
- Tone-/Shimmer-XY und Einzelregler bleiben bidirektional synchron
- Pad-Wechsel bei laufendem Audio
- schnelles mehrfaches Umschalten
- Transition abbrechen
- Tab verliert Fokus
- Assetfehler
- kein Clipping bei Crescendo und Crossfade
- Standard-Audioausgang ohne zusätzliche Permission
- unterstützte Output-Auswahl nach Nutzeraktion
- ausgewähltes Gerät während der Wiedergabe trennen
- Browser ohne `selectAudioOutput`/`AudioContext.setSinkId`
- `Test output` bei niedrigem sicheren Startpegel
- Voice Input wird niemals versehentlich auf den Output gemonitort
- SQ-Rack Input wählen und tatsächliches `channelCount` anzeigen
- SQ stellt nur Mono/Stereo bereit: keine falschen 32 Kanaloptionen anzeigen
- Mehrkanaltrack mit Testquelle: gewählter exponierter Kanal speist nur den Analyser/ASR-Track
- SQ USB Output 1/2 zum Mac und Mac Output 1/2 zurück zum SQ ohne Feedbackschleife
- Sample-Rate-Wechsel verlangt kontrollierten AudioContext-Neustart

### UI

- Desktop 1440 px und 1920 px
- Tablet Landscape
- Tastatursteuerung
- Screenreader-Namen
- Reduced Motion
- keine gemischte deutsche/englische Oberfläche

### Local Live Session

- Host über feste LAN-IP von mindestens drei iPads gleichzeitig öffnen
- Viewer versucht mutierenden API-/WebSocket-Command: Server verweigert ihn
- Leader ändert Key: Host bestätigt, Audio wechselt und alle Viewer aktualisieren sich
- zweites Gerät fordert Leader: keine stille Übernahme
- Viewer tritt während laufender Session bei und erhält sofort vollständigen Snapshot
- WLAN am Viewer aus/an: letzter Stand wird als stale markiert und danach korrekt synchronisiert
- WLAN am Host kurz getrennt: Audio läuft lokal weiter und Remote Controls bleiben sicher
- doppelte oder veraltete `messageId`/`revision` wird nicht erneut ausgeführt
- Transcript wird als Text übertragen, niemals als Mikrofon-Audiostream
- Remote Control Lock blockiert alle Leader-Mutationen
- Gast-WLAN mit Client Isolation erzeugt verständliche Netzwerkdiagnose

## 27. Offene Produktentscheidungen

Diese Punkte sollen während des ersten Prototyps mit echten Keyboardern validiert werden:

1. Soll ein Prepared Key nur durch seine Tonika oder durch jeden diatonischen Akkord auslösen?
2. Sind separate Major-/Minor-Pad-Audios nötig oder reicht zunächst ein neutraler Root/Fifth-Drone?
3. Soll Nashville in Minor relativ (`1m, 2°, ♭3`) oder parallel-major-orientiert angezeigt werden? Dieses Dokument empfiehlt relativ mit klarer Qualität.
4. Soll `Crescendo` automatisch den Switch auslösen oder nur vorbereiten?
5. Welche englischen und deutschen Voice-Phrasen sind im realen Gottesdienst zuverlässig genug?
6. Wird getrenntes Audio-Output-Routing im Zielbrowser und mit der realen Audiohardware zuverlässig unterstützt?
7. Soll ein Leader-Gerät vom Host jedes Mal bestätigt werden oder reicht der kurzlebige PIN?
8. Soll die lokale Session ausschließlich LAN verwenden oder optional über einen privaten VPN-/Cloud-Relay erreichbar sein?

Bis zur Nutzerentscheidung gelten die in diesem Dokument genannten sicheren Defaults.

## 28. Recherchequellen

- [MK Bailey Music — Presence Ambient Drone Pads](https://mkbaileymusic.com/#!/Presence-Ambient-Drone-Pads/p/779067686)
- [MK Bailey Music — The Power of Ambient Drone Pads in Worship Music](https://mkbaileymusic.com/blog/Blog%20Post%20Title%20One-3zaa9-zlxng-s9stg-a3ak5)
- [Kell Bailey — Presence announcement](https://www.patreon.com/KellBailey/posts/presence-ambient-139193014)
- [MK Bailey Music — official SoundCloud previews](https://soundcloud.com/mkbaileymusic)
- [W3C — Web MIDI API](https://www.w3.org/TR/webmidi/)
- [MDN — MIDIMessageEvent](https://developer.mozilla.org/en-US/docs/Web/API/MIDIMessageEvent)
- [W3C — Web Audio API 1.1](https://www.w3.org/TR/webaudio-1.1/)
- [MDN — AudioBufferSourceNode loop](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop)
- [MDN — SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Apple Logic Pro — Chord Trigger overview](https://support.apple.com/guide/logicpro/chord-trigger-overview-lgceb57e806c/mac)
- [Sunday Sounds — Tonic Pad Player for MainStage](https://support.sundaysounds.com/article/3298-sunday-keys-for-mainstage-2021-using-the-tonic-pad-player)
- [Sunday Sounds — Tonic Ambient Drone Pad Player](https://sundaysounds.com/blogs/news/sunday-keys-using-the-tonic-ambient-drone-pad-player-in-mainstage)
- [Sunday Sounds — Effects and Shimmer Amount](https://support.sundaysounds.com/article/3140-effects)
- [MDN — MediaDevices.selectAudioOutput](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput)
- [MDN — AudioContext.setSinkId](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId)
- [W3C — Audio Output Devices API](https://www.w3.org/TR/audio-output/)
- [Allen & Heath — SQ-Rack 32×32 USB interface](https://www.allen-heath.com/hardware/sq/sq-rack/)
- [Allen & Heath — SQ-Rack Getting Started Guide](https://support.allen-heath.com/hc/en-gb/articles/41222924565777-SQ-Rack-Getting-Started-Guide)
- [Allen & Heath — SQ Reference Guide 1.6](https://www.allen-heath.com/content/uploads/2025/02/SQ_ReferenceGuide_V1_6_0_iss1.pdf)
- [MDN — MediaTrackSettings.channelCount](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/channelCount)
- [MDN — SpeechRecognition.start(audioTrack)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start)

## 29. Startprompt in Kurzform

Falls eine neue Codex-Session nur einen kompakten Startbefehl benötigt:

> Baue Worship Keys gemäß `Worship-Keys.md`. Lies zuerst `Design-Art.md` und untersuche anschließend `/Users/ahazsubramaniyam/Documents/Codes/Worship Loops` nur lesend als visuelle Referenz. Beginne mit Foundation und Pad Engine einschließlich Fade, Main Volume, Shimmer, Tone, Pad Motion und Audio I/O; implementiere danach Web MIDI, Akkorderkennung, Nashville Numbers, Transpose, Prepare/Crescendo, Setlists und Voice Commands. Zeige MIDI Input, Voice Input und den aktuellen Audio Output getrennt an. Unterstütze das SQ-Rack als 32×32-Core-Audio-Gerät, zeige aber nur die Kanäle an, die der Browser wirklich exponiert. Implementiere als sicheren Web-Default das SQ-Patching des MD-Mikrofons auf USB Output 1–2 sowie den getrennten Pad-Return über SQ USB Input 1–2; plane freie 32×32-Kanalwahl als optionale lokale CoreAudio Bridge. Unterstütze außerdem eine freigegebene Output-Auswahl mit System-Default-Fallback und liefere einen sicheren Testton für die 3,5-mm-/Audiointerface-Verkabelung. Ergänze eine lokale Live Session: Das feste MacBook bleibt Audio-Host und stellt über eine feste LAN-Adresse sowie QR-Code eine WebSocket-Session bereit. Ein bestätigtes Pianisten-iPad erhält Leader-Rechte für Song, Key und Transition; alle übrigen Musiker-iPads sind serverseitig erzwungene Viewer und sehen ausschließlich Nashville, Akkord, Key, Song, Status und Voice-Transcript. Audio bleibt immer lokal am Host und läuft bei WLAN-Ausfall weiter. Implementiere kein Mock-only-Produkt: teste Musiktheorie, MIDI-State, Audio-Crossfades, Klangregler, Rollenrechte, Reconnect und mehrere iPads gleichzeitig. Verwende ausschließlich eigene oder lizenzierte Pad-Audios, halte die gesamte UI Englisch und dokumentiere jede relevante Architekturentscheidung im neuen Projekt. Lege nach erfolgreicher Prüfung das private GitHub-Repository `worship-keys` an, pushe den finalen `main`-Branch und dokumentiere Repository-URL sowie Commit-SHA im Handoff.

---

**Worship Keys soll sich im ersten Moment vertraut anfühlen und im zweiten Moment wie ein vollkommen neues Instrument.**
