#!/bin/bash
echo Make sure you have called "install_dependencies.sh" first!
# Configure cmake
emcmake cmake -S . -B ./build -DCMAKE_INSTALL_PREFIX="$PWD/qpdf-wasm/out" -DRANDOM_DEVICE="/dev/random"