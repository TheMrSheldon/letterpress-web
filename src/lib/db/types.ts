/**
 * Data-transfer objects for the letterpress data layer.
 *
 * These are plain value types with no framework dependencies.
 * They are the only types that cross the boundary between the
 * data API and the rest of the application.
 */

export interface Project {
	id: string;
	title: string;
	description: string;
	/** Thumbnail of the first page; null until the document has been compiled. */
	previewImage: Blob | null;
}

export interface ProjectFile {
	project: string;
	name: string;
	content: string;
}
