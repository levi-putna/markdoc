#!/usr/bin/env bash
# Builds MarkDocQuickLook.appex (universal arm64+x86_64), optionally code-signed.
# Output: macos/QuickLookExtension/build/MarkDocQuickLook.appex
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EXTENSION_DIR="$SCRIPT_DIR/../QuickLookExtension"
RESOURCES_DIR="$EXTENSION_DIR/Resources"

cd "$EXTENSION_DIR"

if ! xcode-select -p 2>/dev/null | grep -q "Xcode.app"; then
  echo "error: full Xcode is required (xcodebuild is not available with Command Line Tools only)." >&2
  echo "Install Xcode from the App Store, then run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

XCODEGEN_VERSION="2.43.0"
if command -v xcodegen >/dev/null 2>&1; then
  XCODEGEN="$(command -v xcodegen)"
else
  TOOLDIR="build/tools"
  XCODEGEN=$(find "$TOOLDIR/xcodegen" -type f -name xcodegen -perm -u+x 2>/dev/null | head -1 || true)
  if [[ -z "${XCODEGEN:-}" || ! -x "$XCODEGEN" ]]; then
    echo "Downloading XcodeGen $XCODEGEN_VERSION (prebuilt)..."
    mkdir -p "$TOOLDIR"
    curl -fsSL -o "$TOOLDIR/xcodegen.zip" \
      "https://github.com/yonaskolb/XcodeGen/releases/download/${XCODEGEN_VERSION}/xcodegen.zip"
    rm -rf "$TOOLDIR/xcodegen"
    unzip -q -o "$TOOLDIR/xcodegen.zip" -d "$TOOLDIR/xcodegen"
    XCODEGEN=$(find "$TOOLDIR/xcodegen" -type f -name xcodegen -perm -u+x 2>/dev/null | head -1)
  fi
fi

if [[ -z "${XCODEGEN:-}" || ! -x "$XCODEGEN" ]]; then
  echo "error: could not locate xcodegen (install with: brew install xcodegen)" >&2
  exit 1
fi

MARKDOWN_IT_SRC="$REPO_ROOT/node_modules/markdown-it/dist/markdown-it.min.js"
TASK_LISTS_SRC="$REPO_ROOT/node_modules/markdown-it-task-lists/dist/markdown-it-task-lists.min.js"

if [[ ! -f "$MARKDOWN_IT_SRC" || ! -f "$TASK_LISTS_SRC" ]]; then
  echo "error: markdown-it bundles not found — run yarn install first" >&2
  exit 1
fi

mkdir -p "$RESOURCES_DIR"
cp "$MARKDOWN_IT_SRC" "$RESOURCES_DIR/markdown-it.min.js"
cp "$TASK_LISTS_SRC" "$RESOURCES_DIR/markdown-it-task-lists.min.js"

"$XCODEGEN" generate

APP_VERSION=$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo "1.0")
VERSION_ARGS=("MARKETING_VERSION=${APP_VERSION}" "CURRENT_PROJECT_VERSION=${APP_VERSION}")

DERIVED="build/DerivedData"
SIGN_ARGS=(
  CODE_SIGNING_ALLOWED=YES
  CODE_SIGN_IDENTITY=-
)

if [[ -n "${QUICKLOOK_SIGN_IDENTITY:-}" ]]; then
  CSFLAGS="--timestamp --options runtime"
  if [[ -n "${QUICKLOOK_KEYCHAIN:-}" ]]; then
    CSFLAGS="${CSFLAGS} --keychain ${QUICKLOOK_KEYCHAIN}"
  fi
  SIGN_ARGS=(
    CODE_SIGNING_ALLOWED=YES
    CODE_SIGN_STYLE=Manual
    "CODE_SIGN_IDENTITY=${QUICKLOOK_SIGN_IDENTITY}"
    "DEVELOPMENT_TEAM=${QUICKLOOK_TEAM_ID:-}"
    CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO
    "OTHER_CODE_SIGN_FLAGS=${CSFLAGS}"
  )
fi

xcodebuild \
  -project MarkDocQuickLook.xcodeproj \
  -scheme MarkDocQuickLook \
  -configuration Release \
  -derivedDataPath "$DERIVED" \
  -destination 'generic/platform=macOS' \
  ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO \
  "${VERSION_ARGS[@]}" \
  "${SIGN_ARGS[@]}" \
  build

SRC=$(find "$DERIVED/Build/Products/Release" -name 'MarkDocQuickLook.appex' | head -1)
if [[ -z "$SRC" ]]; then
  echo "error: MarkDocQuickLook.appex not found in build output" >&2
  exit 1
fi

mkdir -p build
rm -rf build/MarkDocQuickLook.appex
cp -R "$SRC" build/MarkDocQuickLook.appex
echo "Built: $(pwd)/build/MarkDocQuickLook.appex"
lipo -info "build/MarkDocQuickLook.appex/Contents/MacOS/MarkDocQuickLook" 2>/dev/null || true

for _k in CFBundleIdentifier CFBundleExecutable CFBundlePackageType; do
  _v=$(/usr/libexec/PlistBuddy -c "Print :${_k}" "build/MarkDocQuickLook.appex/Contents/Info.plist" 2>/dev/null || true)
  if [[ -z "${_v}" ]]; then
    echo "error: appex Info.plist is missing ${_k} — PluginKit will not register the extension" >&2
    exit 1
  fi
done

if codesign -d --entitlements :- "build/MarkDocQuickLook.appex" 2>/dev/null | grep -q "com.apple.security.app-sandbox"; then
  echo "Sandbox entitlement present."
else
  echo "error: appex is not sandboxed (missing com.apple.security.app-sandbox) — PluginKit will not register it" >&2
  exit 1
fi

if [[ -n "${QUICKLOOK_SIGN_IDENTITY:-}" ]]; then
  echo "Verifying appex signature (deep)..."
  codesign --verify --deep --strict --verbose=2 "build/MarkDocQuickLook.appex"
  if codesign -d --entitlements :- "build/MarkDocQuickLook.appex/Contents/MacOS/MarkDocQuickLook" 2>/dev/null | grep -q "get-task-allow"; then
    echo "error: appex executable still has com.apple.security.get-task-allow (would fail notarization)" >&2
    exit 1
  fi
  echo "Signature OK: sandboxed, no get-task-allow."
fi
