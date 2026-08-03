import { execFileSync } from "node:child_process";
import {
  W_OK,
  accessSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const systemApplicationsDirectory = "/Applications";
const churchAppName = "Worship Keys Church.app";
const stopAppName = "Stop Worship Keys.app";
const churchAppTarget = path.join(systemApplicationsDirectory, churchAppName);
const stopAppTarget = path.join(systemApplicationsDirectory, stopAppName);
const oldUserChurchApp = path.join(homedir(), "Applications", churchAppName);
const oldUserStopApp = path.join(homedir(), "Applications", stopAppName);
const logDirectory = path.join(homedir(), "Library", "Logs", "Worship Keys");
const logPath = path.join(logDirectory, "church-host.log");
const launchAgentDirectory = path.join(homedir(), "Library", "LaunchAgents");
const launchAgentLabel = "app.worshipkeys.church.host";
const launchAgentPath = path.join(launchAgentDirectory, `${launchAgentLabel}.plist`);
const launchAgentTarget = `gui/${process.getuid()}/${launchAgentLabel}`;

if (!existsSync(path.join(projectRoot, ".next", "BUILD_ID"))) {
  throw new Error("Vor der Installation ist ein Produktions-Build erforderlich. Bitte zuerst npm run build ausführen.");
}

const shellQuote = (value) => `'${value.replaceAll("'", `'\\''`)}'`;
const xmlEscape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const appleScriptEscape = (value) => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const stagingRoot = mkdtempSync(path.join(tmpdir(), "worship-keys-church-apps-"));
const churchAppStaging = path.join(stagingRoot, churchAppName);
const stopAppStaging = path.join(stagingRoot, stopAppName);

mkdirSync(logDirectory, { recursive: true });
mkdirSync(launchAgentDirectory, { recursive: true });

function createAppBundle({ appPath, displayName, executableName, identifier, executable }) {
  const contentsPath = path.join(appPath, "Contents");
  const macOSPath = path.join(contentsPath, "MacOS");
  const resourcesPath = path.join(contentsPath, "Resources");
  mkdirSync(macOSPath, { recursive: true });
  mkdirSync(resourcesPath, { recursive: true });

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDisplayName</key><string>${xmlEscape(displayName)}</string>
  <key>CFBundleExecutable</key><string>${xmlEscape(executableName)}</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleIdentifier</key><string>${xmlEscape(identifier)}</string>
  <key>CFBundleName</key><string>${xmlEscape(displayName)}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.1</string>
  <key>CFBundleVersion</key><string>2</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>`;
  writeFileSync(path.join(contentsPath, "Info.plist"), plist);
  const executablePath = path.join(macOSPath, executableName);
  writeFileSync(executablePath, executable);
  chmodSync(executablePath, 0o755);
  return resourcesPath;
}

const launcher = `#!/bin/zsh
PROJECT_DIR=${shellQuote(projectRoot)}
LOG_FILE=${shellQuote(logPath)}
LAUNCH_AGENT=${shellQuote(launchAgentTarget)}
LOCAL_URL='http://localhost:3000/'
HEALTH_URL='http://127.0.0.1:3000/api/session/bootstrap'

if /usr/bin/curl --silent --fail --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
  /usr/bin/open "$LOCAL_URL"
  exit 0
fi

if [[ ! -f "$PROJECT_DIR/.next/BUILD_ID" ]]; then
  /usr/bin/osascript -e 'display dialog "Worship Keys muss einmal im Projektordner vorbereitet werden. Bitte dort npm run church:install ausführen." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

/bin/launchctl kickstart -k "$LAUNCH_AGENT" >>"$LOG_FILE" 2>&1
for attempt in {1..80}; do
  if /usr/bin/curl --silent --fail --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
    /usr/bin/open "$LOCAL_URL"
    exit 0
  fi
  /bin/sleep 0.25
done

/usr/bin/osascript -e 'display dialog "Worship Keys Church konnte nicht gestartet werden. Bitte die Datei church-host.log unter Library/Logs/Worship Keys prüfen." buttons {"OK"} default button "OK" with icon caution'
exit 1
`;

const stopLauncher = `#!/bin/zsh
LAUNCH_AGENT=${shellQuote(launchAgentTarget)}
HEALTH_URL='http://127.0.0.1:3000/api/session/bootstrap'

if ! /bin/launchctl print "$LAUNCH_AGENT" >/dev/null 2>&1; then
  /usr/bin/osascript -e 'display notification "Der lokale Server ist bereits beendet." with title "Worship Keys"'
  exit 0
fi

/bin/launchctl kill SIGTERM "$LAUNCH_AGENT" >/dev/null 2>&1 || true
for attempt in {1..40}; do
  if ! /usr/bin/curl --silent --fail --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
    /usr/bin/osascript -e 'display notification "Der lokale Server wurde beendet." with title "Worship Keys"'
    exit 0
  fi
  /bin/sleep 0.1
done

/usr/bin/osascript -e 'display dialog "Der lokale Worship-Keys-Server konnte nicht vollständig beendet werden." buttons {"OK"} default button "OK" with icon caution'
exit 1
`;

const churchResources = createAppBundle({
  appPath: churchAppStaging,
  displayName: "Worship Keys Church",
  executableName: "Worship Keys Church",
  identifier: "app.worshipkeys.church",
  executable: launcher,
});
const stopResources = createAppBundle({
  appPath: stopAppStaging,
  displayName: "Stop Worship Keys",
  executableName: "Stop Worship Keys",
  identifier: "app.worshipkeys.church.stop",
  executable: stopLauncher,
});

const launchAgentPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${launchAgentLabel}</string>
  <key>ProgramArguments</key><array>
    <string>${xmlEscape(process.execPath)}</string>
    <string>${xmlEscape(path.join(projectRoot, "server.mjs"))}</string>
  </array>
  <key>WorkingDirectory</key><string>${xmlEscape(projectRoot)}</string>
  <key>EnvironmentVariables</key><dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PORT</key><string>3000</string>
    <key>WK_CHURCH_MODE</key><string>1</string>
  </dict>
  <key>ProcessType</key><string>Background</string>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key><string>${xmlEscape(logPath)}</string>
</dict></plist>`;
writeFileSync(launchAgentPath, launchAgentPlist);

try {
  execFileSync("/bin/launchctl", ["bootout", `gui/${process.getuid()}`, launchAgentPath], { stdio: "ignore" });
} catch {
  // Der Agent ist bei der ersten Installation noch nicht geladen.
}
execFileSync("/bin/launchctl", ["bootstrap", `gui/${process.getuid()}`, launchAgentPath]);

const sourceIcon = path.join(projectRoot, "public", "worship-keys-icon.png");
if (existsSync(sourceIcon)) {
  const iconsetPath = path.join(stagingRoot, "AppIcon.iconset");
  const icnsPath = path.join(stagingRoot, "AppIcon.icns");
  mkdirSync(iconsetPath);
  const sizes = [
    [16, "icon_16x16.png"], [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"], [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"], [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"], [512, "icon_256x256@2x.png"],
    [512, "icon_512x512.png"], [1024, "icon_512x512@2x.png"],
  ];
  try {
    for (const [size, name] of sizes) {
      execFileSync("/usr/bin/sips", ["-z", String(size), String(size), sourceIcon, "--out", path.join(iconsetPath, name)], { stdio: "ignore" });
    }
    execFileSync("/usr/bin/iconutil", ["-c", "icns", iconsetPath, "-o", icnsPath]);
    copyFileSync(icnsPath, path.join(churchResources, "AppIcon.icns"));
    copyFileSync(icnsPath, path.join(stopResources, "AppIcon.icns"));
  } catch {
    copyFileSync(sourceIcon, path.join(churchResources, "AppIcon.png"));
    copyFileSync(sourceIcon, path.join(stopResources, "AppIcon.png"));
    console.warn("Das macOS-Icon konnte nicht als ICNS erzeugt werden; das originale PNG wurde verwendet.");
  }
}

for (const appPath of [churchAppStaging, stopAppStaging]) {
  try {
    execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "ignore" });
  } catch {
    console.warn(`${path.basename(appPath)} wurde ohne Ad-hoc-Signatur erstellt.`);
  }
}

const installCommand = [
  `/bin/rm -rf ${shellQuote(churchAppTarget)} ${shellQuote(stopAppTarget)}`,
  `/usr/bin/ditto ${shellQuote(churchAppStaging)} ${shellQuote(churchAppTarget)}`,
  `/usr/bin/ditto ${shellQuote(stopAppStaging)} ${shellQuote(stopAppTarget)}`,
].join(" && ");

try {
  accessSync(systemApplicationsDirectory, W_OK);
  execFileSync("/bin/zsh", ["-c", installCommand]);
} catch {
  const privilegedInstall = `do shell script "${appleScriptEscape(installCommand)}" with administrator privileges`;
  execFileSync("/usr/bin/osascript", ["-e", privilegedInstall], { stdio: "inherit" });
}

// Exakte alte Benutzer-Bundles entfernen, damit Finder nicht zwei Versionen zeigt.
rmSync(oldUserChurchApp, { recursive: true, force: true });
rmSync(oldUserStopApp, { recursive: true, force: true });
rmSync(stagingRoot, { recursive: true, force: true });

console.log(`Installiert: ${churchAppTarget}`);
console.log(`Installiert: ${stopAppTarget}`);
