#!/usr/bin/env bash
set -euo pipefail

# Compiles build/MarkDoc.icon (Icon Composer bundle) into build/Assets.car and
# build/icon.icns for macOS Liquid Glass app icons. Requires Xcode 26+ actool.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICON_BUNDLE="$ROOT_DIR/build/MarkDoc.icon"
OUTPUT_DIR="$ROOT_DIR/build/icon-compiled"
PLIST_PATH="$OUTPUT_DIR/assetcatalog_generated_info.plist"

if [[ ! -d "$ICON_BUNDLE" ]]; then
  echo "compile-macos-icon: missing $ICON_BUNDLE" >&2
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "compile-macos-icon: Xcode is required to compile Liquid Glass icons" >&2
  exit 1
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

actool "$ICON_BUNDLE" \
  --compile "$OUTPUT_DIR" \
  --output-format human-readable-text \
  --notices --warnings --errors \
  --output-partial-info-plist "$PLIST_PATH" \
  --app-icon MarkDoc \
  --include-all-app-icons \
  --enable-on-demand-resources NO \
  --development-region en \
  --target-device mac \
  --minimum-deployment-target 11.0 \
  --platform macosx

cp "$OUTPUT_DIR/Assets.car" "$ROOT_DIR/build/Assets.car"
cp "$OUTPUT_DIR/MarkDoc.icns" "$ROOT_DIR/build/icon.icns"
rm -f "$PLIST_PATH"

echo "compile-macos-icon: wrote build/Assets.car and build/icon.icns"
