#!/bin/zsh
# Compiles the Swift "Remove background" helper where Tauri expects a bundled binary.
set -euo pipefail
root="${0:A:h}/.."
triple="$(rustc -vV | sed -n 's/^host: //p')"
mkdir -p "$root/src-tauri/binaries"
swiftc -O -target "$( [[ $triple == aarch64* ]] && echo arm64 || echo x86_64 )-apple-macos14" "$root/macos/remove-bg.swift" -o "$root/src-tauri/binaries/remove-bg-$triple"
