# Worship Keys auf einem neuen Mac oder Windows-PC installieren

Diese Anleitung ist für Menschen ohne Git-, Terminal- oder
Programmierkenntnisse geschrieben. Der Installationsassistent lädt Node.js LTS,
meldet dich sicher bei GitHub an, lädt die aktuelle `main`-Version von Worship
Keys und richtet Start sowie Stopp ein.

## Was du brauchst

- Internet während der einmaligen Installation,
- ein Administratorkonto auf dem Computer,
- einen GitHub-Account mit Zugriff auf das private Repository
  `ahaz6/worship-keys`,
- ungefähr 10 GB freien Speicher,
- Google Chrome,
- macOS 13 oder neuer beziehungsweise ein aktuelles Windows 10/11.

Nach der Einrichtung kann der Offline-Church-Modus ohne Internet verwendet
werden.

## Warum GitHub einmal nach einer Anmeldung fragt

Worship Keys liegt in einem privaten Repository. Deshalb enthält kein Installer
ein fest eingebautes Passwort oder Zugriffstoken. Beim ersten Lauf öffnet der
offizielle GitHub-Anmeldeablauf den Browser. Nach erfolgreicher Anmeldung darf
der Assistent ausschließlich mit den Rechten deines GitHub-Kontos laden.

Zeigt GitHub `404` oder „Page not found“, ist entweder der falsche Account
angemeldet oder der Account wurde noch nicht für `ahaz6/worship-keys`
freigeschaltet.

---

## Installation auf einem MacBook

### 1. Die Installerdatei auf den Mac bringen

Du benötigst nur diese Datei:

```text
Worship Keys installieren.command
```

Sie kann dir zum Beispiel per AirDrop, USB-Stick oder als separates
Installationspaket gegeben werden. Lege sie in **Downloads**. Wenn du bereits
den vollständigen GitHub-ZIP-Ordner besitzt, kannst du dieselbe Datei direkt in
diesem Ordner starten; der Assistent erkennt beide Varianten.

### 2. Den Installer öffnen

1. Finder öffnen und **Downloads** wählen.
2. Mit der rechten Maustaste auf **Worship Keys installieren.command** klicken.
3. **Öffnen** wählen.
4. Falls macOS erneut warnt, nochmals **Öffnen** wählen.
5. Bei Bedarf das Administratorpasswort des Macs eingeben.
6. Wenn GitHub den Browser öffnet, mit dem freigeschalteten GitHub-Konto
   anmelden und den Zugriff bestätigen.
7. Warten, bis **INSTALLATION ERFOLGREICH** erscheint.

Der Assistent erledigt selbstständig:

- Ermittlung und Installation der aktuellen offiziellen Node.js-LTS-Version,
- temporäre Einrichtung des offiziellen GitHub-Anmeldeprogramms,
- Download der aktuellen `main`-Version des privaten Repositorys,
- Erstellung von `Dokumente/Worship Keys`,
- Sicherung einer alten Installation als `Worship Keys Backup …`,
- Installation aller JavaScript-Bestandteile,
- Erstellung des Produktions-Builds,
- Installation von **Worship Keys Church** unter `/Programme`,
- Installation von **Stop Worship Keys** unter `/Programme`.

### 3. Worship Keys öffnen

1. Finder öffnen.
2. Links **Programme** wählen.
3. **Worship Keys Church** doppelklicken.
4. Bei der macOS-Frage zu eingehenden Netzwerkverbindungen **Erlauben**
   wählen.
5. Chrome öffnet `http://localhost:3000`.
6. **Enable audio** beziehungsweise **Check all offline pads** wählen.
7. Warten, bis alle zwölf Pads bereit sind.

Zum Beenden **Stop Worship Keys** im Programme-Ordner öffnen. Das bloße
Schließen des Browser-Tabs beendet den lokalen Server nicht.

---

## Installation auf einem Windows-PC

### 1. Die beiden Installerdateien auf den PC bringen

Unter Windows gehören diese beiden Dateien immer zusammen in denselben Ordner:

```text
Worship Keys Windows installieren.cmd
Worship Keys Windows installieren.ps1
```

Lege beide Dateien beispielsweise in **Downloads**. Sie können dir als
gemeinsame ZIP-Datei, über einen USB-Stick oder über einen privaten Download
gegeben werden. Nach dem Entpacken dürfen die Dateien nicht voneinander getrennt
werden.

### 2. Den Windows-Installer öffnen

1. **Worship Keys Windows installieren.cmd** doppelklicken.
2. Wenn Windows SmartScreen warnt: **Weitere Informationen** und anschließend
   **Trotzdem ausführen** wählen.
3. Eine eventuelle Administratorabfrage bestätigen.
4. Wenn GitHub den Browser öffnet, mit dem freigeschalteten Account anmelden.
5. Warten, bis **INSTALLATION ERFOLGREICH** erscheint.

Der Windows-Assistent verwendet den offiziellen Windows-Paketmanager `winget`
und erledigt automatisch:

- Installation der aktuellen Node.js-LTS-Version,
- Installation des offiziellen GitHub-Anmeldeprogramms,
- sicheren Download der aktuellen privaten `main`-Version,
- Erstellung von `Dokumente\Worship Keys`,
- Sicherung einer alten Installation als `Worship Keys Backup …`,
- Installation und Produktions-Build,
- Verknüpfung **Worship Keys Church** auf Desktop und im Startmenü,
- Verknüpfung **Stop Worship Keys** auf Desktop und im Startmenü.

Fehlt `winget`, installiere im Microsoft Store einmal die Microsoft-App
**App Installer** und starte danach den Worship-Keys-Installer erneut.

### 3. Worship Keys unter Windows öffnen

1. Auf dem Desktop **Worship Keys Church** doppelklicken.
2. Eine eventuelle Windows-Firewall-Frage für das private Netzwerk erlauben.
3. Chrome öffnet `http://localhost:3000`.
4. Audio, MIDI und Offline-Pads freigeben beziehungsweise prüfen.
5. Zum vollständigen Beenden **Stop Worship Keys** doppelklicken.

## Google Chrome installieren

Chrome sollte auf beiden Plattformen installiert sein, weil Worship Keys die
Web-MIDI-Schnittstelle nutzt:

1. [google.com/chrome](https://www.google.com/chrome/) öffnen.
2. **Chrome herunterladen** wählen.
3. Den normalen Chrome-Installer ausführen.
4. Chrome anschließend einmal öffnen.

## Setlist vor dem Gottesdienst übertragen

Solange Internet verfügbar ist:

1. [worship-keys-psi.vercel.app/play](https://worship-keys-psi.vercel.app/play)
   öffnen.
2. **Google Drive** beziehungsweise **Open setlist from Drive** wählen.
3. Mit dem für Worship Keys freigeschalteten Konto anmelden.
4. Die aktuelle Setlist öffnen.
5. Songanzahl und Reihenfolge prüfen.
6. Auf **Saved on this device** achten.

Danach liegt die Setlist lokal im jeweiligen Chrome-Profil und steht im
Offline-Church-Modus ohne Internet zur Verfügung.

## Vor dem ersten Sonntag testen

1. Worship Keys Church starten.
2. MIDI-Keyboard verbinden und in Chrome freigeben.
3. Audioausgang auswählen.
4. **Check all offline pads** drücken.
5. Auf **READY · INTERNET NOT REQUIRED** warten.
6. **Show local join QR** öffnen.
7. QR mit einem zweiten Gerät im selben Netzwerk testen.
8. Worship Keys über die jeweilige Stop-App beenden.
9. Prüfen, dass `http://localhost:3000` nicht mehr erreichbar ist.

## Später aktualisieren

1. Worship Keys mit **Stop Worship Keys** beenden.
2. Den passenden Installationsassistenten erneut starten.
3. Bei GitHub nur dann erneut anmelden, wenn die gespeicherte Anmeldung nicht
   mehr gültig ist.
4. Der Assistent sichert den bisherigen Projektordner automatisch und lädt
   `main` neu.
5. Worship Keys starten und Pads, MIDI sowie Join-QR kurz prüfen.
6. Erst nach erfolgreichem Test kann der datierte Backup-Ordner gelöscht
   werden.

Wenn der Installer aus dem bereits vollständigen Projektordner gestartet wird,
installiert er genau diesen Stand. Für ein garantiertes Update auf die neueste
`main`-Version sollte die einzelne macOS-Datei beziehungsweise das
Windows-Installerpaar verwendet werden.

## Häufige Probleme

### GitHub zeigt 404 oder verweigert den Download

Mit dem richtigen GitHub-Account anmelden und prüfen, ob der Account Zugriff
auf `ahaz6/worship-keys` besitzt. Im Installer selbst wird absichtlich kein
geheimes Zugriffstoken gespeichert.

### macOS blockiert die `.command`-Datei

Nicht normal doppelklicken, sondern **Rechtsklick → Öffnen → Öffnen**. Wenn
nötig unter **Systemeinstellungen → Datenschutz & Sicherheit** bestätigen.

### Windows findet `winget` nicht

Im Microsoft Store **App Installer** von Microsoft installieren, Windows einmal
neu starten und den Installer erneut öffnen.

### Die App startet nach dem Verschieben des Ordners nicht

Der Projektordner muss unter `Dokumente/Worship Keys` bleiben. Den passenden
Installer erneut ausführen, um die Startverknüpfungen auf den korrekten Pfad zu
setzen.

### Andere Geräte erreichen den Join-QR nicht

- Alle Geräte müssen mit demselben Router oder Access Point verbunden sein.
- Gastnetz und Client-Isolation müssen deaktiviert sein.
- Eingehende Verbindungen für Node.js müssen im privaten Netzwerk erlaubt sein.
- Der QR muss eine private Adresse wie `192.168.x.x:3000`, `10.x.x.x:3000` oder
  `172.16–31.x.x:3000` enthalten.

## Sicherheit und technische Grenzen

- Die GitHub-Anmeldung erfolgt über das offizielle GitHub-CLI-Browserverfahren.
- Kein GitHub-Passwort und kein Token ist im Installer hinterlegt.
- Vorhandene Projektordner werden datiert gesichert und nicht still gelöscht.
- Die macOS-Apps sind lokal ad-hoc-signiert, aber noch nicht Apple-notarisiert.
- Die Windows-Skripte sind noch nicht mit einem kommerziellen Code-Signing-
  Zertifikat signiert. Deshalb kann SmartScreen beim ersten Öffnen warnen.

Eine später signierte und notarisierte macOS-DMG sowie ein signierter
Windows-MSIX/MSI wären für eine öffentliche Verteilung noch komfortabler. Für
das private Team ist der aktuelle Assistent bereits ohne Git- oder
Terminalkenntnisse nutzbar.
