import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

export const fileHandle = writable<FileSystemFileHandle | null>(null);
export const fileName = derived(fileHandle, ($h) => $h?.name ?? null);

// Set by openFile(); consumed and cleared by the editor.
export const pendingLoad = writable<string | null>(null);

// Registered by the editor so save can pull current content.
let _getContent: (() => string) | null = null;
export function registerContentProvider(fn: () => string) {
	_getContent = fn;
}

export function getContent(): string | null {
	return _getContent ? _getContent() : null;
}

const PICKER_TYPES: FilePickerAcceptType[] = [
	{ description: 'Letterpress document', accept: { 'text/plain': ['.lp', '.txt'] } }
];

export async function openFile(): Promise<void> {
	if (!browser) return;

	if ('showOpenFilePicker' in window) {
		try {
			const [handle] = await window.showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
			fileHandle.set(handle);
			const file = await handle.getFile();
			pendingLoad.set(await file.text());
		} catch {
			// user cancelled
		}
	} else {
		// Fallback: hidden <input type="file">
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.lp,.txt';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			fileHandle.set(null);
			pendingLoad.set(await file.text());
		};
		input.click();
	}
}

export async function saveFile(): Promise<void> {
	if (!browser || !_getContent) return;
	const content = _getContent();
	const handle = get(fileHandle);

	if (handle) {
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
	} else {
		await saveFileAs();
	}
}

export async function saveFileAs(): Promise<void> {
	if (!browser || !_getContent) return;
	const content = _getContent();

	if ('showSaveFilePicker' in window) {
		try {
			const handle = await window.showSaveFilePicker({
				types: PICKER_TYPES,
				suggestedName: 'document.lp'
			});
			fileHandle.set(handle);
			const writable = await handle.createWritable();
			await writable.write(content);
			await writable.close();
		} catch {
			// user cancelled
		}
	} else {
		// Fallback: trigger a download
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'document.lp';
		a.click();
		URL.revokeObjectURL(url);
	}
}
