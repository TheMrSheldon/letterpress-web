#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
QPDF_PATCH="$SCRIPT_DIR/patches/qpdf-emscripten.patch"
LP_PATCH="$SCRIPT_DIR/patches/letterpress-emscripten.patch"
AS_PATCH="$SCRIPT_DIR/patches/letterpress-angelscript-wasm.patch"
ASALIGN_PATCH="$SCRIPT_DIR/patches/angelscript-wasm-align.patch"
DOC_PATCH="$SCRIPT_DIR/patches/letterpress-document-wasm.patch"
PARSER_PATCH="$SCRIPT_DIR/patches/letterpress-parser-wasm.patch"
EMSDK_DIR="${EMSDK:-${EMSDK_DIR:-$HOME/emsdk}}"
ASSETS_DIR="$SCRIPT_DIR/assets"

# Apply a patch, tolerating "already applied" (exit 1 from --forward) but
# failing loudly on real errors (exit 2: context mismatch, file not found, etc.).
_apply_patch() {
    local label="$1" src="$2" patchfile="$3"
    echo "Applying $label..."
    patch --forward -p1 -d "$src" -i "$patchfile" || {
        local rc=$?
        if [ "$rc" -eq 1 ]; then
            echo "  Already applied (skipped)."
        else
            echo "ERROR: patch $patchfile failed with exit code $rc" >&2
            exit 1
        fi
        return 0
    }
    echo "  Applied."
}

# Ensure a recent Emscripten is available (emsdk preferred; apt fallback).
# The apt package on Ubuntu 22.04 is 3.1.6 which lacks C++23 support.
_setup_emsdk() {
    local version="${1:-latest}"
    if [ ! -d "$EMSDK_DIR" ]; then
        echo "Cloning emsdk..."
        git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
    fi
    "$EMSDK_DIR/emsdk" install "$version"
    "$EMSDK_DIR/emsdk" activate "$version"
    # shellcheck source=/dev/null
    source "$EMSDK_DIR/emsdk_env.sh"
}

if [ -d "$EMSDK_DIR" ] && [ -f "$EMSDK_DIR/emsdk_env.sh" ]; then
    # emsdk already present — just activate
    source "$EMSDK_DIR/emsdk_env.sh"
fi

if ! command -v cmake &>/dev/null; then
    echo "Installing cmake..."
    sudo apt-get update -qq
    sudo apt-get install -y cmake
fi

# Verify emcmake is from a recent enough emsdk (need clang-18+, i.e. emcc 3.1.50+)
EMCC_VERSION=$(emcc --version 2>/dev/null | grep -oP '(?<=emcc \(Emscripten)[^)]+' || echo "")
EMCC_MAJOR=$(echo "$EMCC_VERSION" | grep -oP '^\s*\K\d+' || echo "0")
if [ "$EMCC_MAJOR" -lt 4 ]; then
    echo "emcc $EMCC_VERSION is too old (need ≥ 4.x for C++23 support); installing emsdk..."
    _setup_emsdk latest
fi

echo "Using: $(emcc --version 2>/dev/null | head -1)"

# Pre-download and patch qpdf before cmake ever sees it.
# qpdf's libqpdf/CMakeLists.txt unconditionally overwrites EXTERNAL_LIBS with a
# Windows-only check, so no CMake cache variable can prevent its pkg-config
# discovery from running.  The fix (AND NOT EMSCRIPTEN) must be present before
# the first cmake configure pass.  We download qpdf, apply the patch, then pass
# FETCHCONTENT_SOURCE_DIR_QPDF so cmake uses our pre-patched copy.
QPDF_PREDOWN="$BUILD_DIR/qpdf-predownload"
if [ ! -d "$QPDF_PREDOWN" ]; then
    mkdir -p "$BUILD_DIR"
    echo "Pre-downloading qpdf v11.9.1..."
    git clone --quiet --depth 1 --branch v11.9.1 https://github.com/qpdf/qpdf.git "$QPDF_PREDOWN"
fi
_apply_patch "Emscripten patch to qpdf" "$QPDF_PREDOWN" "$QPDF_PATCH"

# First configure pass: downloads remaining dependencies (letterpress, angelscript).
# qpdf is provided pre-patched via FETCHCONTENT_SOURCE_DIR_QPDF.
echo "Configuring WASM build (pass 1: downloading dependencies)..."
emcmake cmake -S "$SCRIPT_DIR" -B "$BUILD_DIR" \
    -DFETCHCONTENT_SOURCE_DIR_QPDF="$QPDF_PREDOWN"

LP_SRC="$BUILD_DIR/_deps/letterpress-src"
if [ -d "$LP_SRC" ]; then
    _apply_patch "Emscripten patch to letterpress"        "$LP_SRC" "$LP_PATCH"
    _apply_patch "AngelScript generic-calling patch"      "$LP_SRC" "$AS_PATCH"
    _apply_patch "document pushFont safety patch"         "$LP_SRC" "$DOC_PATCH"
    _apply_patch "parser regex WASM fix"                  "$LP_SRC" "$PARSER_PATCH"
else
    echo "ERROR: letterpress source not found at $LP_SRC" >&2
    exit 1
fi

AS_SRC="$BUILD_DIR/_deps/angelscript-src"
if [ -d "$AS_SRC" ]; then
    # angelscript_2.37.0.zip uses CRLF; convert the header to LF so patch can match context lines.
    sed -i 's/\r//' "$AS_SRC/angelscript/include/angelscript.h"
    _apply_patch "WASM alignment fix to AngelScript" "$AS_SRC" "$ASALIGN_PATCH"
else
    echo "ERROR: AngelScript source not found at $AS_SRC" >&2
    exit 1
fi

# Download Computer Modern fonts used by letterpress (same source as letterpress's Dockerfile).
mkdir -p "$ASSETS_DIR/fonts"
_download_font() {
    local name="$1"
    local url="https://mirrors.ctan.org/fonts/cm/ps-type1/bakoma/ttf/${name}"
    if [ -f "$ASSETS_DIR/fonts/$name" ]; then
        echo "$name already present."
        return
    fi
    echo "Downloading $name..."
    if command -v wget &>/dev/null; then
        wget -q --timeout=30 --tries=3 "$url" -O "$ASSETS_DIR/fonts/$name"
    elif command -v curl &>/dev/null; then
        curl -sSL --max-time 30 --retry 3 "$url" -o "$ASSETS_DIR/fonts/$name"
    elif command -v python3 &>/dev/null; then
        python3 -c "import urllib.request; urllib.request.urlretrieve('$url', '$ASSETS_DIR/fonts/$name')"
    else
        echo "WARNING: No download tool (wget/curl/python3); $name not downloaded. Font will be missing."
    fi
}
_download_font cmr12.ttf
_download_font cmbx12.ttf

# Second configure pass: picks up the patched qpdf CMakeLists
echo "Configuring WASM build (pass 2: applying patch)..."
emcmake cmake -S "$SCRIPT_DIR" -B "$BUILD_DIR"

echo "Done. Run build.sh to compile."
