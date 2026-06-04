import { writable } from 'svelte/store';

// Set by project.ts when a file is opened; consumed and cleared by the editor.
export const pendingLoad = writable<string | null>(null);

// Registered by the editor so the explorer can flush unsaved content before switching files.
let _getContent: (() => string) | null = null;
export function registerContentProvider(fn: () => string) {
	_getContent = fn;
}

export function getContent(): string | null {
	return _getContent ? _getContent() : null;
}
