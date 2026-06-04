#include <emscripten/emscripten.h>
#include <letterpress/parser.hpp>
#include <letterpress/pdf/pdfdriver.hpp>
#include <letterpress/scriptengine/scriptengine.hpp>
#include <filesystem>
#include <string>
#include <vector>
#include <cstdio>

static std::string last_error;

// Compile the embedded standard library .as sources to bytecode on first use.
// The .as files are preloaded into MEMFS at /library/standard/ by Emscripten.
// The resulting standard.lpbin is written back to MEMFS so the parser can load it.
static bool std_lib_ready = false;

static bool ensure_std_lib() {
    if (std_lib_ready) return true;

    const std::filesystem::path lib_dir = "/library/standard";
    const std::filesystem::path lpbin   = lib_dir / "standard.lpbin";

    if (std::filesystem::exists(lpbin)) {
        std_lib_ready = true;
        return true;
    }

    try {
        lp::script::ScriptEngine engine;
        engine.init(nullptr);
        std::vector<std::filesystem::path> sources = {
            lib_dir / "book.as",
            lib_dir / "canvas.as",
            lib_dir / "essay.as",
            lib_dir / "standard.as",
        };
        auto module = engine.createModule("standard", sources);
        module.saveToFile(lpbin);
        engine.deinit();
        std_lib_ready = true;
        return true;
    } catch (const std::exception& e) {
        last_error = std::string("Failed to compile standard library: ") + e.what();
        fprintf(stderr, "[letterpress] %s\n", last_error.c_str());
        return false;
    } catch (...) {
        last_error = "Failed to compile standard library: unknown error";
        fprintf(stderr, "[letterpress] %s\n", last_error.c_str());
        return false;
    }
}

extern "C" {

EMSCRIPTEN_KEEPALIVE
int compile(const char* source) {
    last_error.clear();

    if (!ensure_std_lib()) return -1;

    try {
        lp::PDFDriver driver("/output.pdf");
        lp::Parser parser(driver);
        parser.parse(std::string(source), std::vector<std::filesystem::path>{"/library/standard"});
        return 0;
    } catch (const std::exception& e) {
        last_error = e.what();
        fprintf(stderr, "[letterpress] compile error: %s\n", last_error.c_str());
        return -1;
    } catch (...) {
        last_error = "Unknown compilation error";
        fprintf(stderr, "[letterpress] compile error: unknown\n");
        return -1;
    }
}

EMSCRIPTEN_KEEPALIVE
const char* get_error() {
    return last_error.c_str();
}

} // extern "C"
