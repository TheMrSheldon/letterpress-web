<script lang="ts">
	export const ssr = false;

	import { Pane, Splitpanes } from 'svelte-splitpanes';
	import Editor from '$lib/components/editor.svelte';
	import PDFViewer from '$lib/components/pdfviewer.svelte';
	import Logs from '$lib/components/logs.svelte';

	var tmp = 2;
</script>

<!--div class="flex flex-col h-full" style="overflow: hidden;">
	<div
		id="pcontent"
		class="grow overflow-y-auto gap-1 bg-gray-50 dark:bg-gray-700"
		style="display: grid;"
	>
		<Editor></Editor>
		<PDFViewer url="helloworld.pdf" settings={{ fillWidth: true, scale: tmp }}></PDFViewer>
		<Logs></Logs>
	</div>
</div-->

<Splitpanes style="overflow: hidden;" horizontal theme="lptheme">
	<Pane>
		<Splitpanes theme="lptheme">
			<!--Pane>Explorer</Pane-->
			<Pane size={60} class="flex"><Editor /></Pane>
			<Pane size={40} class="flex"
				><PDFViewer url="helloworld.pdf" settings={{ fillWidth: true, scale: tmp }} /></Pane
			>
		</Splitpanes>
	</Pane>
	<Pane size={0} class="flex"><Logs /></Pane>
</Splitpanes>

<style global lang="postcss">
	:global(#page-content) {
		overflow: auto;
	}

	:global(.splitpanes.lptheme) :global(.splitpanes__pane) {
		background-color: rgb(55 65 81);
	}
	:global(.splitpanes.lptheme) :global(.splitpanes__splitter) {
		background-color: rgb(55 65 81);
		box-sizing: border-box;
		position: relative;
		flex-shrink: 0;
	}
	:global(.splitpanes.lptheme) :global(.splitpanes__splitter:before),
	:global(.splitpanes.lptheme) :global(.splitpanes__splitter:after) {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		background-color: rgba(0, 0, 0, 0.15);
		transition: background-color 0.3s;
	}
	:global(.splitpanes.lptheme) :global(.splitpanes__splitter:hover:before),
	:global(.splitpanes.lptheme) :global(.splitpanes__splitter:hover:after) {
		background-color: rgba(0, 0, 0, 0.25);
	}
	:global(.splitpanes.lptheme) :global(.splitpanes__splitter:first-child) {
		cursor: auto;
	}

	:global(.lptheme.splitpanes) :global(.splitpanes) :global(.splitpanes__splitter) {
		z-index: 1;
	}
	:global(.lptheme.splitpanes--vertical) > :global(.splitpanes__splitter),
	:global(.lptheme) :global(.splitpanes--vertical) > :global(.splitpanes__splitter) {
		width: 7px;
		border-left: 1px solid rgb(55 65 81);
		cursor: col-resize;
	}
	:global(.lptheme.splitpanes--vertical) > :global(.splitpanes__splitter:before),
	:global(.lptheme.splitpanes--vertical) > :global(.splitpanes__splitter:after),
	:global(.lptheme) :global(.splitpanes--vertical) > :global(.splitpanes__splitter:before),
	:global(.lptheme) :global(.splitpanes--vertical) > :global(.splitpanes__splitter:after) {
		transform: translateY(-50%);
		width: 1px;
		height: 30px;
	}
	:global(.lptheme.splitpanes--vertical) > :global(.splitpanes__splitter:before),
	:global(.lptheme) :global(.splitpanes--vertical) > :global(.splitpanes__splitter:before) {
		margin-left: -2px;
	}
	:global(.lptheme.splitpanes--vertical) > :global(.splitpanes__splitter:after),
	:global(.lptheme) :global(.splitpanes--vertical) > :global(.splitpanes__splitter:after) {
		margin-left: 1px;
	}
	:global(.lptheme.splitpanes--horizontal) > :global(.splitpanes__splitter),
	:global(.lptheme) :global(.splitpanes--horizontal) > :global(.splitpanes__splitter) {
		height: 7px;
		border-top: 1px solid rgb(55 65 81);
		cursor: row-resize;
	}
	:global(.lptheme.splitpanes--horizontal) > :global(.splitpanes__splitter:before),
	:global(.lptheme.splitpanes--horizontal) > :global(.splitpanes__splitter:after),
	:global(.lptheme) :global(.splitpanes--horizontal) > :global(.splitpanes__splitter:before),
	:global(.lptheme) :global(.splitpanes--horizontal) > :global(.splitpanes__splitter:after) {
		transform: translateX(-50%);
		width: 30px;
		height: 1px;
	}
	:global(.lptheme.splitpanes--horizontal) > :global(.splitpanes__splitter:before),
	:global(.lptheme) :global(.splitpanes--horizontal) > :global(.splitpanes__splitter:before) {
		margin-top: -2px;
	}
	:global(.lptheme.splitpanes--horizontal) > :global(.splitpanes__splitter:after),
	:global(.lptheme) :global(.splitpanes--horizontal) > :global(.splitpanes__splitter:after) {
		margin-top: 1px;
	}

	:global(div.splitpanes--horizontal.splitpanes--dragging) {
		cursor: row-resize;
	}

	:global(div.splitpanes--vertical.splitpanes--dragging) {
		cursor: col-resize;
	}

	:global(.splitpanes) {
		display: flex;
		width: 100%;
		height: 100%;
	}
	:global(.splitpanes--vertical) {
		flex-direction: row;
	}
	:global(.splitpanes--horizontal) {
		flex-direction: column;
	}
	:global(.splitpanes--dragging) :global(*) {
		user-select: none;
	}
	:global(.splitpanes__pane) {
		width: 100%;
		height: 100%;
		overflow: hidden;
		/** Add also a direct child selector, for dealing with specifity of nested splitpanes transition.
    This issue was happening in the examples on nested splitpanes, vertical inside horizontal.
    I think it's better to keep also the previous CSS selector for (potential) old browser compatibility.
  */
	}
	:global(.splitpanes--vertical) :global(.splitpanes__pane) {
		transition: width 0.2s ease-out;
	}
	:global(.splitpanes--horizontal) :global(.splitpanes__pane) {
		transition: height 0.2s ease-out;
	}
	:global(.splitpanes--vertical) > :global(.splitpanes__pane) {
		transition: width 0.2s ease-out;
	}
	:global(.splitpanes--horizontal) > :global(.splitpanes__pane) {
		transition: height 0.2s ease-out;
	}
	:global(.splitpanes--dragging) :global(.splitpanes__pane) {
		transition: none;
		pointer-events: none;
	}
	:global(.splitpanes--freeze) :global(.splitpanes__pane) {
		transition: none;
	}
	:global(.splitpanes__splitter) {
		touch-action: none;
	}
	:global(.splitpanes--vertical) > :global(.splitpanes__splitter) {
		min-width: 1px;
	}
	:global(.splitpanes--horizontal) > :global(.splitpanes__splitter) {
		min-height: 1px;
	}
</style>
