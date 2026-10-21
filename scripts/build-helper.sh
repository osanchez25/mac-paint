#!/bin/zsh
# Compiles the Swift "Remove background" helper where Tauri expects a bundled binary
# (src-tauri/binaries/remove-bg-<target triple>).
#
#   ./scripts/build-helper.sh                         # this Mac's chip
#   ./scripts/build-helper.sh universal-apple-darwin  # Apple silicon + Intel in one file
set -euo pipefail
root="${0:A:h}/.."
src="$root/macos/remove-bg.swift"
target="${1:-${TAURI_ENV_TARGET_TRIPLE:-$(rustc -vV | sed -n 's/^host: //p')}}"
out="$root/src-tauri/binaries/remove-bg-$target"
mkdir -p "$root/src-tauri/binaries"

build() { swiftc -O -target "$1-apple-macos14" "$src" -o "$2"; }

case "$target" in
  universal-apple-darwin)
    tmp="$(mktemp -d)"
    build arm64 "$tmp/arm64"
    build x86_64 "$tmp/x86_64"
    lipo -create "$tmp/arm64" "$tmp/x86_64" -output "$out"
    rm -rf "$tmp"
    ;;
  aarch64-apple-darwin) build arm64 "$out" ;;
  x86_64-apple-darwin) build x86_64 "$out" ;;
  *) echo "build-helper: unsupported target $target (macOS only)" >&2; exit 1 ;;
esac
