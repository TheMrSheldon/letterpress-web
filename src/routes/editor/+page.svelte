<script lang="ts">
	export const ssr = false;

	import Editor from '$lib/components/editor.svelte';
	import PDFViewer from '$lib/components/pdfviewer.svelte';
	import Logs from '$lib/components/logs.svelte';

	var tmp = 2;
</script>

<div class="flex flex-col h-full" style="overflow: hidden;">
	<div
		id="pcontent"
		class="grow overflow-y-auto gap-1 bg-gray-50 dark:bg-gray-700"
		style="display: grid;"
	>
		<Editor></Editor>
		<PDFViewer url="helloworld.pdf" settings={{ fillWidth: true, scale: tmp }}></PDFViewer>
		<Logs></Logs>
	</div>
</div>

<style lang="postcss">
	#pcontent {
		grid-template-areas:
			'editor viewer'
			'logs logs';
		grid-template-columns: 0.75fr 1fr;
		grid-template-rows: 1fr auto;
	}
	#pcontent > :global(:nth-child(1)) {
		grid-area: editor;
	}
	#pcontent > :global(:nth-child(2)) {
		grid-area: viewer;
	}
	#pcontent > :global(:nth-child(3)) {
		grid-area: logs;
	}
	:global(#page-content) {
		overflow: auto;
	}
</style>
