import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { pendingLoad } from './filesystem';

export interface ProjectFile {
	name: string;
	content: string;
}

interface ProjectState {
	files: ProjectFile[];
	activeFileName: string | null;
}

// Default document for a fresh project.
const DEFAULT_CONTENT = `\
import standard
doctype Essay {
	papersize: a4,
	fontsize: 12,
	title: "A Simple Example",
	author: [ "Jane Doe", "John Everyman" ],
	institute: [ "Institute A", "Institute B" ],
	date: "\\today"
}
==

\\maketitle

\\section{A Section Heading}
Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore
magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd
gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing
elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et
accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit
amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et
dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd
gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.

Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat
nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis
dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh
euismod tincidunt ut laoreet dolore magna aliquam erat volutpat.


\\paragraph{A paragraph} Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut
aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie
consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit
praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi.
`;

const STORAGE_KEY = 'lp:demo:files';

const DEFAULT_STATE: ProjectState = {
	files: [{ name: 'main.lp', content: DEFAULT_CONTENT }],
	activeFileName: 'main.lp'
};

function loadState(): ProjectState {
	if (!browser) return DEFAULT_STATE;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_STATE;
		const parsed = JSON.parse(raw) as ProjectState;
		if (!Array.isArray(parsed.files) || parsed.files.length === 0) return DEFAULT_STATE;
		return parsed;
	} catch {
		return DEFAULT_STATE;
	}
}

// ---------------------------------------------------------------------------
// Internal state — all mutations go through the exported helpers below.
// ---------------------------------------------------------------------------
const _state = writable<ProjectState>(loadState());

// Persist every state change to localStorage.
_state.subscribe((s) => {
	if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
});

// ---------------------------------------------------------------------------
// Public read-only derived stores
// ---------------------------------------------------------------------------

/** The ordered list of project files. */
export const projectFiles = derived(_state, (s) => s.files);

/** The name of the currently open file (null if no files exist). */
export const activeFileName = derived(_state, (s) => s.activeFileName);

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Open a file: makes it active and signals the editor to load its content. */
export function setActiveFile(name: string): void {
	const state = get(_state);
	const file = state.files.find((f) => f.name === name);
	if (!file) return;
	_state.update((s) => ({ ...s, activeFileName: name }));
	pendingLoad.set(file.content);
}

/** Persist the current editor content for a named file (called by the editor on change). */
export function updateFileContent(name: string, content: string): void {
	_state.update((s) => ({
		...s,
		files: s.files.map((f) => (f.name === name ? { ...f, content } : f))
	}));
}

/** Add a new empty file and open it immediately. No-op if the name already exists. */
export function createFile(name: string): void {
	if (get(_state).files.some((f) => f.name === name)) return;
	_state.update((s) => ({
		...s,
		files: [...s.files, { name, content: '' }],
		activeFileName: name
	}));
	pendingLoad.set('');
}

/**
 * Delete a file. If it was the active file, the first remaining file is opened.
 * Opening the fallback file is deferred so the store update commits first.
 */
export function deleteFile(name: string): void {
	_state.update((s) => {
		const files = s.files.filter((f) => f.name !== name);
		let activeFileName = s.activeFileName;

		if (activeFileName === name) {
			activeFileName = files[0]?.name ?? null;
			const fallbackContent = files[0]?.content ?? '';
			setTimeout(() => pendingLoad.set(fallbackContent), 0);
		}

		return { ...s, files, activeFileName };
	});
}

/** Rename a file. No-op if newName already exists. Keeps the file active if it was. */
export function renameFile(oldName: string, newName: string): void {
	if (get(_state).files.some((f) => f.name === newName)) return;
	_state.update((s) => ({
		...s,
		files: s.files.map((f) => (f.name === oldName ? { ...f, name: newName } : f)),
		activeFileName: s.activeFileName === oldName ? newName : s.activeFileName
	}));
}

/** Return the currently active ProjectFile, or null. */
export function getActiveFile(): ProjectFile | null {
	const s = get(_state);
	return s.files.find((f) => f.name === s.activeFileName) ?? null;
}
