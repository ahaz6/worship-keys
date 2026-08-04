# Worship Keys – Anleitung für den Offline-Church-Modus

Der Offline-Church-Modus betreibt Pad-Audio, MIDI, Nashville-Anzeige und alle
Join-Geräte vollständig auf dem Kirchen-Mac und im lokalen Gemeindenetz. Während
des Gottesdienstes werden weder Internet noch Vercel, Supabase oder Google Drive
benötigt.

Für die erstmalige Einrichtung auf einem neuen Mac ohne Git- oder
Terminalkenntnisse siehe [SETUP.md](SETUP.md).

Für einen dauerhaft gleichen lokalen Join-Einstieg über `10.10.1.2` siehe
[Worship Keys IP Setup Church.md](Worship%20Keys%20IP%20Setup%20Church.md).

## 1. Benötigte Geräte

- ein Mac mit Chrome und der installierten App **Worship Keys Church**,
- ein Router oder Netzwerk-Switch,
- bei einem Router ohne WLAN zusätzlich ein WLAN-Access-Point,
- Smartphones oder Tablets im selben lokalen Netzwerk,
- optional MIDI-Keyboard und Audiointerface.

Der Router benötigt keinen Internetanschluss. Er muss den Geräten lediglich
lokale IP-Adressen geben. Gast-WLAN und Client-Isolation müssen ausgeschaltet
sein, damit sich die Geräte gegenseitig erreichen können.

## 2. Einmalige Installation auf dem Mac

Im Projektordner ausführen:

```bash
npm run church:install
```

Dadurch werden folgende Komponenten eingerichtet:

- `/Applications/Worship Keys Church.app`,
- `/Applications/Stop Worship Keys.app`,
- der macOS-Hintergrunddienst
  `~/Library/LaunchAgents/app.worshipkeys.church.host.plist`,
- das Protokoll unter
  `~/Library/Logs/Worship Keys/church-host.log`.

Die App verwendet das originale Worship-Keys-Icon. Beim Doppelklick startet
macOS den lokalen Server im Hintergrund und öffnet `http://localhost:3000` im
Browser. Ein Terminalfenster ist dafür nicht erforderlich.

Nach größeren Aktualisierungen von Worship Keys den Installationsbefehl erneut
ausführen. Beide Apps liegen im allgemeinen macOS-Ordner **Programme**. Falls
dieser nicht direkt beschreibbar ist, zeigt macOS einmalig die normale
Administrator-Abfrage.

## 3. Setlist zu Hause vorbereiten

1. [Worship Keys Play](https://worship-keys-psi.vercel.app/play) auf dem Handy
   oder Computer öffnen.
2. Songs, Tonarten, Taktarten und Tempi vorbereiten.
3. **Google Drive** öffnen und **Deploy to Google Drive** wählen.
4. Auf dem Kirchen-Mac Worship Keys öffnen, solange Internet verfügbar ist.
5. **Open setlist from Drive** wählen.
6. Songanzahl und Reihenfolge prüfen.
7. Auf die Anzeige **Saved on this device** achten.

Google Drive enthält genau eine aktuelle Übergabedatei:
`Worship Keys Current.worship-keys.json`. Der Import wird mit Zod gegen das
aktuelle Setlist-Schema validiert. Nach dem Import liegt die Setlist in der
IndexedDB des Browsers und steht damit auch ohne Internet bereit.

## 4. Aufbau in der Gemeinde

1. Mac per Ethernet oder WLAN mit dem Kirchenrouter verbinden.
2. Bei einem Router ohne WLAN einen Access Point per Netzwerkkabel anschließen.
3. Smartphones und Tablets mit diesem WLAN verbinden.
4. Prüfen, dass alle Geräte im selben lokalen Netz sind.
5. Mac an Strom anschließen und Ruhezustand während des Gottesdienstes
   verhindern.

Ein Access Point stellt nur die Funkverbindung bereit. Der Router darf weiterhin
vollständig ohne Internet betrieben werden.

## 5. Worship Keys am Sonntag starten

1. Im Finder den allgemeinen Ordner **Programme** öffnen.
2. **Worship Keys Church** doppelklicken.
3. Beim ersten Start eingehende Netzwerkverbindungen für Node erlauben.
4. Im Bereich **Offline Church Mode** auf **Check all offline pads** klicken.
5. Warten, bis alle zwölf Tonarten geladen sind.
6. Erst bei **READY · INTERNET NOT REQUIRED** fortfahren.

Der Bereitschaftscheck kontrolliert:

- der lokale Host ist verbunden,
- eine private Router-IP wurde erkannt,
- die Setlist ist vorhanden und lokal gespeichert,
- alle zwölf Sound-Wall-Pads wurden erfolgreich dekodiert.

Die bevorzugte IP wird automatisch ermittelt. Physische Netzwerkadapter wie
Ethernet und WLAN werden gegenüber VPN-, Bridge- und virtuellen Interfaces
bevorzugt.

## 6. Musiker über die feste Join-Adresse verbinden

1. **Show local join QR** wählen.
2. Prüfen, dass die Adresse mit `192.168.`, `10.` oder `172.16–31.` beginnt.
3. Musiker scannen den QR-Code im selben WLAN.
4. Jedes Gerät vergibt beim ersten Beitritt einmalig einen Namen.
5. Viewer sehen Nashville, Akkord, Keyboard-Layer und Setlist.
6. Ein berechtigter Leader kann Songs, Tonarten, Pads, Fades und Crescendo
   fernsteuern.

Alternativ öffnen Musiker direkt die feste lokale Adresse `/join-app`. Der
laufende Church-Mac leitet sie automatisch in die aktuelle Viewer-Session. Ein
neues Gerät gibt einmal seinen Namen ein; ein bereits bekanntes und nicht
widerrufenes Gerät verbindet sich anschließend automatisch wieder.

So werden auf dem iPhone zwei feste Symbole angelegt:

1. Die lokale Main UI in Safari öffnen und **Teilen → Zum Home-Bildschirm**
   wählen. Dieses Symbol heißt **Worship Keys**.
2. Danach die lokale Adresse `/join-app` öffnen und dort erneut
   **Teilen → Zum Home-Bildschirm** wählen. Dieses Symbol heißt
   **Worship Join** und öffnet künftig direkt die laufende lokale Session.

Wichtig: Eine zuvor von `vercel.app` installierte Join-Webapp kann ohne Internet
nicht automatisch erraten, welche lokale IP der Kirchen-Mac bekommen hat. Für
den garantiert internetfreien Betrieb **Worship Join einmal aus der lokalen
Church-Adresse installieren** oder weiterhin den lokalen QR-Code verwenden.

Der lokale QR darf niemals auf `vercel.app` zeigen. Der direkte lokale Einstieg
berechtigt nur zum Viewer-Zugriff; Leader-Steuerung braucht weiterhin den
getrennten Leader-PIN. Audio wird nicht über das
Netzwerk übertragen: Es bleibt ausschließlich auf dem Host-Mac. Über das lokale
WebSocket werden nur kompakte Zustände und Steuerbefehle ausgetauscht.

## 7. Verhalten bei einem Netzwerkausfall

- Das Pad-Audio spielt auf dem Mac weiter.
- MIDI, Nashville und lokale Bedienung funktionieren weiter.
- Join-Geräte zeigen keine neuen Zustände, bis die Verbindung zurückkehrt.
- Nach Wiederherstellung verbindet sich die Join-Oberfläche erneut.
- Ein Internetausfall hat im Offline-Church-Modus keine Auswirkung.

## 8. Nach dem Gottesdienst

Das Schließen des Browsertabs beendet den lokalen Hintergrunddienst nicht. Ein
erneuter Doppelklick auf **Worship Keys Church** öffnet die laufende Oberfläche
wieder. Zum Beenden **Stop Worship Keys** im Programme-Ordner doppelklicken.
Die App beendet den Node-Prozess und gibt Port 3000 frei.

Alternativ kann der Dienst im Terminal beendet werden:

```bash
launchctl kill SIGTERM gui/$(id -u)/app.worshipkeys.church.host
```

## 9. Fehlerbehebung

### App wird nicht gefunden

Die beiden Apps liegen unter:

```text
/Applications/Worship Keys Church.app
/Applications/Stop Worship Keys.app
```

### App reagiert beim Öffnen nicht

Die aktuelle Installation verwendet einen macOS-LaunchAgent. Den Installer
erneut ausführen und danach die App neu öffnen:

```bash
npm run church:install
```

### Keine Router-IP

- Ethernet/WLAN prüfen,
- VPN vorübergehend deaktivieren,
- Church-App neu öffnen,
- bei mehreren Netzen notfalls `WK_LAN_IP` als erweiterten Startparameter
  verwenden.

### QR-Code ist auf anderen Geräten nicht erreichbar

- alle Geräte müssen im selben Netz sein,
- Gast-WLAN und Client-Isolation ausschalten,
- macOS-Firewall muss eingehende Verbindungen für Node erlauben,
- der QR muss eine private lokale IP und Port `3000` enthalten.

### Pads sind nicht bereit

- **Check all offline pads** erneut drücken,
- warten, bis `12/12` angezeigt wird,
- Audioausgang und Browserfreigabe prüfen,
- Browser-Konsole und Church-Host-Protokoll kontrollieren.

### App startet nicht

Das Protokoll öffnen:

```text
~/Library/Logs/Worship Keys/church-host.log
```

## 10. Sicherheitsregeln

- QR-Code und Leader-PIN nur mit dem Worship-Team teilen.
- Nach einem unerwünschten Zugriff den PIN erneuern oder das Gerät widerrufen.
- Host-Geheimnisse sind nur über Loopback auf dem Mac abrufbar.
- Viewer-Berechtigungen werden serverseitig durchgesetzt.
- Google-Servicekonto und private Schlüssel bleiben ausschließlich auf Vercel.
- Der Kirchen-Mac besitzt nur einen eingeschränkten Lesetoken für die
  Drive-Übergabe.
