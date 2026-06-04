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

# First configure pass: downloads all dependencies (including qpdf)
echo "Configuring WASM build (pass 1: downloading dependencies)..."
emcmake cmake -S "$SCRIPT_DIR" -B "$BUILD_DIR"

# Apply Emscripten compatibility patches to downloaded sources.
# Done outside CMake because CPM can't re-apply patches to already-patched source.
QPDF_SRC="$BUILD_DIR/_deps/qpdf-src"
if [ -d "$QPDF_SRC" ]; then
    echo "Applying Emscripten patch to qpdf..."
    patch --forward -p1 -d "$QPDF_SRC" -i "$QPDF_PATCH" || true
else
    echo "WARNING: qpdf source not found at $QPDF_SRC, skipping patch"
fi

LP_SRC="$BUILD_DIR/_deps/letterpress-src"
if [ -d "$LP_SRC" ]; then
    echo "Applying Emscripten patch to letterpress..."
    patch --forward -p1 -d "$LP_SRC" -i "$LP_PATCH" || true
    echo "Applying AngelScript generic-calling patch to letterpress..."
    patch --forward -p1 -d "$LP_SRC" -i "$AS_PATCH" || true
    echo "Applying document pushFont safety patch..."
    patch --forward -p1 -d "$LP_SRC" -i "$DOC_PATCH" || true
    echo "Applying parser regex WASM fix..."
    patch --forward -p1 -d "$LP_SRC" -i "$PARSER_PATCH" || true
else
    echo "WARNING: letterpress source not found at $LP_SRC, skipping patch"
fi

AS_SRC="$BUILD_DIR/_deps/angelscript-src"
if [ -d "$AS_SRC" ]; then
    echo "Applying WASM alignment fix to AngelScript..."
    patch --forward -p1 -d "$AS_SRC" -i "$ASALIGN_PATCH" || true
else
    echo "WARNING: AngelScript source not found at $AS_SRC, skipping patch"
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
        wget -q "$url" -O "$ASSETS_DIR/fonts/$name"
    elif command -v curl &>/dev/null; then
        curl -sSL "$url" -o "$ASSETS_DIR/fonts/$name"
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
