cmake_minimum_required(VERSION 3.8)

project(letterpress_wasm)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "This project must be compiled with emcmake. Run setup.sh first.")
endif()

# Use native WASM exceptions for all targets (deps included).
# The old JS-based mechanism (-sDISABLE_EXCEPTION_CATCHING=0) generates invoke_*
# wrappers that cause "function signature mismatch" traps in Emscripten 5.x.
add_compile_options(-fwasm-exceptions)
add_link_options(-fwasm-exceptions)

# Force AngelScript and its add-ons to use the generic calling convention.
# On WASM every indirect call is type-checked; native calling conventions
# (THISCALL, CDECL_OBJFIRST, etc.) cast function pointers between incompatible
# types at call-time, causing RuntimeError: function signature mismatch.
add_compile_definitions(AS_MAX_PORTABILITY)

# Build everything as static libraries.  Emscripten produces a single self-
# contained WASM module; shared libraries (.so) require dynamic linking which
# is experimental in WASM and causes wasm-ld to fail when it can't find
# soname-versioned .so files (e.g. libqpdf.so.29.9.1) in its sysroot path.
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build static libraries for WASM" FORCE)

########################################################################################################################
# LOAD CPM                                                                                                             #
########################################################################################################################
set(CPM_DOWNLOAD_VERSION 0.42.0)
set(CPM_HASH_SUM "2020b4fc42dba44817983e06342e682ecfc3d2f484a581f11cc5731fbe4dce8a")

if(CPM_SOURCE_CACHE)
    set(CPM_DOWNLOAD_LOCATION "${CPM_SOURCE_CACHE}/cpm/CPM_${CPM_DOWNLOAD_VERSION}.cmake")
elseif(DEFINED ENV{CPM_SOURCE_CACHE})
    set(CPM_DOWNLOAD_LOCATION "$ENV{CPM_SOURCE_CACHE}/cpm/CPM_${CPM_DOWNLOAD_VERSION}.cmake")
else()
    set(CPM_DOWNLOAD_LOCATION "${CMAKE_BINARY_DIR}/cmake/CPM_${CPM_DOWNLOAD_VERSION}.cmake")
endif()

# Expand relative path. This is important if the provided path contains a tilde (~)
get_filename_component(CPM_DOWNLOAD_LOCATION ${CPM_DOWNLOAD_LOCATION} ABSOLUTE)

file(DOWNLOAD
    https://github.com/cpm-cmake/CPM.cmake/releases/download/v${CPM_DOWNLOAD_VERSION}/CPM.cmake
    ${CPM_DOWNLOAD_LOCATION} EXPECTED_HASH SHA256=${CPM_HASH_SUM}
    TLS_VERIFY OFF # Sometimes broken in the GitHub Action; we have the checksum to verify that there is nothing malicious going on; try at some point to remove this line
)

include(${CPM_DOWNLOAD_LOCATION})
message("Loaded CPM v${CURRENT_CPM_VERSION}")

########################################################################################################################
# DEPENDENCIES                                                                                                         #
########################################################################################################################

# Pre-fetch qpdf before letterpress does so our options win.
# CPM reuses the first declaration of a package, so this wins over letterpress's
# internal CPMAddPackage call for qpdf@11.9.1.
# The Emscripten compatibility patch is applied by setup.sh (not via PATCHES here,
# because CPM's patch re-application fails when the source is already patched).
CPMAddPackage(
    NAME qpdf
    GITHUB_REPOSITORY qpdf/qpdf
    GIT_TAG v11.9.1
    EXCLUDE_FROM_ALL YES
    OPTIONS
        "USE_IMPLICIT_CRYPTO OFF"
        "REQUIRE_CRYPTO_NATIVE ON"
)


CPMAddPackage(URI "gh:TheMrSheldon/letterpress#7e47107" EXCLUDE_FROM_ALL YES OPTIONS "LP_BUILD_DOCS OFF")

# Workarounds for letterpress + spdlog 1.14 + clang 18 (Emscripten 5.x):
target_compile_definitions(letterpress PRIVATE
    SPDLOG_NO_EXCEPTIONS  # Disables FMT_STRING consteval in SPDLOG_LOGGER_CATCH; safe since Emscripten ignores exceptions
)
target_compile_options(letterpress PRIVATE
    -Wno-narrowing   # dimension.hpp: floating_point * integral -> integral in brace-init (C++23 branch)
)

########################################################################################################################
# TARGET                                                                                                               #
########################################################################################################################
add_executable(letterpress_wasm
    letterpress_wasm.cpp
)
target_compile_features(letterpress_wasm PUBLIC cxx_std_20)
target_compile_options(letterpress_wasm PRIVATE -Os -fexperimental-library)
target_link_options(letterpress_wasm PRIVATE
    -Os
    -sWASM=1
    -sMODULARIZE=1
    -sEXPORT_NAME=LetterPress
    -sFORCE_FILESYSTEM=1
    -sALLOW_MEMORY_GROWTH=1
    -sSTACK_SIZE=4194304
"-sEXPORTED_FUNCTIONS=[_compile,_get_error,_malloc,_free]"
    "-sEXPORTED_RUNTIME_METHODS=[UTF8ToString,stringToNewUTF8,FS]"
    -sUSE_ZLIB=1
    -sUSE_LIBJPEG=1
)

# Embed the standard library AngelScript sources so they can be compiled to
# bytecode at runtime inside WASM (see letterpress_wasm.cpp: ensure_std_lib).
set(LP_LIBRARY_DIR "${CMAKE_BINARY_DIR}/_deps/letterpress-src/library/standard")
if(EXISTS "${LP_LIBRARY_DIR}")
    target_link_options(letterpress_wasm PRIVATE
        "SHELL:--preload-file ${LP_LIBRARY_DIR}@/library/standard"
    )
else()
    message(WARNING "letterpress standard library not found at ${LP_LIBRARY_DIR}; run setup.sh first")
endif()

# Embed the Computer Modern fonts (downloaded by setup.sh from CTAN, same as letterpress's Dockerfile).
set(FONTS_DIR "${CMAKE_SOURCE_DIR}/assets/fonts")
foreach(FONT cmr12.ttf cmbx12.ttf)
    if(EXISTS "${FONTS_DIR}/${FONT}")
        target_link_options(letterpress_wasm PRIVATE
            "SHELL:--preload-file ${FONTS_DIR}/${FONT}@/usr/share/fonts/${FONT}"
        )
    else()
        message(WARNING "${FONT} not found at ${FONTS_DIR}/${FONT}; run setup.sh to download it")
    endif()
endforeach()

target_link_libraries(letterpress_wasm letterpress)
