#!/bin/zsh

# Sicherer Ein-Klick-Installer für macOS.
# Funktioniert sowohl im vollständigen Repository als auch als einzelne Datei.

set -euo pipefail

REPOSITORY="ahaz6/worship-keys"
TARGET_DIR="$HOME/Documents/Worship Keys"
SCRIPT_DIR="${0:A:h}"
MINIMUM_NODE_MAJOR=22
TEMP_DIR=""

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
fi

function pause_before_exit() {
  if [[ "${WK_INSTALL_NONINTERACTIVE:-0}" != "1" ]]; then
    read "?Drücke die Eingabetaste, um dieses Fenster zu schließen."
  fi
}

function show_error() {
  /usr/bin/osascript - "$1" <<'APPLESCRIPT' >/dev/null 2>&1 || true
on run argv
  display dialog (item 1 of argv) buttons {"OK"} default button "OK" with icon caution
end run
APPLESCRIPT
}

function fail() {
  show_error "$1"
  print ""
  print "FEHLER: $1"
  print ""
  pause_before_exit
  exit 1
}

function cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    /bin/rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

function node_is_ready() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && \
    [[ "$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || print 0)" -ge "$MINIMUM_NODE_MAJOR" ]]
}

function install_node_lts() {
  print "Node.js LTS wird von nodejs.org geladen …"
  TEMP_DIR="$(/usr/bin/mktemp -d -t worship-keys-installer)"

  local index_file="$TEMP_DIR/node-index.json"
  /usr/bin/curl --fail --location --silent --show-error \
    "https://nodejs.org/dist/index.json" --output "$index_file" \
    || fail "Die Liste der Node.js-Versionen konnte nicht geladen werden. Prüfe die Internetverbindung."

  local node_version
  node_version="$(/usr/bin/grep -m 1 -E '"lts"[[:space:]]*:[[:space:]]*"[^"]+"' "$index_file" | \
    /usr/bin/sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
  [[ "$node_version" == v* ]] || fail "Die aktuelle Node.js-LTS-Version konnte nicht bestimmt werden."

  local package_file="$TEMP_DIR/node-lts.pkg"
  /usr/bin/curl --fail --location --progress-bar \
    "https://nodejs.org/dist/$node_version/node-$node_version.pkg" --output "$package_file" \
    || fail "Node.js LTS konnte nicht geladen werden."

  print "macOS fragt jetzt einmal nach dem Administratorpasswort …"
  /usr/bin/osascript - "$package_file" <<'APPLESCRIPT' \
    || fail "Node.js LTS konnte nicht installiert werden."
on run argv
  do shell script "/usr/sbin/installer -pkg " & quoted form of (item 1 of argv) & " -target /" with administrator privileges
end run
APPLESCRIPT

  export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
  node_is_ready || fail "Node.js wurde installiert, ist aber noch nicht verfügbar. Starte den Mac neu und führe den Installer erneut aus."
}

function github_cli() {
  if command -v gh >/dev/null 2>&1; then
    command -v gh
    return
  fi

  [[ -n "$TEMP_DIR" ]] || TEMP_DIR="$(/usr/bin/mktemp -d -t worship-keys-installer)"
  local architecture
  case "$(/usr/bin/uname -m)" in
    arm64) architecture="arm64" ;;
    x86_64) architecture="amd64" ;;
    *) fail "Diese Mac-Prozessorarchitektur wird nicht unterstützt." ;;
  esac

  print "Die sichere GitHub-Anmeldung wird vorbereitet …" >&2
  local release_json="$TEMP_DIR/github-cli-release.json"
  /usr/bin/curl --fail --location --silent --show-error \
    "https://api.github.com/repos/cli/cli/releases/latest" --output "$release_json" \
    || fail "Die GitHub-Anmeldung konnte nicht vorbereitet werden."

  local download_url
  download_url="$(/usr/bin/grep 'browser_download_url' "$release_json" | \
    /usr/bin/grep "macOS_${architecture}\.zip" | /usr/bin/head -n 1 | \
    /usr/bin/sed -E 's/.*"(https:[^"]+)".*/\1/')"
  [[ "$download_url" == https:* ]] || fail "Das passende GitHub-Anmeldeprogramm wurde nicht gefunden."

  local archive="$TEMP_DIR/github-cli.zip"
  /usr/bin/curl --fail --location --progress-bar "$download_url" --output "$archive" \
    || fail "Das GitHub-Anmeldeprogramm konnte nicht geladen werden."
  /usr/bin/ditto -x -k "$archive" "$TEMP_DIR/github-cli"

  local executable
  executable="$(/usr/bin/find "$TEMP_DIR/github-cli" -type f -path '*/bin/gh' -perm -u+x | /usr/bin/head -n 1)"
  [[ -x "$executable" ]] || fail "Das GitHub-Anmeldeprogramm konnte nicht gestartet werden."
  print -r -- "$executable"
}

function download_project() {
  local gh_binary
  gh_binary="$(github_cli)"

  if ! "$gh_binary" auth status --hostname github.com >/dev/null 2>&1; then
    print "" >&2
    print "GitHub öffnet jetzt den Browser." >&2
    print "Melde dich mit einem Konto an, das Zugriff auf $REPOSITORY hat." >&2
    print "" >&2
    "$gh_binary" auth login --hostname github.com --git-protocol https --web \
      || fail "Die GitHub-Anmeldung wurde abgebrochen."
  fi

  "$gh_binary" repo view "$REPOSITORY" >/dev/null 2>&1 \
    || fail "Dieses GitHub-Konto hat keinen Zugriff auf das private Worship-Keys-Repository."

  [[ -n "$TEMP_DIR" ]] || TEMP_DIR="$(/usr/bin/mktemp -d -t worship-keys-installer)"
  local archive="$TEMP_DIR/worship-keys.zip"
  print "Die aktuelle Worship-Keys-Version wird geladen …" >&2
  "$gh_binary" api "repos/$REPOSITORY/zipball/main" > "$archive" \
    || fail "Worship Keys konnte nicht von GitHub geladen werden."

  local extracted="$TEMP_DIR/project"
  /bin/mkdir -p "$extracted"
  /usr/bin/ditto -x -k "$archive" "$extracted" \
    || fail "Das Worship-Keys-Paket konnte nicht entpackt werden."

  local source_dir
  source_dir="$(/usr/bin/find "$extracted" -mindepth 1 -maxdepth 1 -type d | /usr/bin/head -n 1)"
  [[ -f "$source_dir/package.json" ]] || fail "Das heruntergeladene Worship-Keys-Paket ist unvollständig."

  /bin/mkdir -p "$HOME/Documents"
  if [[ -e "$TARGET_DIR" ]]; then
    local backup_dir="$HOME/Documents/Worship Keys Backup $(/bin/date '+%Y-%m-%d %H-%M-%S')"
    print "Die vorhandene Installation wird gesichert:" >&2
    print "  $backup_dir" >&2
    /bin/mv "$TARGET_DIR" "$backup_dir" \
      || fail "Die vorhandene Worship-Keys-Installation konnte nicht gesichert werden."
  fi
  /bin/mv "$source_dir" "$TARGET_DIR" \
    || fail "Der neue Worship-Keys-Ordner konnte nicht unter Dokumente erstellt werden."
  typeset -g PROJECT_DIR="$TARGET_DIR"
}

clear 2>/dev/null || true
print "============================================================"
print "           WORSHIP KEYS – MAC-INSTALLATION"
print "============================================================"
print ""
print "Dieser Assistent lädt und installiert alles Erforderliche."
print "Beim ersten Mal werden Internet und das Mac-Passwort benötigt."
print ""

if ! node_is_ready; then
  install_node_lts
fi
print "✓ Node.js $(node --version) ist bereit."

PROJECT_DIR="$SCRIPT_DIR"
if [[ ! -f "$PROJECT_DIR/package.json" || ! -f "$PROJECT_DIR/package-lock.json" ]]; then
  download_project
fi

cd "$PROJECT_DIR"
print "✓ Worship Keys liegt unter: $PROJECT_DIR"
print ""
print "1/2 – Benötigte Bestandteile werden installiert …"
npm install || fail "Die benötigten Bestandteile konnten nicht installiert werden."

print ""
print "2/2 – Worship Keys Church und Stop Worship Keys werden eingerichtet …"
npm run church:install || fail "Die Worship-Keys-Apps konnten nicht installiert werden."

print ""
print "============================================================"
print "                 INSTALLATION ERFOLGREICH"
print "============================================================"
print ""
print "Im allgemeinen Programme-Ordner befinden sich jetzt:"
print "  • Worship Keys Church"
print "  • Stop Worship Keys"
print ""
print "Der Projektordner liegt hier:"
print "  $PROJECT_DIR"
print ""
print "Diesen Ordner bitte nicht verschieben oder löschen."
print ""

if [[ "${WK_INSTALL_NONINTERACTIVE:-0}" != "1" ]]; then
  /usr/bin/open -R "/Applications/Worship Keys Church.app"
  /usr/bin/osascript <<'APPLESCRIPT' >/dev/null
display dialog "Worship Keys wurde erfolgreich installiert. Öffne jetzt im Programme-Ordner ‚Worship Keys Church‘." buttons {"Programme öffnen"} default button "Programme öffnen" with icon note
APPLESCRIPT
  /usr/bin/open "/Applications"
fi
