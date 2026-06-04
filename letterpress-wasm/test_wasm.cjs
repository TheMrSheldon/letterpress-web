'use strict';
// Standalone Node.js smoke test for the WASM module.
// Useful for quick iteration after a rebuild without running the full test suite.
//
// Usage:
//   cp build/letterpress_wasm.{js,wasm,data} /tmp/
//   cp /tmp/letterpress_wasm.js /tmp/letterpress_wasm.cjs
//   node letterpress-wasm/test_wasm.cjs
const path = require('path');
const fs = require('fs');

const WASM_DIR = '/tmp';
const LetterPress = require(path.join(WASM_DIR, 'letterpress_wasm.cjs'));

const SOURCE = [
	'import standard',
	'doctype Essay {',
	'\ttitle: "Smoke Test"',
	'}',
	'==',
	'Hello World'
].join('\n');

LetterPress({
	locateFile: (f) => path.join(WASM_DIR, f)
})
	.then((lp) => {
		const ptr = lp.stringToNewUTF8(SOURCE);
		const rc = lp._compile(ptr);
		lp._free(ptr);

		if (rc !== 0) {
			const msg = lp.UTF8ToString(lp._get_error());
			process.stderr.write('FAIL: ' + msg + '\n');
			process.exit(1);
		}

		const pdf = lp.FS.readFile('/output.pdf');
		fs.writeFileSync('/tmp/output.pdf', pdf);
		console.log(`OK: ${pdf.byteLength} bytes -> /tmp/output.pdf`);
	})
	.catch((err) => {
		process.stderr.write('FAIL: ' + err + '\n');
		process.exit(1);
	});
