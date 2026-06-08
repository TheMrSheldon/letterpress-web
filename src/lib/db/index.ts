/**
 * Letterpress data API.
 *
 * This is the sole public surface of the data layer. Everything the rest of
 * the application needs is exported from here; nothing else inside src/lib/db/
 * should be imported directly by outside code.
 *
 * Design contract
 * ───────────────
 * • All functions are async and return plain value objects (DTOs).
 * • No Svelte stores, no SvelteKit imports, no browser-specific globals
 *   are used here — those live in the store layer (project.ts).
 * • The function signatures are intentionally REST-shaped so that this
 *   module could be replaced with fetch()-based calls in the future
 *   without touching any other file.
 *
 *   listProjects()              ←→  GET    /projects
 *   getProject(id)              ←→  GET    /projects/:id
 *   createProject(data)         ←→  POST   /projects
 *   patchProject(id, patch)     ←→  PATCH  /projects/:id
 *   deleteProject(id)           ←→  DELETE /projects/:id
 *
 *   listFiles(projectId)        ←→  GET    /projects/:id/files
 *   getFile(projectId, name)    ←→  GET    /projects/:id/files/:name
 *   createFile(projectId, data) ←→  POST   /projects/:id/files
 *   patchFile(projectId, name)  ←→  PATCH  /projects/:id/files/:name
 *   deleteFile(projectId, name) ←→  DELETE /projects/:id/files/:name
 */

import { getDb } from './driver';
import type { Project, ProjectFile } from './types';

export type { Project, ProjectFile };

// ---------------------------------------------------------------------------
// Blob ↔ Uint8Array helpers (SQLite stores BLOBs as byte arrays)
// ---------------------------------------------------------------------------

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
	return new Uint8Array(await blob.arrayBuffer());
}

function bytesToBlob(bytes: Uint8Array | null | undefined, mime = 'image/png'): Blob | null {
	if (!bytes || bytes.length === 0) return null;
	return new Blob([bytes], { type: mime });
}

// ---------------------------------------------------------------------------
// Row → DTO mappers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProject(r: any): Project {
	return {
		id: r.id as string,
		title: r.title as string,
		description: r.description as string,
		previewImage: bytesToBlob(r.preview)
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFile(r: any): ProjectFile {
	return { project: r.project as string, name: r.name as string, content: r.content as string };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
	const db = await getDb();
	const rows = db.selectObjects('SELECT id, title, description, preview FROM projects ORDER BY rowid');
	return rows.map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
	const db = await getDb();
	const rows = db.selectObjects(
		'SELECT id, title, description, preview FROM projects WHERE id = ?',
		[id]
	);
	return rows.length ? rowToProject(rows[0]) : null;
}

export async function createProject(data: {
	id?: string;
	title: string;
	description?: string;
}): Promise<Project> {
	const db = await getDb();
	const id = data.id ?? crypto.randomUUID();
	const description = data.description ?? '';
	db.exec({
		sql: 'INSERT INTO projects (id, title, description) VALUES (?, ?, ?)',
		bind: [id, data.title, description]
	});
	return { id, title: data.title, description, previewImage: null };
}

export async function patchProject(
	id: string,
	patch: { title?: string; description?: string; previewImage?: Blob | null }
): Promise<void> {
	const db = await getDb();
	if (patch.title !== undefined)
		db.exec({ sql: 'UPDATE projects SET title = ? WHERE id = ?', bind: [patch.title, id] });
	if (patch.description !== undefined)
		db.exec({ sql: 'UPDATE projects SET description = ? WHERE id = ?', bind: [patch.description, id] });
	if ('previewImage' in patch) {
		const bytes = patch.previewImage ? await blobToBytes(patch.previewImage) : null;
		db.exec({ sql: 'UPDATE projects SET preview = ? WHERE id = ?', bind: [bytes, id] });
	}
}

export async function deleteProject(id: string): Promise<void> {
	const db = await getDb();
	// Cascades to files via the FK constraint.
	db.exec({ sql: 'DELETE FROM projects WHERE id = ?', bind: [id] });
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export async function listFiles(projectId: string): Promise<ProjectFile[]> {
	const db = await getDb();
	const rows = db.selectObjects(
		'SELECT project, name, content FROM files WHERE project = ? ORDER BY rowid',
		[projectId]
	);
	return rows.map(rowToFile);
}

export async function getFile(projectId: string, name: string): Promise<ProjectFile | null> {
	const db = await getDb();
	const rows = db.selectObjects(
		'SELECT project, name, content FROM files WHERE project = ? AND name = ?',
		[projectId, name]
	);
	return rows.length ? rowToFile(rows[0]) : null;
}

export async function createFile(
	projectId: string,
	name: string,
	content = ''
): Promise<ProjectFile> {
	const db = await getDb();
	db.exec({
		sql: 'INSERT INTO files (project, name, content) VALUES (?, ?, ?)',
		bind: [projectId, name, content]
	});
	return { project: projectId, name, content };
}

export async function patchFile(
	projectId: string,
	name: string,
	patch: { name?: string; content?: string }
): Promise<ProjectFile> {
	const db = await getDb();
	// Apply field updates in separate statements to keep bindings simple.
	if (patch.content !== undefined)
		db.exec({
			sql: 'UPDATE files SET content = ? WHERE project = ? AND name = ?',
			bind: [patch.content, projectId, name]
		});
	if (patch.name !== undefined && patch.name !== name)
		db.exec({
			sql: 'UPDATE files SET name = ? WHERE project = ? AND name = ?',
			bind: [patch.name, projectId, name]
		});
	const finalName = patch.name ?? name;
	const rows = db.selectObjects(
		'SELECT project, name, content FROM files WHERE project = ? AND name = ?',
		[projectId, finalName]
	);
	return rowToFile(rows[0]);
}

export async function deleteFile(projectId: string, name: string): Promise<void> {
	const db = await getDb();
	db.exec({
		sql: 'DELETE FROM files WHERE project = ? AND name = ?',
		bind: [projectId, name]
	});
}
