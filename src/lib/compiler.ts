import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { base } from '$app/paths';
import { getContent } from '$lib/filesystem';

export const pdfObjectUrl = writable<string | null>(null);
export const compileError = writable<string | null>(null);
export const compiling = writable(false);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _lpModule: any = null;
let _prevObjectUrl: string | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadModule(): Promise<any> {
	if (_lpModule) return _lpModule;
	// Load via script tag to avoid Vite's static import analysis.
	// The Emscripten output lives in static/ and is not bundled.
	if (!(window as Window & { LetterPress?: unknown }).LetterPress) {
		await new Promise<void>((resolve, reject) => {
			const s = document.createElement('script');
			s.src = base + '/letterpress_wasm.js';
			s.onload = () => resolve();
			s.onerror = () => reject(new Error('Failed to load letterpress_wasm.js'));
			document.head.appendChild(s);
		});
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	_lpModule = await (window as any).LetterPress({ locateFile: (f: string) => base + '/' + f });
	return _lpModule;
}

export async function compileCurrentDocument(): Promise<void> {
	if (!browser) return;
	const source = getContent();
	if (source === null) return;

	compiling.set(true);
	compileError.set(null);

	try {
		const mod = await loadModule();

		const ptr: number = mod.stringToNewUTF8(source);
		const result: number = mod._compile(ptr);
		mod._free(ptr);

		if (result !== 0) {
			const errPtr: number = mod._get_error();
			compileError.set(mod.UTF8ToString(errPtr) || 'Compilation failed');
			return;
		}

		const bytes = mod.FS.readFile('/output.pdf') as Uint8Array<ArrayBuffer>;
		if (_prevObjectUrl) URL.revokeObjectURL(_prevObjectUrl);
		const blob = new Blob([bytes], { type: 'application/pdf' });
		_prevObjectUrl = URL.createObjectURL(blob);
		pdfObjectUrl.set(_prevObjectUrl);
	} catch (e) {
		compileError.set(String(e));
	} finally {
		compiling.set(false);
	}
}
