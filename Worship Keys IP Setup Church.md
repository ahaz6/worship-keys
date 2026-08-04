# Worship Keys – feste Church-IP `10.10.1.2`

Diese Anleitung richtet Worship Keys im Gemeindenetz nach demselben Grundprinzip
wie eine Soundcraft-UI24R-Weboberfläche ein:

```text
Church-Router  10.10.1.1
├── MacBook     10.10.1.2:3000  → Worship Keys Church
└── iPhone/iPad                → Worship Join
```

Der Router stellt dabei nur das lokale Netzwerk und WLAN bereit. Das MacBook
führt **Worship Keys Church** aus und liefert die Main UI sowie die Join UI aus.
Eine Internetverbindung, Vercel, Supabase und Google Drive werden während des
Gottesdienstes nicht benötigt.

Die feste Join-Adresse lautet anschließend:

```text
http://10.10.1.2:3000/join-app
```

Ist der Router, das MacBook oder Worship Keys Church ausgeschaltet, ist diese
Adresse nicht erreichbar. Dieses Verhalten ist beabsichtigt und entspricht dem
UI24R-Prinzip.

## 1. Voraussetzungen

- das Church-MacBook mit installierter App **Worship Keys Church**,
- ein Router mit LAN und WLAN oder ein zusätzlicher WLAN-Access-Point,
- Zugriff auf die Router-Konfiguration,
- iPhones und iPads im gleichen lokalen Netzwerk,
- die fertige Offline-Installation nach [OFFLINE-CHURCH.md](OFFLINE-CHURCH.md).

Der Router muss auch ohne Internet eingeschaltet bleiben. Er muss DHCP und die
Kommunikation zwischen lokalen Geräten ermöglichen. Folgende Funktionen müssen
ausgeschaltet sein:

- Gastnetz-Isolation,
- Client Isolation,
- AP Isolation beziehungsweise Wireless Isolation.

## 2. Vorher einen IP-Konflikt ausschließen

Eine IP-Adresse darf in einem Netzwerk nur einem einzigen Gerät gehören.

Falls das Soundcraft UI24R weiterhin `10.10.1.2` benutzt und gleichzeitig mit
diesem Router verbunden wird, darf das MacBook **nicht ebenfalls**
`10.10.1.2` erhalten. In diesem Fall beispielsweise folgende Aufteilung nutzen:

```text
Router:          10.10.1.1
Soundcraft:      10.10.1.2
Worship-Keys-Mac 10.10.1.3
```

Die restliche Anleitung muss dann überall mit `10.10.1.3` statt `10.10.1.2`
ausgeführt werden.

Wenn das UI24R nicht mehr im gleichen Netz betrieben wird, kann das MacBook
`10.10.1.2` verwenden.

## 3. Router auf das Church-Netz einstellen

Die Bezeichnungen unterscheiden sich je nach Router. Gesucht werden meist die
Bereiche **LAN**, **Local Network**, **DHCP Server** oder **Address Reservation**.

Empfohlene Router-Konfiguration:

| Einstellung | Wert |
| --- | --- |
| Router-/Gateway-Adresse | `10.10.1.1` |
| Subnetzmaske | `255.255.255.0` beziehungsweise `/24` |
| DHCP | eingeschaltet |
| DHCP-Bereich | zum Beispiel `10.10.1.50` bis `10.10.1.200` |
| MacBook-Reservierung | `10.10.1.2` |
| Client-/AP-Isolation | ausgeschaltet |

Der automatische DHCP-Bereich beginnt hier erst bei `.50`. Dadurch liegt die
feste Mac-Adresse `.2` außerhalb des normalen Vergabebereichs und kann nicht
versehentlich an ein anderes Gerät vergeben werden.

### Empfohlen: DHCP-Reservierung im Router

1. MacBook per Ethernet mit dem Church-Router verbinden.
2. Router-Konfiguration öffnen.
3. In der Liste der verbundenen Geräte das MacBook suchen.
4. **IP reservieren**, **Static Lease** oder **Address Reservation** wählen.
5. Für die Ethernet-MAC-Adresse des MacBooks `10.10.1.2` reservieren.
6. Änderungen speichern und den Router gegebenenfalls neu starten.
7. Ethernet am Mac kurz trennen und erneut verbinden oder DHCP erneuern.

Die Reservierung sollte für den Anschluss erfolgen, der sonntags wirklich
verwendet wird. Ethernet und WLAN besitzen unterschiedliche MAC-Adressen.
Ethernet ist für den Host-Mac stabiler und daher vorzuziehen.

## 4. Alternative: IP direkt in macOS manuell eintragen

Diese Variante nur verwenden, wenn der Router keine DHCP-Reservierungen
unterstützt.

1. **Systemeinstellungen → Netzwerk** öffnen.
2. Den verwendeten Ethernet-Adapter auswählen.
3. **Details → TCP/IP** öffnen.
4. **IPv4 konfigurieren** auf **Manuell** stellen.
5. Folgende Werte eintragen:

   | Feld | Wert |
   | --- | --- |
   | IP-Adresse | `10.10.1.2` |
   | Subnetzmaske | `255.255.255.0` |
   | Router | `10.10.1.1` |

6. Änderungen übernehmen.
7. Sicherstellen, dass der DHCP-Server des Routers `10.10.1.2` nicht an ein
   anderes Gerät vergeben kann.

Für einen dauerhaft gleichen Church-Aufbau ist eine DHCP-Reservierung im
Router normalerweise wartungsärmer als eine manuell eingetragene macOS-IP.

## 5. Feste IP prüfen

Nach jedem Router-Neustart sollte das MacBook weiterhin `10.10.1.2` besitzen.

### Ohne Terminal

1. **Systemeinstellungen → Netzwerk** öffnen.
2. Den verbundenen Ethernet-Adapter wählen.
3. Prüfen, dass als IP-Adresse `10.10.1.2` angezeigt wird.

### Optional im Terminal

Zuerst die Netzwerkanschlüsse anzeigen:

```bash
networksetup -listallhardwareports
```

Danach die IP des dort genannten Geräts prüfen, beispielsweise:

```bash
ipconfig getifaddr en0
```

Die Ausgabe muss `10.10.1.2` sein. Je nach Mac und Adapter kann der Anschluss
statt `en0` auch `en1`, `en5` oder ähnlich heißen.

## 6. Worship Keys Church installieren oder aktualisieren

Im Projektordner ausführen:

```bash
npm run church:install
```

Dadurch werden im allgemeinen Programme-Ordner installiert:

```text
/Applications/Worship Keys Church.app
/Applications/Stop Worship Keys.app
```

Anschließend:

1. **Worship Keys Church** in Programme öffnen.
2. Bei der ersten macOS-Frage eingehende Netzwerkverbindungen für Node.js
   erlauben.
3. Warten, bis `http://localhost:3000` im Browser geöffnet wird.
4. **Check all offline pads** ausführen.
5. Erst bei **READY · INTERNET NOT REQUIRED** fortfahren.

Worship Keys lauscht bereits auf allen lokalen Netzwerkanschlüssen. Die feste
IP wird daher nicht durch Worship Keys erzeugt, sondern vom Router oder von
macOS zugewiesen.

## 7. Feste Join-Adresse testen

Auf einem iPhone oder iPad im Church-WLAN in Safari öffnen:

```text
http://10.10.1.2:3000/join-app
```

Wenn die Namenseingabe beziehungsweise die laufende Join UI erscheint, läuft
der lokale Host unter der richtigen Adresse. Die Host-Main-UI wird aus
Sicherheitsgründen weiterhin nur
auf dem Mac über `http://localhost:3000` bedient. `localhost` bezeichnet auf
jedem Gerät immer dieses Gerät selbst und ist daher auf dem iPhone nicht der
Church-Mac.

## 8. Lokale Worship-Join-App auf dem iPhone installieren

Die Join-App muss einmal aus der **lokalen Church-Adresse** installiert werden.
Eine von `vercel.app` installierte Webapp kann im internetfreien Netz nicht
automatisch wissen, unter welcher Adresse der Church-Mac erreichbar ist.

1. Router, MacBook und Worship Keys Church einschalten.
2. iPhone mit dem normalen Church-WLAN verbinden, nicht mit einem Gast-WLAN.
3. In Safari öffnen:

   ```text
   http://10.10.1.2:3000/join-app
   ```

4. In Safari auf **Teilen** drücken.
5. **Zum Home-Bildschirm** wählen.
6. Den vorgeschlagenen Namen **Worship Join** beibehalten.
7. Mit **Hinzufügen** bestätigen.

Das feste Symbol öffnet künftig direkt die aktive lokale Viewer-Session unter
`10.10.1.2`. Ein neues oder widerrufenes Gerät gibt seinen Namen ein. Ein
bereits bekanntes Gerät wird automatisch wiedererkannt. Ein sechsstelliger
Session-Code ist im Offline-Church-Modus nicht mehr erforderlich.

## 9. Einen Gottesdienst starten

1. Church-Router und gegebenenfalls WLAN-Access-Point einschalten.
2. MacBook per Ethernet verbinden und an Strom anschließen.
3. Prüfen, dass das MacBook `10.10.1.2` besitzt.
4. **Worship Keys Church** öffnen.
5. Pads, Setlist, MIDI und Audioausgang prüfen.
6. **Show local join QR** öffnen.
7. Prüfen, dass der Link mit `http://10.10.1.2:3000/` beginnt.
8. Musiker öffnen **Worship Join** und gelangen direkt zur Namenseingabe oder
   in die laufende Join UI.
10. Leader-Rechte nur über den getrennten Leader-PIN vergeben.

Audio wird nicht auf die Join-Geräte übertragen. Pad-Audio und MIDI laufen auf
dem Host-Mac; im Netzwerk werden nur Anzeigezustände und Steuerbefehle
übermittelt.

## 10. Worship Keys vollständig beenden

Das Schließen des Browserfensters beendet den lokalen Server nicht.

1. Programme öffnen.
2. **Stop Worship Keys** doppelklicken.
3. Danach darf `http://10.10.1.2:3000` nicht mehr erreichbar sein.

Beim nächsten Gottesdienst reicht es, **Worship Keys Church** erneut zu öffnen.

## 11. Funktionstest ohne Internet

Dieser Test sollte vor dem ersten Einsatz vollständig durchgeführt werden:

1. Internet- beziehungsweise WAN-Kabel am Church-Router abziehen.
2. Router, MacBook und Access Point eingeschaltet lassen.
3. Worship Keys Church starten.
4. Auf dem Mac die Host-Main-UI unter `http://localhost:3000` öffnen.
5. Auf einem iPhone **Worship Join** vom Home-Bildschirm öffnen.
6. Falls verlangt, den Gerätenamen eingeben.
7. Songwechsel, Nashville-Anzeige, Fade in, Fade out und Crescendo prüfen.
8. Router kurz ausschalten: Die Join-Verbindung muss abbrechen.
9. Router wieder einschalten und Geräte erneut verbinden.
10. Prüfen, dass die feste Adresse `10.10.1.2` wieder funktioniert.

Wenn dieser Ablauf funktioniert, ist das System unabhängig von Vercel,
Supabase, Google Drive und einer Internetverbindung einsatzbereit.

## 12. Fehlerbehebung

### `10.10.1.2` öffnet sich auf dem iPhone nicht

- Prüfen, ob das iPhone wirklich im Church-WLAN ist.
- Mobile Daten testweise deaktivieren.
- Gastnetz, Client Isolation und AP Isolation ausschalten.
- Worship Keys Church auf dem Mac starten.
- macOS-Firewallzugriff für Node.js erlauben.
- Prüfen, ob der Mac tatsächlich `10.10.1.2` besitzt.
- Immer den vollständigen Link mit `http://` und `:3000` verwenden.

### Der Mac hat plötzlich eine andere IP

- DHCP-Reservierung im Router prüfen.
- Kontrollieren, ob die Reservierung für die richtige Ethernet-MAC-Adresse
  angelegt wurde.
- Nicht zwischen Ethernet und WLAN wechseln, ohne beide getrennt zu
  konfigurieren.
- DHCP am Mac erneuern oder Router und Mac neu verbinden.

### Die Join UI öffnet sich nicht

- Sicherstellen, dass Worship Keys Church noch läuft.
- Prüfen, dass **Worship Join** über `10.10.1.2:3000/join-app` geöffnet wurde.
- Alte Safari-Tabs schließen und die Home-App erneut starten.

### Die IP ist belegt oder die Verbindung ist unzuverlässig

Ein anderes Gerät verwendet wahrscheinlich ebenfalls `10.10.1.2`. Dieses Gerät
vom Netz trennen und die Router-Geräteliste prüfen. Danach für Worship Keys eine
eindeutige reservierte IP verwenden. Soundcraft und Worship Keys dürfen niemals
dieselbe IP gleichzeitig besitzen.

### Worship Keys startet nicht

Das lokale Protokoll prüfen:

```text
~/Library/Logs/Worship Keys/church-host.log
```

Danach gegebenenfalls im Projektordner erneut installieren:

```bash
npm run church:install
```

## 13. Technische Hinweise

- Der lokale Server bindet an `0.0.0.0` und ist damit über alle aktiven
  Mac-Netzwerkschnittstellen erreichbar.
- Der Standard-Port ist `3000`.
- `WK_LAN_IP=10.10.1.2` kann Worship Keys anweisen, diese bereits vorhandene
  Adresse bevorzugt in QR-Code und Join-Link anzuzeigen. Diese Einstellung
  weist dem Mac jedoch keine IP zu.
- Ohne zusätzlichen lokalen Reverse Proxy bleibt `:3000` Bestandteil der URL.
- Die lokale Home-App ist eine feste Webapp-Verknüpfung zum Church-Mac, keine
  eigenständig laufende Audio-App. Genau deshalb ist sie bei ausgeschaltetem
  Router oder Host nicht erreichbar.
- Der direkte lokale Einstieg erlaubt nur den Viewer-Zugriff. Leader-Steuerung
  bleibt durch den separaten Leader-PIN geschützt.

## 14. Geplante Trennung: Host, Remote Management und Musiker

Für Worship Keys sind drei klar getrennte Rollen sinnvoll:

| Rolle | Gerät und Aufgabe | Empfohlener Zugang |
| --- | --- | --- |
| Host UI | MacBook Air M4 am SQ-Rack, MIDI, Audio und Pads | nur `http://localhost:3000` |
| Host Remote Management | autorisiertes iPad oder Handy zur vollständigen Fernsteuerung | eigener geschützter Management-Einstieg auf `10.10.1.2:3000` |
| Musiker-Viewer | persönliche Geräte für Nashville, Akkorde, Keyboard-Layer und Setlist | eigener Viewer-Einstieg auf `10.10.1.2:3000` |

### Warum dafür normalerweise keine drei IP-Adressen nötig sind

Die drei Rollen müssen sicher und sichtbar getrennt werden, benötigen aber
nicht jeweils eine eigene IP. Alle Oberflächen gehören zum selben laufenden
Worship-Keys-Prozess auf dem MacBook. Drei IP-Adressen würden zusätzliche
Netzwerkadapter, virtuelle Interfaces, Router-Regeln oder VLANs erfordern und
den Sonntagsaufbau unnötig fehleranfällig machen.

Einfacher und stabiler ist:

```text
MacBook / Worship Keys Church
├── localhost:3000           → Host UI, ausschließlich direkt am Mac
├── 10.10.1.2:3000/manage    → Remote Management, stark geschützt
└── 10.10.1.2:3000/join-app  → direkter Musiker-Viewer-Einstieg
```

`/manage` ist hier der geplante, noch zu implementierende Einstieg. Die genaue
Route kann bei der Umsetzung anders benannt werden.

Damit bleiben trotzdem drei eigenständige Home-Bildschirm-Apps möglich:

- **Worship Keys Host** auf dem MacBook,
- **Worship Keys Remote** auf ausgewählten iPads und Handys,
- **Worship Join** auf den Geräten der Musiker.

### Vorgesehene Berechtigungen

Die **Host UI** bleibt die einzige Oberfläche, die direkt Audio, MIDI,
Audioausgänge, Offline-Pads und grundlegende Session-Sicherheit verwaltet.

Die geplante **Remote-Management-UI** soll unabhängig vom allgemeinen
Viewer-Code geöffnet werden. Sie darf nach starker Anmeldung alle für den
Livebetrieb benötigten Aktionen ausführen, zum Beispiel:

- Songs und Tonarten wechseln,
- Setlist bearbeiten,
- Fade in, Fade out und Crescendo steuern,
- Pad-Lautstärke, Tempo und Sound-Flächen bedienen,
- Geräte und Leader-Zugriffe verwalten.

Der **Musiker-Viewer** erhält nur Leserechte für:

- Nashville Numbers,
- aktuellen Akkord und Keyboard-Layer,
- aktuellen, vorherigen und nächsten Song,
- Tonart, Tempo und Taktart.

Der direkte Musiker-Einstieg darf niemals automatisch
Remote-Management-Rechte vergeben.

### Sicherheitsvorschlag für die Remote-Management-UI

Der bisherige Leader-PIN ist für kurzfristige Freigaben geeignet. Für eine
dauerhaft installierte Remote-App sollte zusätzlich ein getrenntes, widerrufbares
Management-Gerätetoken verwendet werden:

1. Neues iPad oder Handy wird einmal direkt an der Host UI gekoppelt.
2. Der Mac zeigt einen kurzlebigen Management-Code oder QR-Code.
3. Nach Bestätigung speichert das Remote-Gerät ein eigenes zufälliges Token.
4. Der Host kann jedes Remote-Gerät einzeln benennen und widerrufen.
5. Musiker-Viewer und ihr direkter lokaler Einstieg bleiben davon vollständig
   getrennt.

So kann ein festes Kirchen-iPad dauerhaft als **Worship Keys Remote** verwendet
werden, ohne den allgemeinen Join-Link oder den Leader-PIN bei jedem Start zu
teilen.

### Wann drei IP-Adressen doch sinnvoll wären

Drei IPs wären erst dann sinnvoll, wenn die Rollen auch netzwerktechnisch über
getrennte VLANs oder WLANs isoliert werden sollen, beispielsweise:

- Technik-VLAN für SQ-Rack und Host,
- geschütztes Leader-WLAN für Remote Management,
- Musiker-WLAN mit eingeschränktem Zugriff.

Das ist eine mögliche spätere Profi-Ausbaustufe. Dafür müssten Router,
Access Point und Firewall VLANs unterstützen. Für den aktuellen Church-Aufbau
ist eine feste Host-IP mit getrennten URLs, Tokens und Rollen einfacher,
zuverlässiger und sicher genug.

### Offene Punkte für die nächste Umsetzung

- eigenständige Route und PWA **Worship Keys Remote** festlegen,
- Remote Management vollständig vom Viewer-/Join-Code trennen,
- einmaliges Pairing und widerrufbare Gerätetokens entwickeln,
- genaue Rechte-Matrix zwischen Host, Remote Manager und Viewer definieren,
- Verhalten bei Verbindungsabbruch und Wiederverbindung testen,
- prüfen, ob später getrennte WLANs oder VLANs benötigt werden.
