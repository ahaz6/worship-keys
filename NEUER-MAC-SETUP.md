# Worship Keys auf einem neuen MacBook einrichten

Diese Anleitung richtet sich ausdrücklich an Nutzer ohne Git-, Terminal- oder
Programmierkenntnisse. Git wird nicht benötigt. Die eigentliche Einrichtung
erfolgt per Doppelklick.

## Das brauchst du

- Internet während der einmaligen Installation,
- das Administratorpasswort des neuen Macs,
- einen GitHub-Account mit Zugriff auf das private Repository `ahaz6/worship-keys`,
- ungefähr 10 GB freien Speicher als sichere Reserve,
- macOS 13 oder neuer.

Nach der Einrichtung funktioniert der Offline-Church-Modus ohne Internet.

## Übersicht

Du erledigst nur diese fünf Dinge:

1. Chrome installieren.
2. Node.js LTS installieren.
3. Worship Keys als ZIP von GitHub herunterladen.
4. Den Ordner nach `Dokumente` verschieben.
5. **Worship Keys installieren.command** doppelklicken.

## Schritt 1 – Google Chrome installieren

1. Öffne [google.com/chrome](https://www.google.com/chrome/).
2. Wähle **Chrome herunterladen**.
3. Öffne `googlechrome.dmg` aus dem Downloads-Ordner.
4. Ziehe Google Chrome auf den Ordner **Programme**.
5. Öffne Chrome einmal.

Chrome ist wichtig, weil Web MIDI dort zuverlässig unterstützt wird. Google
beschreibt den macOS-Ablauf ebenfalls in der
[offiziellen Chrome-Anleitung](https://support.google.com/chrome/answer/95346?co=GENIE.Platform%3DDesktop&hl=de).

## Schritt 2 – Node.js installieren

Node.js ist der unsichtbare Motor, der Worship Keys lokal auf dem Mac startet.

1. Öffne die [offizielle Node.js-Downloadseite](https://nodejs.org/en/download).
2. Wähle die Version mit der Bezeichnung **LTS** – nicht **Current**.
3. Lade den macOS-Installer (`.pkg`) herunter.
4. Öffne die heruntergeladene `.pkg`-Datei.
5. Klicke durch den Installer und gib bei Bedarf das Mac-Passwort ein.
6. Nach Abschluss alle Installationsfenster schließen.

Worship Keys benötigt Node.js 22.13 oder neuer. Die jeweils aktuelle LTS-Version
ist die empfohlene Wahl.

## Schritt 3 – Bei GitHub anmelden

1. Öffne [github.com](https://github.com/) in Chrome.
2. Klicke oben rechts auf **Sign in**.
3. Melde dich mit dem GitHub-Account an, der Zugriff auf Worship Keys besitzt.
4. Öffne das private Repository:
   [github.com/ahaz6/worship-keys](https://github.com/ahaz6/worship-keys).

Wenn GitHub `404` oder „Page not found“ zeigt, ist entweder der falsche Account
angemeldet oder dieser Account wurde noch nicht für das private Repository
freigeschaltet.

## Schritt 4 – Worship Keys ohne Git herunterladen

1. Auf der Repository-Seite den grünen Button **Code** anklicken.
2. Im geöffneten Menü **Download ZIP** wählen.
3. Warten, bis der Download vollständig abgeschlossen ist.
4. Im Finder den Ordner **Downloads** öffnen.
5. Falls macOS die ZIP nicht automatisch entpackt hat, die ZIP doppelklicken.
6. Der entpackte Ordner heißt gewöhnlich `worship-keys-main`.
7. Den Ordner in `Worship Keys` umbenennen.
8. Den Ordner nach **Dokumente** verschieben.

Der feste Zielpfad sollte anschließend so aussehen:

```text
Macintosh HD → Benutzer → dein Name → Dokumente → Worship Keys
```

Den Ordner nach der Installation nicht mehr verschieben oder löschen. Die
macOS-App merkt sich diesen Ort, um den lokalen Server und die Pad-Dateien zu
finden.

GitHub bestätigt in seiner
[offiziellen Download-Anleitung](https://docs.github.com/de/repositories/working-with-files/using-files/downloading-files-from-github),
dass ein Repository direkt als ZIP geladen werden kann. Git oder GitHub Desktop
sind dafür nicht nötig.

## Schritt 5 – Den Ein-Klick-Installer starten

1. Im Finder **Dokumente → Worship Keys** öffnen.
2. Die Datei **Worship Keys installieren.command** suchen.
3. Die Datei doppelklicken.
4. Falls macOS das Öffnen blockiert:
   - mit der rechten Maustaste auf die Datei klicken,
   - **Öffnen** wählen,
   - im nächsten Fenster erneut **Öffnen** wählen.
5. Es öffnet sich einmal ein Terminalfenster. Du musst dort nichts eingeben.
6. Warten, bis **INSTALLATION ERFOLGREICH** erscheint.
7. Falls macOS nach einem Administratorpasswort fragt, das Mac-Passwort
   eingeben.

Der Assistent erledigt automatisch:

- Prüfung der Node.js-Version,
- Installation aller benötigten Bestandteile,
- Erstellung des Produktions-Builds,
- Einrichtung des lokalen macOS-Hintergrunddienstes,
- Installation von **Worship Keys Church** unter `/Programme`,
- Installation von **Stop Worship Keys** unter `/Programme`.

## Schritt 6 – Worship Keys zum ersten Mal öffnen

1. Finder öffnen.
2. Links **Programme** wählen.
3. **Worship Keys Church** doppelklicken.
4. Falls macOS nach eingehenden Netzwerkverbindungen fragt: **Erlauben**.
5. Chrome öffnet automatisch `http://localhost:3000`.
6. **Enable audio** beziehungsweise **Check all offline pads** wählen.
7. Warten, bis alle zwölf Pads bereit sind.

Zum späteren Beenden im Programme-Ordner **Stop Worship Keys** doppelklicken.
Das Schließen des Chrome-Tabs allein beendet den lokalen Server nicht.

## Schritt 7 – Vor dem ersten Sonntag die Setlist übertragen

Solange der Mac Internet hat:

1. [worship-keys-psi.vercel.app/play](https://worship-keys-psi.vercel.app/play)
   öffnen.
2. **Google Drive** beziehungsweise **Open setlist from Drive** wählen.
3. Mit dem für Worship Keys freigeschalteten Account anmelden.
4. Die aktuelle Setlist öffnen.
5. Songanzahl und Reihenfolge prüfen.
6. Auf **Saved on this device** achten.

Danach liegt die Setlist lokal im Chrome-Profil und kann in der Gemeinde ohne
Internet verwendet werden.

## Schritt 8 – Test vor dem Umzug in die Gemeinde

Noch zu Hause einmal vollständig prüfen:

1. **Worship Keys Church** starten.
2. MIDI-Keyboard anschließen und in Chrome freigeben.
3. Audioausgang auswählen beziehungsweise in macOS einstellen.
4. **Check all offline pads** drücken.
5. Auf **READY · INTERNET NOT REQUIRED** warten.
6. **Show local join QR** öffnen.
7. QR mit einem Handy im selben WLAN testen.
8. Anschließend **Stop Worship Keys** öffnen.
9. Prüfen, dass `http://localhost:3000` nicht mehr erreichbar ist.

## Worship Keys später aktualisieren – ebenfalls ohne Git

1. **Stop Worship Keys** öffnen.
2. Den bisherigen Ordner `Dokumente/Worship Keys` vorübergehend in
   `Worship Keys alt` umbenennen.
3. Die aktuelle Version erneut über **Code → Download ZIP** laden.
4. Entpackten Ordner wieder in `Worship Keys` umbenennen.
5. Den neuen Ordner nach **Dokumente** verschieben.
6. Darin **Worship Keys installieren.command** doppelklicken.
7. Start und Pads testen.
8. Erst danach den Ordner `Worship Keys alt` löschen.

Die lokal im Browser gespeicherte Setlist wird durch diesen Ordnertausch nicht
gelöscht. Trotzdem sollte die aktuelle Setlist vorher nach Google Drive
übertragen worden sein.

## Häufige Probleme

### „Node.js fehlt“

Der Assistent öffnet automatisch die offizielle Node.js-Seite. Dort LTS für
macOS installieren und danach **Worship Keys installieren.command** erneut
doppelklicken.

### „Die App kann nicht geöffnet werden“

Mit Rechtsklick auf die Datei oder App gehen und **Öffnen** wählen. Wenn nötig
unter **Systemeinstellungen → Datenschutz & Sicherheit** das Öffnen bestätigen.

### GitHub zeigt 404

Mit dem richtigen GitHub-Account anmelden und prüfen, ob dieser Zugriff auf das
private Repository erhalten hat.

### Die Church-App startet nach einem Update nicht

Der Ordner wurde wahrscheinlich verschoben oder umbenannt. Er muss wieder unter
`Dokumente/Worship Keys` liegen. Anschließend den Ein-Klick-Installer erneut
ausführen.

### Andere Geräte erreichen den QR-Code nicht

- Alle Geräte müssen im selben Router-/Access-Point-Netz sein.
- Gast-WLAN und Client-Isolation müssen deaktiviert sein.
- Eingehende Verbindungen für Node müssen in macOS erlaubt sein.
- Der QR muss eine private Adresse wie `192.168.x.x:3000` enthalten.

## Was du nicht brauchst

- keine Git-Befehle,
- kein GitHub Desktop,
- keine Programmierkenntnisse,
- kein Terminalwissen,
- während des Gottesdienstes kein Internet.

Langfristig wäre eine signierte und notarisierte `.dmg`-Datei über GitHub
Releases noch einfacher. Der ZIP-plus-Doppelklick-Weg ist für den aktuellen
Projektaufbau die einfachste sichere Variante, weil die Church-App weiterhin
auf die Pad-Dateien und den Build im Projektordner zugreift.

