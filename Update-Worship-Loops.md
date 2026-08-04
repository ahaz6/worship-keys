# Update Worship Loops – Umsetzungsplan für Design, Persistenz und Vercel

Stand: 4. August 2026
Zielprojekt: `/Users/ahazsubramaniyam/Documents/Codes/Worship Loops`
Repository: `ahaz6/worship-loops`

Dieses Dokument ist die ausführbare Übergabe für den nächsten Arbeitsblock im
Worship-Loops-Projekt. Es beschreibt, wie Worship Loops die visuelle Sprache von
Worship Keys übernimmt, als dauerhaft erreichbare Webapp auf Vercel läuft und
die persönliche Song-/Übungsliste auf jedem verwendeten Gerät zuverlässig
wiederherstellt.

Vor der Umsetzung vollständig lesen:

1. `Worship Loops/HANDOFF.md`
2. `Worship Loops/app/worship-loops-app.tsx`
3. `Worship Loops/app/globals.css`
4. `Worship Keys/Design-Art.md`
5. diese Datei

## 1. Zielbild

Worship Loops soll künftig drei Dinge gleichzeitig leisten:

1. **Vercel-Webapp:** Die Oberfläche ist über eine feste HTTPS-Adresse
   erreichbar und installierbar.
2. **Dauerhafte persönliche Library:** Songs, Abschnitte, Loop Actions,
   Metronomdaten und der letzte Arbeitsstand überleben Reload und Neustart.
3. **Lokale Medienleistung:** YouTube-Import, FFmpeg, Beat-Analyse und Demucs
   dürfen weiterhin auf einem lokalen Companion laufen, weil diese Prozesse
   nicht zuverlässig in Vercel Functions gehören.

Empfohlene Architektur:

```text
Vercel HTTPS Webapp
├── Worship-Loops-UI und PWA-Shell
├── Supabase Auth + nutzerbezogene Metadaten
└── IndexedDB-Cache auf jedem Gerät

Lokaler Media Companion (optional, leistungsstarker Computer)
├── yt-dlp / FFmpeg
├── Beat- und Downbeat-Analyse
├── Demucs Stem Separation
└── lokale Audio-/Stem-Dateien
```

Die Webapp muss auch ohne laufenden Companion Library, Songdetails, Lyrics,
Abschnitte und gespeicherte Loop Actions anzeigen können. Medienaktionen, die
lokale Dateien benötigen, zeigen dann ehrlich `Media available on another
device` oder `Local media service offline`.

## 2. Harte technische Grenze

Die bestehende `local-api` darf nicht unverändert in Vercel Functions kopiert
werden. Folgende Bestandteile benötigen lokale Binaries, große Modelle, lange
Laufzeiten oder Range-fähigen Dateizugriff:

- `yt-dlp`,
- FFmpeg,
- Python/beat-this/librosa,
- Demucs,
- große MP3-/FLAC-Dateien,
- lang laufende Separationjobs.

Vercel hostet zunächst UI, Auth und kleine Metadaten-Endpunkte. Audioquellen aus
YouTube oder getrennte Stems werden aus rechtlichen, technischen und
Speichergründen standardmäßig **nicht** in Supabase oder Vercel hochgeladen.

## 3. Verbindliche Produktentscheidungen

- Die sichtbare UI bleibt vollständig Englisch.
- Schwarz bleibt dominant; Violett und Blau zeigen Fokus und musikalischen
  Zustand.
- Die aktuelle Library wird zuerst lokal gespeichert und danach optional in
  das persönliche Cloudkonto synchronisiert.
- Jede Änderung wird automatisch gespeichert. Ein Gottesdienst-/Practice-Tool
  darf nicht von einem vergessenen Save-Button abhängen.
- Cloudsync umfasst Metadaten und Bearbeitungen, nicht automatisch
  urheberrechtlich geschützte Audiodateien.
- Ohne Anmeldung funktioniert eine lokale Library weiter. Nach Anmeldung wird
  sie einem Benutzerkonto zugeordnet und zwischen Geräten synchronisiert.
- Konflikte werden nicht still überschrieben. Datensätze tragen
  `updatedAt`, `revision` und `deviceId`; bei konkurrierenden Änderungen wird
  entweder feldweise zusammengeführt oder eine sichtbare Konfliktkopie erzeugt.

## 4. Designübernahme von Worship Keys

### 4.1 Farb-Tokens

In `Worship Loops/app/globals.css` folgende Werte als verbindliche Basis nutzen:

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

  --wl-radius-control: 9px;
  --wl-radius-card: 14px;
  --wl-radius-modal: 20px;
  --wl-motion: 170ms;
  --wl-ease: cubic-bezier(0.32, 0.72, 0.35, 1);
}
```

### 4.2 Hintergrund und Flächen

```css
body {
  background:
    radial-gradient(ellipse at 52% 0%, #282348 0, transparent 28%),
    radial-gradient(ellipse at 78% 45%, #151b2d 0, transparent 30%),
    linear-gradient(145deg, #090a0d 0%, #111116 52%, #0a0a0e 100%);
}
```

- Rails verwenden dunkle halbtransparente Flächen und 1-px-Trennlinien.
- Keine hellen Vollflächen, starken Neonrahmen oder konkurrierenden Glows.
- Ein Glow ist nur bei aktivem Song, Loop, Solo, Aufnahmezustand oder Fokus
  erlaubt.
- Geist Sans für UI, Geist Mono für BPM, Zeiten, Takte und technische Werte.

### 4.3 Informationshierarchie

- Aktiver Songtitel: eigene helle Zeile, nicht zusammen mit kleinen Metadaten.
- Künstler, BPM, Takt und Quelle: kleinere sekundäre Zeile.
- `Add song` bleibt die stärkste Library-Aktion.
- Play/Pause bleibt die stärkste Performance-Aktion.
- Loop A/B, Metronom und Stem Mixer bleiben direkt erreichbar, dürfen den
  Songtitel und Transport aber nicht visuell überholen.
- Lade-, Analyse- und Separationzustände brauchen Text plus Fortschritt; Farbe
  allein reicht nicht.

### 4.4 Mobile UI

Nur Telefonbreiten bis ungefähr 600 px erhalten die kompakte Oberfläche:

- Songtitel, Play/Pause, ±10 Sekunden, Loop und Metronom zuerst,
- Songliste als Drawer oder Fullscreen-Sheet,
- mindestens 44 × 44 px Touchflächen,
- Stem Mixer und Abschnittseditor in einklappbaren Bereichen,
- keine dreispaltige Desktop-Shell auf Hochkanttelefonen,
- iPad und Desktop behalten die etablierte größere Arbeitsfläche.

## 5. Vercel-Kompatibilität herstellen

Worship Loops verwendet derzeit Vinext-/Cloudflare-Buildskripte. Für das
gewünschte Vercel-Deployment wird das Webfrontend auf den normalen Next.js App
Router zurückgeführt. Die lokale Medien-API bleibt ein separater Prozess.

### 5.1 `package.json`

Zielskripte:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:media": "node local-api/server.mjs",
    "dev:all": "node scripts/dev-all.mjs",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test:unit": "node --test tests/*.test.mjs",
    "verify": "npm run typecheck && npm run lint && npm run test:unit && npm run build"
  }
}
```

Bei der Migration prüfen und anschließend entfernen, falls nicht mehr benötigt:

- `vinext`,
- `wrangler`,
- `@cloudflare/vite-plugin`,
- `@vitejs/plugin-rsc`,
- Cloudflare-spezifische Konfiguration.

Nicht blind löschen: Erst `next build` erfolgreich machen und danach tote
Abhängigkeiten entfernen.

### 5.2 Next.js-Struktur

- `app/layout.tsx` behält Geist, Metadaten und Icon.
- `app/page.tsx` bleibt Einstieg der Performance-App.
- Browserabhängige Audio-/IndexedDB-Komponenten erhalten `"use client"`.
- Keine Node-Binaries aus `local-api` in Client- oder Vercel-Bundles importieren.
- Server-only Secrets niemals mit `NEXT_PUBLIC_` versehen.

### 5.3 Vercel-Projekt

1. Repository `ahaz6/worship-loops` mit Vercel verbinden.
2. Framework Preset **Next.js** wählen.
3. Root Directory auf Repositorywurzel lassen.
4. Build Command `npm run build`.
5. Node-Version passend zu `>=22.13.0` setzen.
6. Preview-Deployment erstellen und vollständig prüfen.
7. Erst danach Production deployen.
8. Stabile Production-URL in `README.md` und `HANDOFF.md` dokumentieren.

## 6. Lokale dauerhafte Songbibliothek

Der aktuelle React-Speicher muss durch ein Repository hinter einer klaren
Schnittstelle ersetzt werden.

### 6.1 Neue Module

Empfohlene Struktur:

```text
lib/storage/schema.ts
lib/storage/migrations.ts
lib/storage/library-repository.ts
lib/storage/indexeddb-library-repository.ts
lib/storage/in-memory-library-repository.ts
lib/storage/cloud-sync.ts
lib/storage/conflict-resolution.ts
```

### 6.2 Persistierter Zustand

Mindestens speichern:

- Libraryname und Sortierreihenfolge,
- aktiver Song,
- Titel, Künstler, Dauer und Quelle,
- stabile lokale Media-ID statt vergänglicher Blob-URL,
- Wiedergabeposition,
- Geschwindigkeit,
- BPM, Taktart und Beat-/Downbeat-Raster-Version,
- manuelle Takt-1-Kalibrierung,
- Songabschnitte und Lyrics,
- A/B-Loop und Loop-Aktivität,
- benannte Actions,
- Metronomstatus und Click-Lautstärke,
- Stemstatus, Stem-Mixerpegel, Mute und Solo,
- Analysequelle und Confidence,
- `createdAt`, `updatedAt`, `revision`, `deviceId`, `schemaVersion`.

Nicht persistieren:

- laufende `AudioContext`- oder `AudioNode`-Objekte,
- Objekt-URLs (`blob:`),
- Timer und React-Refs,
- geheime Tokens,
- große AudioBuffer im normalen JSON-Datensatz.

### 6.3 Speicherablauf

1. Beim Start IndexedDB öffnen und Schema migrieren.
2. Library anzeigen, sobald der lokale Cache geladen ist; Cloudsync darf den
   ersten Render nicht blockieren.
3. Änderungen maximal 300–600 ms debouncen.
4. Kritische Aktionen wie Songimport, Löschen und Kalibrierung zusätzlich
   sofort speichern.
5. Beim Tab-Wechsel/`visibilitychange` ausstehende Änderungen flushen.
6. Fehler sichtbar melden und ungespeicherte Änderungen nicht als gespeichert
   darstellen.

### 6.4 Lokale Medien wiederfinden

Die `local-api` benötigt ein dauerhaftes Manifest, zum Beispiel
`storage/library.json` oder SQLite. Jeder Import erhält eine stabile `mediaId`.
Beim Neustart scannt die API vorhandene Imports und Stems und stellt sie wieder
unter stabilen Endpunkten bereit:

```text
GET /library
GET /media/:mediaId
GET /stems/:mediaId/:stem
```

Die Webapp speichert nur `mediaId` und Verfügbarkeitsstatus. Sie darf nicht
voraussetzen, dass eine alte temporäre URL nach einem Neustart noch gilt.

## 7. Benutzerkonto und geräteübergreifender Sync

Empfehlung: Supabase Auth + Postgres mit Row Level Security. Ein separates
Worship-Loops-Projekt oder klar getrennte Tabellen/Policies verwenden.

### 7.1 Tabellenentwurf

```text
libraries
- id uuid primary key
- user_id uuid not null
- name text not null
- active_song_id uuid null
- revision bigint not null
- created_at timestamptz
- updated_at timestamptz

songs
- id uuid primary key
- library_id uuid not null
- user_id uuid not null
- position integer not null
- title text not null
- artist text null
- duration_seconds numeric null
- source_metadata jsonb not null
- practice_state jsonb not null
- media_descriptor jsonb not null
- revision bigint not null
- created_at timestamptz
- updated_at timestamptz

song_sections
- id uuid primary key
- song_id uuid not null
- user_id uuid not null
- position integer not null
- type text not null
- label text not null
- start_seconds numeric not null
- end_seconds numeric not null
- lyrics text null
- revision bigint not null
- updated_at timestamptz

loop_actions
- id uuid primary key
- song_id uuid not null
- user_id uuid not null
- position integer not null
- name text not null
- start_seconds numeric not null
- end_seconds numeric not null
- revision bigint not null
- updated_at timestamptz
```

### 7.2 Sicherheitsregeln

- RLS auf jeder nutzerbezogenen Tabelle aktivieren.
- Jede Policy prüft `auth.uid() = user_id`.
- Fremde Library-IDs dürfen keine Daten offenlegen.
- Service-Role-Key ausschließlich serverseitig, niemals im Browser.
- Browser verwendet nur URL und anon/publishable key.
- Google OAuth ist für komfortable Anmeldung vorzuziehen; E-Mail-Anmeldung erst
  mit sauber konfiguriertem SMTP breit freigeben.

### 7.3 Syncverhalten

- Lokale Änderungen werden zuerst in IndexedDB committed.
- Bei Internet werden ausstehende Mutationen in Reihenfolge hochgeladen.
- Cloudänderungen werden heruntergeladen und in denselben lokalen Cache
  geschrieben.
- `updatedAt` allein reicht nicht für Konflikte; `revision` und ursprüngliche
  Basisrevision mitsenden.
- Songreihenfolge als explizites `position`-Feld oder geordnetes ID-Array
  speichern.
- Löschen als Tombstone synchronisieren, bis alle Geräte es gesehen haben.
- Syncstatus sichtbar machen: `Saved locally`, `Syncing`, `Synced`,
  `Conflict`, `Offline`.

## 8. Lokaler Media Companion

Der Companion bleibt optional. Ohne ihn startet die Vercel-App normal und zeigt
die Library; nur Import/Analyse/Stems sind nicht verfügbar.

### 8.1 Verbindung

- Standardadresse `http://127.0.0.1:8787`.
- Health-Check beim Öffnen und anschließend mit ruhigem Intervall.
- CORS nur für `http://localhost:3000`, Vercel-Preview-Domains und die feste
  Production-Origin erlauben; keine pauschale `*`-Freigabe für mutierende
  Endpunkte.
- Private-Network-/Mixed-Content-Verhalten in Chrome und Safari real testen.
- Wenn Browserzugriff auf Loopback blockiert ist, einen lokalen Worship-Loops-
  Launcher bereitstellen, der Web- und Media-Prozess unter derselben lokalen
  Origin ausliefert. Keine falsche Behauptung, Vercel könne lokale Binaries
  remote ausführen.

### 8.2 UI-Zustände

- `Local media service connected`
- `Local media service offline`
- `Media available on this device`
- `Metadata synced · audio not on this device`
- `Reconnect media service`

Ein Cloudgerät ohne lokale Datei darf den Song nicht als defekt markieren. Es
besitzt lediglich nicht dieselbe Medienkopie.

## 9. PWA und Offline-Verhalten

- Eigenes `manifest.webmanifest` mit stabiler ID `/worship-loops`.
- Originales Worship-Loops-Icon für `icon.png`, `apple-icon.png` und PWA-Icons.
- `display: standalone`, passende Theme-/Background-Farben.
- App-Shell, Fonts und statische Icons per Service Worker cachen.
- Librarydaten stammen offline aus IndexedDB.
- Keine pauschale Cache-first-Strategie für API-, Auth- oder große Audiodaten.
- Nach einem Deployment alte Shell-Caches versioniert ersetzen.
- Offline-Banner nur zeigen, wenn es eine konkrete Auswirkung gibt.

Abnahme: Nach einem erfolgreichen Onlinebesuch muss ein Reload ohne Internet
mindestens App-Shell, persönliche Songliste und gespeicherte Übungsdaten öffnen.
Audio funktioniert offline nur, wenn es auf diesem Gerät beziehungsweise im
laufenden Companion vorhanden ist.

## 10. Empfohlene Implementierungsphasen

### Phase 1 – Sicherheitsnetz

- aktuellen Stand committen,
- bestehende 28 Tests grün halten,
- Zod-Schema und Migrationsstrategie definieren,
- keine UI-Überarbeitung vor funktionierender Persistenz beginnen.

### Phase 2 – IndexedDB

- Repository-Schnittstelle implementieren,
- aktuellen React-Libraryzustand migrieren,
- Autosave und Reload-Wiederherstellung,
- stabile Media-IDs einführen,
- Fehler- und Speicherstatus anzeigen.

### Phase 3 – Next.js/Vercel

- Vinext-/Cloudflare-Abhängigkeit entkoppeln,
- normalen Next-Build herstellen,
- Preview auf Vercel deployen,
- lokale API als optional behandeln,
- keine Medienfunktionen vortäuschen, wenn Companion fehlt.

### Phase 4 – Worship-Suite-Design

- Tokens und Hintergründe angleichen,
- Songtitel-/Metadatenhierarchie überarbeiten,
- Controls und Fokuszustände vereinheitlichen,
- dedizierte Telefonansicht bauen,
- Screenshots bei 390 px, 820 px, 1024 px und 1440 px prüfen.

### Phase 5 – Supabase Sync

- Auth, Tabellen und RLS,
- Outbox für lokale Mutationen,
- Pull/Merge/Conflict-Verhalten,
- zweites Browserprofil und zweites physisches Gerät testen.

### Phase 6 – PWA/Offline

- Manifest und Icons,
- vorsichtiges Shell-Caching,
- Offline-Librarytest,
- Update- und Cachemigration prüfen.

### Phase 7 – Production

- vollständiges `verify`,
- Preview-End-to-End-Test,
- Production deployen,
- Alias dokumentieren,
- `HANDOFF.md` und README aktualisieren,
- Rollback-Deployment notieren.

## 11. Tests

### Unit-Tests

- Schema und jede Migration,
- Add/Update/Delete ohne Datenverlust,
- Sortierreihenfolge,
- Loop Action Persistenz,
- Autosave-Debounce und Flush,
- Konfliktauflösung,
- Media-ID statt Blob-URL,
- Offline-Outbox.

### Browser-/E2E-Tests

- leere Library → Song anlegen → Reload → Song bleibt,
- Song wechseln → alle getrennten Arbeitsstände bleiben,
- A/B-Loop und Action speichern → Reload → exakt wiederhergestellt,
- Offline-Reload zeigt Library,
- Anmeldung auf Gerät A → Änderung → Gerät B empfängt sie,
- fremder Benutzer kann keine Datensätze lesen,
- Companion offline: UI bleibt benutzbar und ehrlich,
- Companion online: Import und Stemstatus funktionieren,
- mobile UI besitzt keine horizontale Überbreite,
- PWA startet auf der richtigen Route.

### Audio-/Hardware-Test

- Play/Pause/Seek ohne Knacken,
- Loopgrenze mit kurzer Dezipper-/Crossfade-Rampe,
- Speed-Wechsel ohne harten Pegelsprung,
- Original ↔ Stems nur über gemeinsame Audio-Zeitbasis,
- alle Solo/Mute-Kombinationen mit Headroom,
- echter Test über den vorgesehenen Audioausgang.

## 12. Abnahmekriterien

Die Arbeit ist erst abgeschlossen, wenn:

- `npm run verify` grün ist,
- Vercel Preview und Production erfolgreich bauen,
- die Production-URL dokumentiert ist,
- ein Reload die komplette lokale Songliste wiederherstellt,
- ein zweites angemeldetes Gerät dieselben Metadaten erhält,
- Offlinebetrieb die Library zeigt,
- fehlende lokale Medien klar markiert werden,
- kein fremder Benutzer per API auf die Library zugreifen kann,
- 390-px-Telefon, iPad und Desktop visuell geprüft wurden,
- bestehende Import-, Metronom-, Loop- und Stemfunktionen lokal weiterhin
  funktionieren,
- keine Secrets oder importierten Audiodateien committed wurden.

## 13. Nicht in diesem Schritt versprechen

- keine serverlose Demucs-Ausführung auf Vercel,
- kein automatisches Hochladen fremder YouTube-Aufnahmen,
- keine unlimitierte Cloud-Mediathek,
- keine Spotify-Audioextraktion,
- keine perfekte automatische Songstruktur ohne Confidence-/Fallbackanzeige,
- keine Offline-Audiowiedergabe auf einem Gerät, das die Datei nie erhalten hat.

## 14. Erwartete Dokumentationsupdates im Worship-Loops-Repo

Nach der Umsetzung müssen mindestens aktualisiert werden:

- `HANDOFF.md`: Architektur, Datenmodell, Production-URL, Tests und Grenzen,
- `README.md`: Start, Anmeldung, lokale Library, Companion und Vercel,
- `.env.example`: nur Variablennamen und Erklärungen,
- Datenbankmigrationen und RLS-Policies,
- Recovery-/Rollback-Anleitung,
- Erklärung, welche Daten lokal, synchronisiert oder nur auf einem Media-Gerät
  vorhanden sind.

Diese Datei ist eine Planungsvorgabe. Änderungen am Worship-Loops-Projekt
werden in dessen eigenem Repository umgesetzt, geprüft, deployed und committed.
