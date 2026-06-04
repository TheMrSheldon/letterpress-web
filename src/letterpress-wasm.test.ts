// @vitest-environment node
// Integration test: compiles a Letterpress document via the WASM module and
// verifies that a valid PDF is produced.
//
// Requires the WASM artifacts to be present in static/ (run `npm run build`
// or `bash letterpress-wasm/build.sh` first).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '..', 'static');
// The Emscripten output is UMD (module.exports = LetterPress).  Node.js treats
// .js files under this package as ESM because package.json has "type":"module".
// Copying to .cjs forces CommonJS loading so createRequire can load it.
const CJS_COPY = path.join(STATIC_DIR, '_letterpress_wasm_test.cjs');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lp: any;

describe('letterpress WASM', { timeout: 120_000 }, () => {
	beforeAll(async () => {
		const wasmJs = path.join(STATIC_DIR, 'letterpress_wasm.js');
		if (!fs.existsSync(wasmJs)) {
			throw new Error(
				`WASM artifacts not found at ${STATIC_DIR}. ` +
					'Run `bash letterpress-wasm/build.sh` first.'
			);
		}
		fs.copyFileSync(wasmJs, CJS_COPY);
		const require = createRequire(import.meta.url);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const factory: (opts: any) => Promise<any> = require(CJS_COPY);
		lp = await factory({
			locateFile: (f: string) => path.join(STATIC_DIR, f),
			printErr: () => {} // silence WASM stderr in test output
		});
	});

	afterAll(() => {
		try {
			fs.unlinkSync(CJS_COPY);
		} catch {
			/* ignore */
		}
	});

	it('compiles a minimal essay document to a valid PDF', () => {
		const source = [
			'import standard',
			'doctype Essay {',
			'\ttitle: "Integration Test"',
			'}',
			'==',
			'Hello World'
		].join('\n');

		const ptr: number = lp.stringToNewUTF8(source);
		const rc: number = lp._compile(ptr);
		lp._free(ptr);

		expect(rc, lp.UTF8ToString(lp._get_error())).toBe(0);

		const pdf: Uint8Array = lp.FS.readFile('/output.pdf');
		expect(pdf.byteLength).toBeGreaterThan(1000);
		// Verify PDF magic bytes: %PDF
		expect(pdf[0]).toBe(0x25); // %
		expect(pdf[1]).toBe(0x50); // P
		expect(pdf[2]).toBe(0x44); // D
		expect(pdf[3]).toBe(0x46); // F
	});
});
