<script lang="ts">
	import '../app.postcss';
	import { AppShell, AppBar } from '@skeletonlabs/skeleton';
	import { page } from '$app/stores';
	import { fileName, openFile, saveFile, saveFileAs } from '$lib/filesystem';

	// Highlight JS
	import hljs from 'highlight.js/lib/core';
	import 'highlight.js/styles/github-dark.css';
	import { storeHighlightJs } from '@skeletonlabs/skeleton';
	import xml from 'highlight.js/lib/languages/xml'; // for HTML
	import css from 'highlight.js/lib/languages/css';
	import javascript from 'highlight.js/lib/languages/javascript';
	import typescript from 'highlight.js/lib/languages/typescript';

	hljs.registerLanguage('xml', xml); // for HTML
	hljs.registerLanguage('css', css);
	hljs.registerLanguage('javascript', javascript);
	hljs.registerLanguage('typescript', typescript);
	storeHighlightJs.set(hljs);

	// Floating UI for Popups
	import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
	import { storePopup } from '@skeletonlabs/skeleton';
	storePopup.set({ computePosition, autoUpdate, flip, shift, offset, arrow });

	$: inEditor = $page.url.pathname.startsWith('/editor');
</script>

<!-- App Shell -->
<AppShell>
	<svelte:fragment slot="header">
		<!-- App Bar -->
		<AppBar>
			<svelte:fragment slot="lead">
				<strong class="text-xl uppercase">Letterpress</strong>
				{#if $fileName}
					<span class="ml-3 text-sm text-surface-300 font-mono">{$fileName}</span>
				{/if}
			</svelte:fragment>
			<svelte:fragment slot="trail">
				{#if inEditor}
					<button
						class="btn btn-sm variant-ghost-surface"
						on:click={openFile}
						title="Open file (Ctrl+O)"
					>
						Open
					</button>
					<button
						class="btn btn-sm variant-ghost-surface"
						on:click={saveFile}
						title="Save file (Ctrl+S)"
					>
						Save
					</button>
					<button
						class="btn btn-sm variant-ghost-surface"
						on:click={saveFileAs}
						title="Save as…"
					>
						Save As…
					</button>
				{/if}
			</svelte:fragment>
		</AppBar>
	</svelte:fragment>
	<!-- Page Route Content -->
	<slot />
</AppShell>
