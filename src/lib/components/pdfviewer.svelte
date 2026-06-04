<script lang="ts">
	export const ssr = false;

	import { onMount, onDestroy } from 'svelte';
	import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';
	import { pdfObjectUrl, compileError, compiling, compileCurrentDocument } from '$lib/compiler';

	GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

	export let settings: { fillWidth: boolean; scale: number };

	let container: HTMLElement;
	let pageCount = 0;
	let mounted = false;

	async function renderPdf(url: string) {
		if (!container) return;
		while (container.firstChild) container.removeChild(container.firstChild);
		pageCount = 0;

		const pdf = await getDocument(url).promise;
		pageCount = pdf.numPages;
		for (let i = 0; i < pdf.numPages; i++) {
			const canvas = document.createElement('canvas') as HTMLCanvasElement;
			container.appendChild(canvas);
			const page = await pdf.getPage(i + 1);
			const viewport = page.getViewport({ scale: settings.scale });
			const ctx = canvas.getContext('2d')!;
			canvas.height = viewport.height;
			canvas.width = viewport.width;
			await page.render({ canvasContext: ctx, viewport }).promise;
		}
	}

	onMount(() => {
		mounted = true;
	});

	const unsubUrl = pdfObjectUrl.subscribe((url) => {
		if (url && mounted) renderPdf(url);
	});

	onDestroy(() => unsubUrl());
</script>

<div
	style="display: grid; grid-template-rows: auto 1fr; overflow: auto"
	class="w-full bg-gray-50 dark:bg-gray-700"
>
	<div class="px-3 py-2 border-b border-gray-200 dark:border-gray-600 pl-0">
		<div class="flex flex-wrap items-center">
			<div class="flex items-center space-x-1 rtl:space-x-reverse flex-wrap grow">
				<button
					class="py-2 px-5 font-bold text-white rounded-md dark:bg-gray-900 -my-1 disabled:opacity-50"
					on:click={compileCurrentDocument}
					disabled={$compiling}
				>
					{$compiling ? 'Building…' : 'Build'}
				</button>
				<div class="grow"></div>
				{#if $compileError}
					<span class="text-xs text-red-400 truncate max-w-xs" title={$compileError}>
						{$compileError}
					</span>
				{:else}
					<div>
						<input
							style="width: 32px;"
							class="bg-gray-100 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 hover:text-gray-900 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-50 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500 dark:hover:text-white dark:focus:ring-gray-600"
							value="1"
						/>
						/ {pageCount}
					</div>
				{/if}
				<div class="ps-1.5">
					<span class="block w-px h-7 bg-gray-300 dark:bg-gray-600"></span>
				</div>
				<button
					class="flex items-center justify-center rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-900 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-50 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500 dark:hover:text-white dark:focus:ring-gray-600"
					type="button"
				>
					{settings.fillWidth ? 'fit width' : `${settings.scale * 100} %`}
					<svg
						class="-me-0.5 ms-1.5 h-3.5 w-3.5"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="m19 9-7 7-7-7"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
	<div
		class={`overflow-y-scroll flex flex-col ${settings.fillWidth ? 'items-stretch' : 'items-center'} dark:bg-gray-800 gap-y-2`}
		bind:this={container}
	>
		{#if !$pdfObjectUrl && !$compiling}
			<div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
				Press Build to compile the document
			</div>
		{/if}
	</div>
</div>
