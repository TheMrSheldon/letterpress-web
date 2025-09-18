cmake_minimum_required(VERSION 3.8)

project(letterpress_wasm)
#if (NOT EMSCRIPTEN)
#    message(FATAL_ERROR "Please compile using emcmake")
#endif()

add_executable(calc calc.cpp calc.hpp)

set_target_properties(calc PROPERTIES SUFFIX ".wasm")
set_target_properties(calc PROPERTIES COMPILE_FLAGS "-Os -s SIDE_MODULE=1")
set_target_properties(calc PROPERTIES LINK_FLAGS    "-Os -s WASM=1 -s SIDE_MODULE=1 -s STANDALONE_WASM --no-entry")


# Populate find_package-compatible variables for ZLIB
set(ZLIB_FOUND TRUE)
set(ZLIB_INCLUDE_DIRS "")
set(ZLIB_LIBRARIES "-sUSE_ZLIB=1")
set(ZLIB_LIBRARY "-sUSE_ZLIB=1")

set(USE_FLAGS "-sUSE_ZLIB=1")

include(FetchContent)
# Set options before FetchContent_MakeAvailable()
#set(ZLIB_TEST ON)
#FetchContent_Declare(
#    zlib-cmake
#    URL https://github.com/jimmy-park/zlib-cmake/archive/main.tar.gz
#)


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
#FetchContent_Declare(jpeg_turbo GIT_REPOSITORY https://github.com/libjpeg-turbo/libjpeg-turbo.git GIT_TAG 3.1.2)
#FetchContent_MakeAvailable(jpeg_turbo)
#set(JPEG_FOUND TRUE)

CPMAddPackage(URI "gh:libjpeg-turbo/libjpeg-turbo#3.1.2"
    #PATCHES qpdf-wasm/patches/jpeg-turbo.patch
    EXCLUDE_FROM_ALL YES DOWNLOAD_ONLY YES
)
CPMAddPackage(URI "gh:TheMrSheldon/letterpress#master" EXCLUDE_FROM_ALL YES OPTIONS "LP_BUILD_DOCS OFF")

########################################################################################################################
# TARGET                                                                                                               #
########################################################################################################################
add_executable(letterpress_wasm
    letterpress_wasm.cpp
)
set_target_properties(letterpress_wasm PROPERTIES SUFFIX ".wasm")
set_target_properties(letterpress_wasm PROPERTIES COMPILE_FLAGS "-Os -s SIDE_MODULE=1 -fexperimental-library")
set_target_properties(letterpress_wasm PROPERTIES LINK_FLAGS "-Os -s WASM=1 -s SIDE_MODULE=1 -s STANDALONE_WASM --no-entry")

target_compile_features(letterpress_wasm PUBLIC cxx_std_20)

target_link_libraries(letterpress_wasm letterpress)