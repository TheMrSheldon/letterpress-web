<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { getAllProjects, createProject, setActiveProject, projectReady, type Project } from '$lib/project';

	let projects: Project[] = [];
	let loading = true;

	// New-project form
	let showForm = false;
	let newTitle = '';
	let newDescription = '';
	let submitting = false;

	// Blob → object URL map so preview images can be shown in <img>.
	// Revoked on destroy to avoid memory leaks.
	let previewUrls: Record<string, string> = {};

	onMount(async () => {
		// Ensure seeding is complete before querying the project list.
		await projectReady;
		projects = await getAllProjects();

		const urls: Record<string, string> = {};
		for (const p of projects) {
			if (p.previewImage) urls[p.id] = URL.createObjectURL(p.previewImage);
		}
		previewUrls = urls;
		loading = false;
	});

	onDestroy(() => {
		for (const url of Object.values(previewUrls)) URL.revokeObjectURL(url);
	});

	async function openProject(project: Project) {
		await setActiveProject(project.id);
		goto(`/editor/${project.id}`);
	}

	async function handleCreate() {
		const title = newTitle.trim();
		if (!title || submitting) return;
		submitting = true;
		const id = await createProject(title, newDescription.trim());
		await setActiveProject(id);
		goto(`/editor/${id}`);
	}

	function cancelForm() {
		showForm = false;
		newTitle = '';
		newDescription = '';
	}

	function onFormKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate(); }
		if (e.key === 'Escape') cancelForm();
	}
</script>

<div class="min-h-full bg-gray-900 text-gray-100 p-8">

	<!-- Page header -->
	<div class="max-w-6xl mx-auto">
		<div class="flex items-center justify-between mb-8">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">Projects</h1>
				<p class="text-sm text-gray-400 mt-1">Your Letterpress documents</p>
			</div>
			<button
				class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
				on:click={() => { showForm = true; }}
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14"/>
				</svg>
				New project
			</button>
		</div>

		<!-- New-project form -->
		{#if showForm}
			<div class="mb-8 bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-lg">
				<h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">New project</h2>
				<div class="space-y-3">
					<div>
						<label class="block text-xs text-gray-400 mb-1" for="new-title">Title</label>
						<!-- svelte-ignore a11y-autofocus -->
						<input
							id="new-title"
							autofocus
							bind:value={newTitle}
							on:keydown={onFormKey}
							placeholder="My Project"
							class="w-full bg-gray-900 border border-gray-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
						/>
					</div>
					<div>
						<label class="block text-xs text-gray-400 mb-1" for="new-desc">
							Description <span class="text-gray-600">(optional)</span>
						</label>
						<input
							id="new-desc"
							bind:value={newDescription}
							on:keydown={onFormKey}
							placeholder="A brief description"
							class="w-full bg-gray-900 border border-gray-600 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors"
						/>
					</div>
					<div class="flex gap-2 pt-1">
						<button
							class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
							disabled={!newTitle.trim() || submitting}
							on:click={handleCreate}
						>
							{submitting ? 'Creating…' : 'Create'}
						</button>
						<button
							class="px-4 py-2 text-gray-400 hover:text-white text-sm rounded-lg transition-colors"
							on:click={cancelForm}
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Project grid -->
		{#if loading}
			<div class="flex items-center justify-center py-24 text-gray-500 text-sm">Loading…</div>
		{:else if projects.length === 0}
			<div class="flex flex-col items-center justify-center py-24 text-center">
				<p class="text-gray-500 text-sm mb-4">No projects yet.</p>
				<button
					class="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
					on:click={() => { showForm = true; }}
				>Create your first project →</button>
			</div>
		{:else}
			<ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
				{#each projects as project (project.id)}
					<li>
						<button
							class="group w-full text-left bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl overflow-hidden transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
							on:click={() => openProject(project)}
						>
							<!-- Preview image — A4 aspect ratio -->
							<div class="relative w-full bg-gray-900 overflow-hidden" style="aspect-ratio: 210 / 297;">
								{#if previewUrls[project.id]}
									<img
										src={previewUrls[project.id]}
										alt="Preview of {project.title}"
										class="absolute inset-0 w-full h-full object-cover object-top"
									/>
								{:else}
									<!-- Placeholder: faint ruled lines suggesting a document -->
									<div class="absolute inset-0 flex flex-col justify-start p-4 opacity-20">
										{#each Array(12) as _, i}
											<div
												class="rounded-full bg-gray-400 mb-2"
												style="height:2px; width:{i === 0 ? 70 : i % 4 === 0 ? 55 : 90}%"
											></div>
										{/each}
									</div>
									<div class="absolute inset-0 flex items-center justify-center">
										<span class="text-gray-600 text-xs font-mono">no preview</span>
									</div>
								{/if}
							</div>

							<!-- Card footer -->
							<div class="px-4 py-3">
								<p class="text-sm font-semibold text-gray-100 truncate group-hover:text-white transition-colors">
									{project.title}
								</p>
								{#if project.description}
									<p class="text-xs text-gray-500 mt-0.5 truncate">{project.description}</p>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
