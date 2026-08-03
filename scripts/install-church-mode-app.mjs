import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const applicationsDirectory = path.join(homedir(), "Applications");
const appPath = path.join(applicationsDirectory, "Worship Keys Church.app");
const contentsPath = path.join(appPath, "Contents");
const macOSPath = path.join(contentsPath, "MacOS");
const resourcesPath = path.join(contentsPath, "Resources");
const executablePath = path.join(macOSPath, "Worship Keys Church");
const logDirectory = path.join(homedir(), "Library", "Logs", "Worship Keys");
const logPath = path.join(logDirectory, "church-host.log");

if (!existsSync(path.join(projectRoot, ".next", "BUILD_ID"))) {
  throw new Error("A production build is required before installing the Church Mode app. Run npm run build first.");
}

const shellQuote = (value) => `'${value.replaceAll("'", `'\\''`)}'`;
const xmlEscape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

rmSync(appPath, { recursive: true, force: true });
mkdirSync(macOSPath, { recursive: true });
mkdirSync(resourcesPath, { recursive: true });
mkdirSync(logDirectory, { recursive: true });

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDisplayName</key><string>Worship Keys Church</string>
  <key>CFBundleExecutable</key><string>Worship Keys Church</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleIdentifier</key><string>app.worshipkeys.church</string>
  <key>CFBundleName</key><string>Worship Keys Church</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>`;
writeFileSync(path.join(contentsPath, "Info.plist"), plist);

const launcher = `#!/bin/zsh
PROJECT_DIR=${shellQuote(projectRoot)}
NODE_BIN=${shellQuote(process.execPath)}
LOG_FILE=${shellQuote(logPath)}
LOCAL_URL='http://localhost:3000/'
HEALTH_URL='http://127.0.0.1:3000/api/session/bootstrap'

if /usr/bin/curl --silent --fail --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
  /usr/bin/open "$LOCAL_URL"
  exit 0
fi

if [[ ! -f "$PROJECT_DIR/.next/BUILD_ID" ]]; then
  /usr/bin/osascript -e 'display dialog "Worship Keys needs to be prepared once while online. Run npm run church:install in the project folder." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

(
  for attempt in {1..80}; do
    if /usr/bin/curl --silent --fail --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
      /usr/bin/open "$LOCAL_URL"
      exit 0
    fi
    /bin/sleep 0.25
  done
  /usr/bin/osascript -e 'display dialog "Worship Keys Church could not start. Check the church-host.log file in Library/Logs/Worship Keys." buttons {"OK"} default button "OK" with icon caution'
) &

cd "$PROJECT_DIR" || exit 1
exec /usr/bin/env NODE_ENV=production PORT=3000 WK_CHURCH_MODE=1 "$NODE_BIN" server.mjs >>"$LOG_FILE" 2>&1
`;
writeFileSync(executablePath, launcher);
chmodSync(executablePath, 0o755);

const sourceIcon = path.join(projectRoot, "public", "worship-keys-icon.png");
if (existsSync(sourceIcon)) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "worship-keys-icon-"));
  const iconsetPath = path.join(temporaryRoot, "AppIcon.iconset");
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
    execFileSync("/usr/bin/iconutil", ["-c", "icns", iconsetPath, "-o", path.join(resourcesPath, "AppIcon.icns")]);
  } catch {
    copyFileSync(sourceIcon, path.join(resourcesPath, "worship-keys-icon.png"));
    console.warn("The macOS icon could not be generated; the original PNG was copied instead.");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

try {
  execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "ignore" });
} catch {
  console.warn("The app was installed without an ad-hoc signature.");
}

console.log(`Installed ${xmlEscape(appPath)}`);
