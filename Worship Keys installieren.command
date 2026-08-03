#!/bin/zsh

# Ein-Klick-Einrichtung für technisch unerfahrene Worship-Keys-Nutzer.
# Das Script wird direkt aus dem entpackten GitHub-Ordner gestartet.

set -e

SCRIPT_DIR="${0:A:h}"
NODE_DOWNLOAD_URL="https://nodejs.org/en/download"

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
fi

function show_error() {
  local message="$1"
  /usr/bin/osascript -e "display dialog \"$message\" buttons {\"OK\"} default button \"OK\" with icon caution" >/dev/null
}

function fail() {
  show_error "$1"
  print ""
  print "FEHLER: $1"
  print ""
  read "?Drücke die Eingabetaste, um dieses Fenster zu schließen."
  exit 1
}

clear 2>/dev/null || true
print "============================================================"
print "           WORSHIP KEYS – INSTALLATION"
print "============================================================"
print ""
print "Dieser Assistent installiert Worship Keys auf diesem Mac."
print "Der Vorgang kann beim ersten Mal einige Minuten dauern."
print ""

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  /usr/bin/open "$NODE_DOWNLOAD_URL"
  fail "Node.js fehlt. Die offizielle Downloadseite wurde geöffnet. Installiere dort die LTS-Version für macOS und starte danach diese Datei erneut."
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  /usr/bin/open "$NODE_DOWNLOAD_URL"
  fail "Die installierte Node.js-Version ist zu alt. Installiere auf der geöffneten Seite die aktuelle LTS-Version und starte diesen Assistenten erneut."
fi

if [[ ! -f "$SCRIPT_DIR/package.json" || ! -f "$SCRIPT_DIR/package-lock.json" ]]; then
  fail "Der Worship-Keys-Ordner ist unvollständig. Lade das Projekt erneut als ZIP von GitHub herunter und entpacke es vollständig."
fi

cd "$SCRIPT_DIR"
print "✓ Node.js $(node --version) wurde gefunden."
print "✓ Worship-Keys-Ordner wurde gefunden."
print ""
print "1/2 – Benötigte Bestandteile werden installiert …"
npm install || fail "Die benötigten Bestandteile konnten nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut."

print ""
print "2/2 – Die beiden macOS-Apps werden eingerichtet …"
npm run church:install || fail "Die Worship-Keys-Apps konnten nicht installiert werden. Prüfe die Meldung im Terminal und versuche es erneut."

print ""
print "============================================================"
print "                 INSTALLATION ERFOLGREICH"
print "============================================================"
print ""
print "Im Programme-Ordner findest du jetzt:"
print "  • Worship Keys Church"
print "  • Stop Worship Keys"
print ""
print "Wichtig: Den Ordner '$SCRIPT_DIR' danach nicht verschieben"
print "oder löschen. Die Church-App verwendet diesen Ordner."
print ""

if [[ "${WK_INSTALL_NONINTERACTIVE:-0}" != "1" ]]; then
  /usr/bin/open -R "/Applications/Worship Keys Church.app"
  /usr/bin/osascript -e 'display dialog "Worship Keys wurde erfolgreich installiert. Öffne jetzt im Programme-Ordner ‚Worship Keys Church‘." buttons {"Programme öffnen"} default button "Programme öffnen" with icon note' >/dev/null
  /usr/bin/open "/Applications"
fi
