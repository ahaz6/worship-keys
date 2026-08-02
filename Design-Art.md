# Worship Suite — Design Art Direction

> Wiederverwendbares Design-Handout für **Worship Loops**, **Worship Keys** und zukünftige Produkte der Reihe **Worship XYZ**.
>
> Version: 1.0 · Stand: 2. August 2026

## 1. Zweck dieses Dokuments

Dieses Dokument definiert die gemeinsame visuelle DNA der Worship-Produktreihe. Eine neue App soll sofort als Teil derselben Familie erkennbar sein, ohne die Oberfläche oder Funktionalität von Worship Loops zu kopieren.

Die verbindende Idee lautet:

> **A calm, premium, black-led worship workspace with restrained violet and blue light.**

Die Apps sind Werkzeuge für Musiker während Probe, Gottesdienst und Vorbereitung. Das Design darf atmosphärisch wirken, muss aber vor allem schnell lesbar, ruhig und verlässlich sein. Die Bühne ist kein Ort für visuelles Rauschen.

## 2. Referenzprojekt

Die lebende Referenz ist das lokale Worship-Loops-Projekt:

`/Users/ahazsubramaniyam/Documents/Codes/Worship Loops`

Vor dem Bau einer weiteren Worship-App sollen mindestens diese Dateien **nur lesend** geprüft werden:

- `HANDOFF.md` — Produktzustand, Architektur und bisherige Entscheidungen
- `app/globals.css` — finale Farben, Flächen, Abstände und responsive Regeln
- `app/worship-loops-app.tsx` — Anordnung, Brand-Bereich und Interaktionsdichte
- `app/layout.tsx` — Fonts, Metadaten und Browser-Icon
- `public/worship-loops-icon.png` und `app/icon.png` — Umgang mit Produktlogo und Favicon

Wichtig: Das Referenzprojekt liefert die **Designsprache**, nicht automatisch das Layout oder die Komponentenlogik einer neuen App. Worship Keys benötigt beispielsweise keine Song-Waveform und keinen Stem Mixer.

## 3. Markenarchitektur

Jede App verwendet dieselbe Namenslogik:

- Oberzeile: `WORSHIP`
- Produktzeile: `LOOPS`, `KEYS`, später beispielsweise `VOCALS`, `CLICK` oder `SETS`
- Eigenes rundes Logo pro Produkt
- Gemeinsame dunkle Grundwelt
- Eine leicht variierende Akzentmischung innerhalb des violett-blauen Spektrums

### 3.1 Logo-Behandlung

- Das Logo sitzt links oben und bildet gemeinsam mit dem Namen den visuellen Anker.
- Empfohlene Desktopgröße: 44–52 px.
- Logo niemals verzerren, stauchen oder in eine fremde Maske pressen.
- Wenn die Quelldatei schwarzen Rand oder Hintergrund besitzt, für Header und Favicon eine sauber zugeschnittene Variante erzeugen.
- Das Logo erhält genügend Ruhefläche; keine Sterne, Texte oder Buttons unmittelbar dahinter.
- Im Browser-Tab wird eine eigens optimierte, quadratische Favicon-Datei verwendet. Ein großes Hero-Bild ist kein geeignetes Favicon.

Für **Worship Keys** ist die verbindliche Quelldatei:

`/Users/ahazsubramaniyam/Documents/Codes/Worship Keys/Worship Keys Icon.png`

Die Quelldatei bleibt unverändert. Beim Aufbau des Worship-Keys-Projekts wird eine Kopie unter einem eindeutigen Namen in `public/` abgelegt und daraus eine separate kleine Favicon-/App-Icon-Variante erzeugt.

### 3.2 Wortmarke

- Großbuchstaben mit großzügigem Tracking.
- `WORSHIP` und Produktname werden zweizeilig gesetzt.
- Die Wortmarke darf einen sehr subtilen Verlauf von fast Weiß zu hellem Violett und Blau erhalten.
- Keine Neon-Außenkontur um den gesamten Schriftzug.

## 4. Visuelle Leitprinzipien

### 4.1 Black first

Schwarz und sehr dunkle neutrale Flächen tragen die App. Violett und Blau markieren Zustand, Fokus und Marke. Sie ersetzen nicht den Hintergrund.

### 4.2 Space, not sci-fi

Die Atmosphäre darf an Tiefe, Nacht und Licht erinnern, aber nicht an ein Computerspiel oder ein buntes Nebelbild. Erlaubt sind:

- schwache radiale Lichtfelder,
- minimale Sternpunkte oder feines Korn,
- leise Violett-Blau-Übergänge,
- dunkle, fast schwarze Panels.

Nicht erlaubt sind:

- großflächige Galaxie-Fotos,
- grelle Nebelwolken,
- permanent leuchtende Neon-Rahmen,
- mehrere konkurrierende Farbverläufe,
- animierte Partikel hinter wichtigen Live-Daten.

### 4.3 Performance before decoration

Während eines Songs müssen aktueller Zustand, nächster Schritt und Hauptsteuerung innerhalb einer Sekunde erfassbar sein. Dekoration darf niemals Tonart, Akkord, Transportstatus oder Warnungen überlagern.

### 4.4 One strong action

Jeder Bildschirm besitzt eine klar stärkste Aktion. Beispiele:

- Worship Loops: `Add song`
- Worship Keys: `Start pads`, `Prepare transition` oder die aktive Tonart

Sekundäre Aktionen bleiben neutral und zurückhaltend.

## 5. Farbwelt

Die folgenden Tokens bilden die gemeinsame Ausgangsbasis. Eine neue App darf sie leicht anpassen, muss aber die Helligkeitshierarchie beibehalten.

```css
:root {
  color-scheme: dark;

  --wl-bg-deep: #09090c;
  --wl-bg: #0d0d12;
  --wl-panel: #121216;
  --wl-panel-raised: #17171e;
  --wl-panel-active: #20202a;

  --wl-text: #efeff4;
  --wl-text-soft: #b5b3c1;
  --wl-text-muted: #85858f;
  --wl-text-faint: #62626c;

  --wl-line: #292931;
  --wl-line-strong: #353541;

  --wl-violet: #7668b7;
  --wl-violet-bright: #9d8cff;
  --wl-indigo: #4e5fc6;
  --wl-blue: #5d7fe6;
  --wl-cyan-muted: #5b929d;
  --wl-success: #67a89e;
  --wl-warning: #c89b61;
  --wl-danger: #c76f7b;
}
```

### 5.1 Hintergrundrezept

```css
body {
  background:
    radial-gradient(ellipse at 52% 0%, #282348 0, transparent 28%),
    radial-gradient(ellipse at 78% 45%, #151b2d 0, transparent 30%),
    linear-gradient(145deg, #090a0d 0%, #111116 52%, #0a0a0e 100%);
}
```

Dieses Rezept ist ein Ausgangspunkt. Die Deckkraft der Lichtfelder soll so niedrig sein, dass die App zunächst dunkel und erst danach „spacey“ wirkt.

### 5.2 Farbverwendung

- Violett: Primäraktion, aktive Tonart, Fokus, ausgewählter Zustand
- Blau/Indigo: sekundäre musikalische Information, MIDI-Aktivität, vorbereiteter Zustand
- Gedämpftes Cyan: verbunden/bereit/erfolgreich
- Orange: Warnung oder notwendige Aufmerksamkeit
- Rot: echter Fehler oder destruktive Aktion
- Weiß: Hauptinformation, nicht Dekoration

Farbe darf niemals die einzige Zustandsinformation sein. Text, Icon oder Form müssen den Zustand zusätzlich ausdrücken.

## 6. Typografie

### 6.1 Fonts

- UI und Fließtext: **Geist Sans**
- Zahlen, MIDI-Daten, BPM, Zeit und technische Werte: **Geist Mono**
- Große musikalische Überschriften dürfen eine ruhige Serifenschrift verwenden, sofern sie wie in Worship Loops bereits konsistent eingebunden ist.

### 6.2 Hierarchie

- Produkt-/Songtitel: 28–34 px Desktop
- Zentrale Performanceinformation: 48–88 px, abhängig vom Inhalt
- Abschnittstitel: 18–24 px
- Body: 14–16 px
- Labels: 10–12 px, uppercase, 0.12–0.18 em Tracking
- Technische Metadaten: 11–13 px Mono

Keine dekorative Schrift für Bedienelemente. Ein Live-Button muss auch aus Entfernung lesbar sein.

## 7. Layout-DNA

### 7.1 Desktop-Shell

Die bevorzugte Desktop-Struktur besitzt drei Verantwortungsbereiche:

```text
┌──────────────────┬────────────────────────────────┬───────────────────┐
│ Brand / Library  │ Main performance workspace     │ Context / Mixer   │
│ Setlist / Songs  │ Primary musical interaction    │ Devices / Details │
└──────────────────┴────────────────────────────────┴───────────────────┘
```

Richtwerte aus Worship Loops:

- linke Rail: ungefähr 260 px
- Mitte: flexibel, mindestens 560 px
- rechte Rail: ungefähr 292 px
- vertikale Trennlinien statt schwerer Card-Schatten

Eine neue App darf die rechte Rail einklappen oder den Inhalt anders organisieren. Verantwortungen dürfen jedoch nicht ungeordnet vermischt werden.

### 7.2 Brand oben links

Der obere linke Bereich bleibt in allen Produkten ähnlich:

- rundes Produktlogo,
- zweizeiliger Produktname,
- darunter die wichtigste Bibliotheks- oder Erstellaktion,
- danach App-spezifische Navigation, zum Beispiel Setlist statt Songsuche.

### 7.3 Responsive Verhalten

- Desktop ist für Live-MIDI und Audio die primäre Zielgröße.
- Tablet erhält eine reduzierte Zwei-Spalten- oder Drawer-Ansicht.
- Mobile darf eine Monitor-/Fernsteuerungsansicht sein; es muss nicht jede Desktopfunktion auf engem Raum zeigen.
- Primäraktionen benötigen mindestens 44 × 44 px Touchfläche.
- Kritische Live-Informationen dürfen nicht nur per Hover erreichbar sein.

## 8. Flächen, Linien und Tiefe

- Grundfläche: `#09090c` bis `#111116`
- Panels: `#121216` oder `#15151b`
- Aktive Cards: maximal eine Stufe heller plus Akzentlinie
- Standardborder: 1 px, `#292931`
- Radius kleine Controls: 8–10 px
- Radius Cards: 12–16 px
- Große Modalflächen: 18–22 px
- Schatten sehr weich und dunkel; kein helles Glow um jede Card

Ein Akzent-Glow ist ausschließlich für aktiven Fokus, aktuellen Key oder laufende Transition gedacht.

## 9. Komponentenregeln

### 9.1 Primary Button

- dunkler violett-blauer Verlauf,
- klare helle Beschriftung,
- leichter innerer Lichtpunkt,
- Hover: minimal heller oder 1–2 px anheben,
- Active: wieder absenken, kein starkes Pulsieren.

### 9.2 Secondary Button

- dunkle Fläche,
- neutrale Border,
- helle oder gedämpfte Schrift,
- Akzent erst bei Hover/Fokus.

### 9.3 Musical State Card

Für Tonart, Akkord, Nashville-Zahl oder Abschnitt:

- große Hauptinformation,
- kleine erklärende Zeile,
- eindeutiger Zustand `Current`, `Prepared`, `Listening` oder `Transitioning`,
- nicht mehr als zwei Akzentfarben gleichzeitig.

### 9.4 Sliders und Knobs

- Track neutral, Füllung violett oder blau,
- sichtbarer Wert daneben oder darüber,
- Tastatursteuerung und ARIA-Label,
- Live-Audio-Controls möglichst ohne Layoutsprung.

### 9.5 Statusanzeigen

Status folgt immer dem Muster:

`Icon/Dot + kurzer Status + optionaler Detailtext`

Beispiele:

- `● MIDI connected — KeyLab 61`
- `● Listening — English commands`
- `● Prepared — G Major`
- `! No MIDI permission`

### 9.6 Modals

- Hintergrund deutlich abdunkeln, aber nicht unnötig stark weichzeichnen.
- Ein Modal behandelt genau eine Aufgabe.
- Escape schließt nicht-destruktive Modals.
- Fokus bleibt im Dialog und kehrt danach zur auslösenden Aktion zurück.

### 9.7 Musikalische Fade-Controls

- `Fade in` und `Fade out` erscheinen als zusammengehörige Transportaktionen mit eindeutigen Richtungssymbolen und Textlabels.
- Während des Verlaufs zeigt der aktive Button `Fading in` beziehungsweise `Fading out` und einen ruhigen Fortschritt an.
- Die Dauer gehört in ein sekundäres Einstellungsfeld und nicht als dauerhaft großer Regler in die Performance-Mitte.
- `Stop now` ist optisch zurückhaltender als die Fade-Aktionen, bleibt aber jederzeit direkt erreichbar.
- Visuelle Animation und tatsächliche Web-Audio-Automation müssen denselben Zustand abbilden; die UI darf einen abgeschlossenen Fade nicht früher vortäuschen.

### 9.8 Pad Sound Controls

Die drei wichtigsten Klangregler werden als zusammengehörige, aber klar getrennte Gruppe dargestellt:

- `Main Volume` ist visuell der wichtigste Pegel und erhält den größten Regler.
- `Shimmer` steuert den Effektanteil und verwendet einen dezenten violetten Akzent.
- `Motion` steuert die Entwicklungsgeschwindigkeit und verwendet eine ruhige blau-violette Skala von `Still` bis `Fast`.
- `Tone` darf gemeinsam mit `Shimmer` als XY-Fläche angeboten werden: horizontal dunkel → hell, vertikal dry → shimmer.
- Jeder visuelle XY-Parameter benötigt zusätzlich einen normalen zugänglichen Slider mit sichtbarem Zahlenwert.
- Reglerbewegungen dürfen nicht wie hektische Animationen aussehen; musikalische Parameter werden visuell weich nachgeführt.
- Preset-Defaults sind durch eine feine Markierung sichtbar und über `Reset` wiederherstellbar.

### 9.9 Audio I/O Panel

- Das Panel gruppiert `MIDI Input`, `Voice Input` und `Audio Output`, hält sie aber sprachlich und visuell eindeutig getrennt.
- Jeder Eintrag verwendet Statuspunkt, kurzen Typ und konkreten Gerätenamen.
- `System default` ist ein gültiger, neutraler Zustand und kein Fehler.
- `Device unavailable` verwendet Warnfarbe und eine direkt danebenliegende Lösung.
- Ein kompakter Stereo-Output-Meter darf Aktivität anzeigen, aber niemals behaupten, ein analoges Kabel sei verbunden.
- `Choose output` und `Test output` sind sekundäre, klar beschriftete Buttons.
- Lange Gerätenamen werden gekürzt, bleiben jedoch per Tooltip und Screenreader vollständig verfügbar.
- Bei Mehrkanalgeräten steht unter dem Gerätenamen eine zweite Zeile wie `Input 1–2 · 2 channels exposed`.
- Nicht verfügbare Hardwarekanäle erscheinen nicht als scheinbar auswählbare Einträge.
- Ein `Advanced routing required`-Hinweis ist sachlich und erklärt den nächsten Schritt, ohne den Live-Screen zu dominieren.

### 9.10 Network Session Views

- `Host` erhält Geräte, Pairing, verbundene Clients und `Lock remote control`.
- `Leader` erhält ausschließlich musikalisch relevante Performance-Controls.
- `Viewer` ist eine eigenständige, groß gesetzte Monitoransicht ohne deaktivierte Buttons.
- Rolle und Verbindungsstatus stehen oben rechts als kompakte Labels wie `LEADER · LIVE` oder `VIEW ONLY · LIVE`.
- Nashville-Zahl ist in der Viewer-Ansicht das größte Element, gefolgt von Akkord und Concert Key.
- Transcript steht in einem ruhigen unteren Bereich und verdrängt nie Nashville-/Key-Informationen.
- `Reconnecting` und das Alter des letzten Updates sind sichtbar, ohne den gesamten Bildschirm zu blockieren.
- Ein QR-Code erscheint nur im Host-/Join-Screen, nicht dauerhaft im Performance-Screen.

## 10. Motion und Audio-Feedback

- Standardübergänge: 140–220 ms.
- Musikalische Crossfades dürfen mehrere Sekunden dauern, UI-Motion jedoch nicht.
- `prefers-reduced-motion` respektieren.
- Eine laufende Transition kann durch einen ruhigen Fortschrittsring oder eine Lichtkante gezeigt werden.
- Keine dauernden Parallax-, Stern- oder Partikelanimationen.
- Audiozustände müssen visuell nachvollziehbar bleiben; umgekehrt darf ein visueller Klick nicht fälschlich bedeuten, dass Audio bereits läuft.

## 11. Barrierefreiheit und Bühnentauglichkeit

- WCAG-AA-Kontrast für Text und wichtige Controls anstreben.
- Vollständige Tastaturbedienung.
- Sichtbarer Fokuszustand in hellem Violett/Blau.
- Keine winzigen Mute-, Device- oder Key-Controls.
- Farbcodierung immer mit Text oder Symbol ergänzen.
- Live-Modus mit größeren Informationen und reduzierter Oberfläche einplanen.
- Fehlermeldungen konkret formulieren: Problem, Auswirkung, nächster Schritt.
- Keine automatisch aktivierten Mikrofone oder MIDI-SysEx-Berechtigungen.

## 12. Sprache

Die sichtbare Benutzeroberfläche der Produktreihe ist vollständig **Englisch**. Keine Mischung aus Deutsch und Englisch.

Interne Dokumentation darf Deutsch sein. Code, Variablennamen, Dateinamen, Tests und UI-Strings bleiben Englisch.

Ton der UI:

- kurz,
- ruhig,
- konkret,
- nicht technisch, wenn der Nutzer keine technische Entscheidung treffen muss.

Beispiele:

- Gut: `Connect MIDI keyboard`
- Gut: `Prepared for G Major`
- Gut: `Microphone access is blocked. Allow it in your browser settings.`
- Schlecht: `MIDIAccess Promise rejected`

## 13. Eigenständigkeit neuer Produkte

Worship Keys darf sich durch folgende Elemente differenzieren:

- größere Tonart- und Nashville-Anzeigen,
- Key-Pads oder ein chromatisches Key-Ribbon,
- MIDI-Aktivitätsvisualisierung,
- vorbereitete Transitionen,
- Setlist als primäre linke Navigation.

Es soll **nicht** übernehmen:

- die Worship-Loops-Waveform,
- den Stem Mixer,
- A/B-Audioloops,
- UI-Elemente nur deshalb, weil sie im Referenzprojekt existieren.

Die Familie entsteht durch Marke, Farbe, Typografie, Rhythmus und Ruhe — nicht durch identische Screens.

## 14. Qualitätscheck vor Freigabe

- [ ] Logo und Produktname sitzen oben links korrekt und unverzerrt.
- [ ] Browser-Icon ist separat optimiert und auf 16/32 px lesbar.
- [ ] Schwarz ist die dominante Farbe; Violett/Blau sind Akzente.
- [ ] Keine großflächige oder aufdringliche Space-Grafik.
- [ ] Die wichtigste Aktion ist eindeutig.
- [ ] Aktueller musikalischer Zustand ist aus zwei Metern Entfernung lesbar.
- [ ] Alle sichtbaren Texte sind Englisch.
- [ ] Tastaturfokus und Screenreader-Namen sind vorhanden.
- [ ] Tablet-/Mobile-Zustände sind bewusst gestaltet.
- [ ] `prefers-reduced-motion` wird respektiert.
- [ ] Neue App wirkt verwandt mit Worship Loops, aber nicht wie ein umbenannter Klon.

## 15. Design-Übergabe an einen neuen Agenten

Beim Start eines neuen Worship-Projekts gilt:

1. Dieses Dokument vollständig lesen.
2. Das Referenzprojekt im oben genannten Pfad nur lesend untersuchen.
3. Produktlogo und dessen tatsächliche Abmessungen prüfen.
4. Erst ein Interface-System und einen Hauptscreen definieren.
5. Danach die produktspezifische Funktionalität implementieren.
6. Vor Abschluss echte Screenshots bei Desktop- und Tabletbreite prüfen.

Das Ziel ist nicht „mehr Space“. Das Ziel ist **mehr Ruhe, Tiefe und musikalische Sicherheit**.
