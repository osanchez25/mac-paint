#!/bin/zsh
# Installs the built Paint.app into /Applications and the Finder "Edit in Paint" Quick Action.
# Build first: npm run tauri build -- --bundles app
set -euo pipefail

root="${0:A:h}/.."
app="$root/src-tauri/target/release/bundle/macos/Paint.app"
workflow="$root/macos/Edit in Paint.workflow"

if [[ ! -d "$app" ]]; then
  echo "Paint.app not found at $app. Build it first: npm run tauri build -- --bundles app" >&2
  exit 1
fi

# Quit a running copy so the new one replaces it cleanly.
osascript -e 'tell application id "dev.oscarsanchez.paint" to quit' 2>/dev/null || true

rm -rf /Applications/Paint.app
cp -R "$app" /Applications/Paint.app
# Tell Launch Services about the app so "Open With" lists it.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Paint.app

mkdir -p ~/Library/Services
rm -rf ~/Library/Services/"Edit in Paint.workflow"
cp -R "$workflow" ~/Library/Services/
# Refresh the Services / Quick Actions menu.
/System/Library/CoreServices/pbs -update

echo "Installed /Applications/Paint.app and the \"Edit in Paint\" Quick Action."
