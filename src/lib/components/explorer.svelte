<script lang="ts">
	import {
		projectFiles,
		activeFileName,
		setActiveFile,
		createFile,
		deleteFile,
		renameFile,
		updateFileContent
	} from '$lib/project';
	import { getContent } from '$lib/filesystem';

	// ---------------------------------------------------------------------------
	// New-file creation state
	// ---------------------------------------------------------------------------
	let creatingFile = false;
	let newFileName = '';
	let newFileInput: HTMLInputElement;

	function startCreating(): void {
		creatingFile = true;
		newFileName = '';
		// Focus the input after Svelte renders it.
		setTimeout(() => newFileInput?.focus(), 0);
	}

	function confirmCreate(): void {
		const name = normalizeName(newFileName.trim());
		if (!name || $projectFiles.some((f) => f.name === name)) return;
		createFile(name);
		creatingFile = false;
		newFileName = '';
	}

	function cancelCreate(): void {
		creatingFile = false;
		newFileName = '';
	}

	function handleCreateKey(e: KeyboardEvent): void {
		if (e.key === 'Enter') confirmCreate();
		else if (e.key === 'Escape') cancelCreate();
	}

	// ---------------------------------------------------------------------------
	// Rename state
	// ---------------------------------------------------------------------------
	let renamingFile: string | null = null;
	let renameValue = '';
	let renameInput: HTMLInputElement;

	function startRenaming(name: string): void {
		renamingFile = name;
		renameValue = name;
		setTimeout(() => renameInput?.focus(), 0);
	}

	function confirmRename(): void {
		if (!renamingFile) return;
		const name = normalizeName(renameValue.trim());
		if (name && name !== renamingFile && !$projectFiles.some((f) => f.name === name)) {
			renameFile(renamingFile, name);
		}
		renamingFile = null;
		renameValue = '';
	}

	function cancelRename(): void {
		renamingFile = null;
		renameValue = '';
	}

	function handleRenameKey(e: KeyboardEvent): void {
		if (e.key === 'Enter') confirmRename();
		else if (e.key === 'Escape') cancelRename();
	}

	// ---------------------------------------------------------------------------
	// File switching — flush the editor's current content before switching so
	// any unsaved keystrokes are not lost.
	// ---------------------------------------------------------------------------
	function openFile(name: string): void {
		const current = $activeFileName;
		if (current && current !== name) {
			const content = getContent();
			if (content !== null) updateFileContent(current, content);
		}
		setActiveFile(name);
	}

	function handleDelete(name: string): void {
		if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
		deleteFile(name);
	}

	// Append .lp if the user did not provide an extension.
	function normalizeName(name: string): string {
		if (!name) return '';
		return name.includes('.') ? name : `${name}.lp`;
	}
</script>

<div class="flex h-full w-full flex-col bg-gray-800 text-gray-300 text-sm select-none">
	<!-- Header -->
	<div class="flex items-center justify-between px-3 py-2 border-b border-gray-700">
		<span class="text-xs font-semibold uppercase tracking-wider text-gray-400">demo</span>
		<button
			class="text-gray-400 hover:text-white transition-colors leading-none px-1"
			title="New file"
			on:click={startCreating}
		>
			+
		</button>
	</div>

	<!-- File list -->
	<ul class="flex-1 overflow-y-auto py-1">
		{#each $projectFiles as file (file.name)}
			<li
				class="group flex items-center gap-1 px-2 py-1 cursor-pointer rounded mx-1
					{$activeFileName === file.name
					? 'bg-gray-600 text-white'
					: 'hover:bg-gray-700 text-gray-300'}"
			>
				{#if renamingFile === file.name}
					<!-- Inline rename input -->
					<input
						bind:this={renameInput}
						bind:value={renameValue}
						on:keydown={handleRenameKey}
						on:blur={confirmRename}
						class="flex-1 min-w-0 bg-gray-900 text-white text-sm px-1 rounded outline-none
							border border-blue-500 font-mono"
					/>
				{:else}
					<!-- File icon + name -->
					<button
						class="flex-1 min-w-0 text-left font-mono truncate"
						on:click={() => openFile(file.name)}
					>
						<span class="text-gray-500 mr-1 text-xs">&#x1F4C4;</span>{file.name}
					</button>

					<!-- Action buttons — visible on row hover -->
					<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
						<button
							class="p-0.5 rounded hover:bg-gray-500 hover:text-white transition-colors"
							title="Rename"
							on:click|stopPropagation={() => startRenaming(file.name)}
						>
							<!-- Pencil icon -->
							<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
								<path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
							</svg>
						</button>
						<button
							class="p-0.5 rounded hover:bg-red-600 hover:text-white transition-colors"
							title="Delete"
							on:click|stopPropagation={() => handleDelete(file.name)}
						>
							<!-- Trash icon -->
							<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
							</svg>
						</button>
					</div>
				{/if}
			</li>
		{/each}

		{#if creatingFile}
			<li class="flex items-center gap-1 px-2 py-1 mx-1">
				<input
					bind:this={newFileInput}
					bind:value={newFileName}
					on:keydown={handleCreateKey}
					placeholder="filename.lp"
					class="flex-1 min-w-0 bg-gray-900 text-white text-sm px-1 rounded outline-none
						border border-blue-500 font-mono"
				/>
				<button
					class="p-0.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white shrink-0"
					title="Confirm"
					on:click={confirmCreate}
				>
					<!-- Checkmark -->
					<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
				</button>
				<button
					class="p-0.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white shrink-0"
					title="Cancel"
					on:click={cancelCreate}
				>
					<!-- X mark -->
					<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</button>
			</li>
		{/if}
	</ul>
</div>
