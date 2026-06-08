/**
 * Svelte reactive layer for the data API.
 *
 * This file is the only place in the UI codebase that imports from $lib/db.
 * It translates async data-API calls into Svelte stores and coordinates
 * editor-specific concerns (pendingLoad, default seeding, active-project
 * persistence).
 *
 * Nothing here is imported by src/lib/db/ — the dependency arrow is one-way.
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { pendingLoad } from '$lib/filesystem';
import * as db from '$lib/db';

// ---------------------------------------------------------------------------
// Default document content (seeded into the demo project on first run)
// ---------------------------------------------------------------------------

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

const DEMO_PROJECT_ID = 'demo';
const LS_ACTIVE_PROJECT = 'lp:project';

// ---------------------------------------------------------------------------
// In-memory state — source of truth for Svelte reactivity
// ---------------------------------------------------------------------------

interface EditorState {
	projectId: string;
	files: db.ProjectFile[];
	activeFileName: string | null;
}

const _state = writable<EditorState>({
	projectId: DEMO_PROJECT_ID,
	files: [],
	activeFileName: null
});

// ---------------------------------------------------------------------------
// Public derived stores (read-only outside this module)
// ---------------------------------------------------------------------------

export const projectFiles = derived(_state, (s) => s.files);
export const activeFileName = derived(_state, (s) => s.activeFileName);
export const currentProjectId = derived(_state, (s) => s.projectId);

// Re-export the types so callers don't need to import from $lib/db directly.
export type { Project, ProjectFile } from '$lib/db';

// ---------------------------------------------------------------------------
// Initialisation — runs once at module load in the browser
// ---------------------------------------------------------------------------

async function init() {
	if (!browser) return;

	// Seed the demo project on the very first run.
	const demo = await db.getProject(DEMO_PROJECT_ID);
	if (!demo) {
		await db.createProject({ id: DEMO_PROJECT_ID, title: 'Demo Project', description: 'A simple Letterpress example.' });
		await db.createFile(DEMO_PROJECT_ID, 'main.lp', DEFAULT_CONTENT);
	}

	// Load whichever project was open last (falling back to demo).
	const storedId = localStorage.getItem(LS_ACTIVE_PROJECT) ?? DEMO_PROJECT_ID;
	const project = await db.getProject(storedId);
	const projectId = project ? storedId : DEMO_PROJECT_ID;

	await _loadProject(projectId);
}

/** Load a project's files into the store and signal the editor. */
async function _loadProject(projectId: string) {
	const files = await db.listFiles(projectId);
	const activeFileName = files[0]?.name ?? null;
	_state.set({ projectId, files, activeFileName });
	if (activeFileName) pendingLoad.set(files[0].content);
}

/** Resolves once the active project's files are loaded and the editor is ready. */
export const projectReady: Promise<void> = init();

// ---------------------------------------------------------------------------
// File-level mutations
// ---------------------------------------------------------------------------

export function setActiveFile(name: string): void {
	const { files } = get(_state);
	const file = files.find((f) => f.name === name);
	if (!file) return;
	_state.update((s) => ({ ...s, activeFileName: name }));
	pendingLoad.set(file.content);
}

export function updateFileContent(name: string, content: string): void {
	const { projectId } = get(_state);
	_state.update((s) => ({
		...s,
		files: s.files.map((f) => (f.name === name ? { ...f, content } : f))
	}));
	db.patchFile(projectId, name, { content });
}

export function createFile(name: string): void {
	const { projectId, files } = get(_state);
	if (files.some((f) => f.name === name)) return;
	const file: db.ProjectFile = { project: projectId, name, content: '' };
	_state.update((s) => ({ ...s, files: [...s.files, file], activeFileName: name }));
	pendingLoad.set('');
	db.createFile(projectId, name, '');
}

export function deleteFile(name: string): void {
	const { projectId } = get(_state);
	_state.update((s) => {
		const files = s.files.filter((f) => f.name !== name);
		const active = s.activeFileName === name ? (files[0]?.name ?? null) : s.activeFileName;
		if (active !== s.activeFileName) setTimeout(() => pendingLoad.set(files[0]?.content ?? ''), 0);
		return { ...s, files, activeFileName: active };
	});
	db.deleteFile(projectId, name);
}

export function renameFile(oldName: string, newName: string): void {
	const { projectId, files } = get(_state);
	if (files.some((f) => f.name === newName)) return;
	_state.update((s) => ({
		...s,
		files: s.files.map((f) => (f.name === oldName ? { ...f, name: newName } : f)),
		activeFileName: s.activeFileName === oldName ? newName : s.activeFileName
	}));
	db.patchFile(projectId, oldName, { name: newName });
}

export function getActiveFile(): db.ProjectFile | null {
	const { files, activeFileName } = get(_state);
	return files.find((f) => f.name === activeFileName) ?? null;
}

// ---------------------------------------------------------------------------
// Project-level mutations (called from the overview page and PDF viewer)
// ---------------------------------------------------------------------------

export async function setActiveProject(projectId: string): Promise<void> {
	await _loadProject(projectId);
	if (browser) localStorage.setItem(LS_ACTIVE_PROJECT, projectId);
}

export async function createProject(title: string, description = ''): Promise<string> {
	const project = await db.createProject({ title, description });
	await db.createFile(project.id, 'main.lp', DEFAULT_CONTENT);
	return project.id;
}

export async function getAllProjects(): Promise<db.Project[]> {
	return db.listProjects();
}

/** Called by the PDF viewer to persist the first-page thumbnail. */
export async function updateProjectPreview(projectId: string, image: Blob): Promise<void> {
	await db.patchProject(projectId, { previewImage: image });
}
