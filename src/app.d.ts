// Emscripten-generated module loader (built to static/, not bundled by Vite)
declare module '/letterpress_wasm.js' {
	interface LetterPressModule {
		_compile(sourcePtr: number): number;
		_get_error(): number;
		_malloc(size: number): number;
		_free(ptr: number): void;
		allocateUTF8(str: string): number;
		UTF8ToString(ptr: number): string;
		FS: {
			readFile(path: string): Uint8Array;
		};
	}
	function LetterPress(opts?: { locateFile?: (filename: string) => string }): Promise<LetterPressModule>;
	export default LetterPress;
}

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
declare namespace App {
	// interface Locals {}
	// interface PageData {}
	// interface Error {}
	// interface Platform {}
}

// File System Access API — not yet in TypeScript's lib.dom.d.ts
interface FilePickerAcceptType {
	description?: string;
	accept: Record<string, string[]>;
}
interface FilePickerOptions {
	types?: FilePickerAcceptType[];
	excludeAcceptAllOption?: boolean;
	id?: string;
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}
interface OpenFilePickerOptions extends FilePickerOptions {
	multiple?: boolean;
}
interface SaveFilePickerOptions extends FilePickerOptions {
	suggestedName?: string;
}
interface Window {
	showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
	showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
