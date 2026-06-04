<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { pdfBytes, compileError, compiling, compileCurrentDocument } from '$lib/compiler';

	export let settings: { fillWidth: boolean; scale: number };

	let scrollEl: HTMLElement;
	let container: HTMLElement;
	let pageCount = 0;
	let mounted = false;

	// Zoom state — owned internally, seeded from the prop.
	let scale = settings.scale;
	let fitWidth = settings.fillWidth;
	let pageWidthPts = 0;
	let showZoomMenu = false;

	// Viewport-relative coords of the zoom anchor (cursor or centre).
	let anchorViewX = 0;
	let anchorViewY = 0;

	// Middle-mouse pan state.
	let isPanning = false;
	let panStartX = 0, panStartY = 0, panScrollX = 0, panScrollY = 0;

	// Bytes cached so zoom changes can re-render without a new compile.
	let currentBytes: Uint8Array | null = null;
	let renderTimer: ReturnType<typeof setTimeout> | null = null;
	// Scale at which pages were last rasterized — drives the CSS preview.
	let renderScale = scale;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let _mupdf: any = null;
	async function getMupdf() {
		if (!_mupdf) _mupdf = await import('mupdf');
		return _mupdf;
	}

	type LineData = { bbox: number[]; baselineY: number; text: string; size: number };

	const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

	function computeFitScale(): number {
		if (!scrollEl || !pageWidthPts) return scale;
		return Math.max(0.1, (scrollEl.clientWidth - 24) / pageWidthPts);
	}

	// Single debounce helper; wheel zoom passes a shorter delay.
	function scheduleRender(delay = 120) {
		if (renderTimer) clearTimeout(renderTimer);
		renderTimer = setTimeout(() => { if (currentBytes) renderPdf(currentBytes); }, delay);
	}

	function setViewportCenterAnchor() {
		anchorViewX = scrollEl ? scrollEl.clientWidth  / 2 : 0;
		anchorViewY = scrollEl ? scrollEl.clientHeight / 2 : 0;
	}

	function applyScale(s: number) {
		fitWidth = false;
		scale = Math.max(0.25, Math.min(4, s));
		showZoomMenu = false;
		setViewportCenterAnchor();
		scheduleRender();
	}

	function applyFitWidth() {
		fitWidth = true;
		scale = computeFitScale();
		showZoomMenu = false;
		setViewportCenterAnchor();
		scheduleRender();
	}

	// Ctrl+Scroll — passive:false so preventDefault works.
	function onWheel(e: WheelEvent) {
		if (!e.ctrlKey) return;
		e.preventDefault();
		fitWidth = false;
		scale = Math.max(0.25, Math.min(4, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
		if (container && scrollEl) {
			const rect = scrollEl.getBoundingClientRect();
			anchorViewX = Math.max(0, Math.min(scrollEl.clientWidth,  e.clientX - rect.left));
			anchorViewY = Math.max(0, Math.min(scrollEl.clientHeight, e.clientY - rect.top));
			const cx = scrollEl.scrollLeft + anchorViewX;
			const cy = scrollEl.scrollTop  + anchorViewY;
			container.style.transformOrigin = `${cx}px ${cy}px`;
			container.style.transform = `scale(${scale / renderScale})`;
		}
		scheduleRender(100);
	}

	function onMiddleDown(e: MouseEvent) {
		if (e.button !== 1) return;
		e.preventDefault();
		isPanning = true;
		panStartX = e.clientX;
		panStartY = e.clientY;
		panScrollX = scrollEl.scrollLeft;
		panScrollY = scrollEl.scrollTop;
		scrollEl.style.cursor = 'grabbing';
	}

	function onMouseMove(e: MouseEvent) {
		if (!isPanning) return;
		scrollEl.scrollLeft = panScrollX - (e.clientX - panStartX);
		scrollEl.scrollTop  = panScrollY - (e.clientY - panStartY);
	}

	function onMouseUp(e: MouseEvent) {
		if (e.button !== 1 || !isPanning) return;
		isPanning = false;
		scrollEl.style.cursor = '';
	}

	function onDocClick() { showZoomMenu = false; }

	async function renderPdf(bytes: Uint8Array) {
		if (!container) return;

		// Snapshot scroll before clearing so the anchor-based adjustment below
		// can map from pre-render coordinates to post-render coordinates.
		const preScrollLeft  = scrollEl.scrollLeft;
		const preScrollTop   = scrollEl.scrollTop;
		const preRenderScale = renderScale;

		container.style.transform = '';
		while (container.firstChild) container.removeChild(container.firstChild);
		pageCount = 0;

		try {
			const mupdf = await getMupdf();
			const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
			pageCount = doc.countPages();

			if (!pageWidthPts && pageCount > 0) {
				const p0 = doc.loadPage(0);
				const b0: number[] = p0.getBounds();
				pageWidthPts = b0[2] - b0[0];
				p0.destroy();
				if (fitWidth) scale = computeFitScale();
			}

			for (let i = 0; i < pageCount; i++) {
				const page = doc.loadPage(i);
				const matrix = mupdf.Matrix.scale(scale, scale);

				// --- Canvas ---
				const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
				const w = pixmap.getWidth();
				const h = pixmap.getHeight();
				const rgb: Uint8ClampedArray = pixmap.getPixels();
				const rgba = new Uint8ClampedArray(w * h * 4);
				for (let p = 0, q = 0; p < rgb.length; p += 3, q += 4) {
					rgba[q] = rgb[p]; rgba[q + 1] = rgb[p + 1]; rgba[q + 2] = rgb[p + 2]; rgba[q + 3] = 255;
				}
				pixmap.destroy();

				const canvas = document.createElement('canvas');
				canvas.width = w; canvas.height = h; canvas.style.display = 'block';
				canvas.getContext('2d')!.putImageData(new ImageData(rgba, w, h), 0, 0);

				// --- Text layer ---
				const pageBounds: number[] = page.getBounds();
				const pageHeightPts = pageBounds[3] - pageBounds[1];

				const lines: LineData[] = [];
				let cur: LineData | null = null;
				const stext = page.toStructuredText();
				page.destroy();

				stext.walk({
					beginLine(bbox: number[]) { cur = { bbox, baselineY: 0, text: '', size: 10 }; },
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					onChar(c: string, origin: any, _font: any, size: number) {
						if (cur) {
							if (!cur.text.length) cur.baselineY = origin[1];
							cur.text += c;
							cur.size = size;
						}
					},
					endLine() { if (cur?.text.trim()) lines.push(cur); cur = null; }
				});
				stext.destroy();

				const pageDiv = document.createElement('div');
				pageDiv.style.cssText = `position:relative;width:${w}px;height:${h}px;`;
				const textLayer = document.createElement('div');
				textLayer.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;line-height:1;';
				pageDiv.appendChild(canvas);
				pageDiv.appendChild(textLayer);
				container.appendChild(pageDiv);

				// Build spans in three separate passes to avoid forced reflows:
				// 1. create + append (write), 2. measure widths (one reflow), 3. apply scaleX (write).
				const spanTargets: { span: HTMLSpanElement; target: number }[] = [];
				for (const line of lines) {
					const [x0, , x1] = line.bbox;
					const span = document.createElement('span');
					span.textContent = line.text;
					span.style.cssText = `position:absolute;left:${x0 * scale}px;bottom:${(pageHeightPts - line.baselineY) * scale}px;font-size:${line.size * scale}px;line-height:1;color:transparent;white-space:nowrap;cursor:text;transform-origin:0% 100%;`;
					textLayer.appendChild(span);
					spanTargets.push({ span, target: (x1 - x0) * scale });
				}
				// Read all widths in one pass (single reflow).
				const widths = spanTargets.map(({ span }) => span.getBoundingClientRect().width);
				// Write all transforms.
				for (let j = 0; j < spanTargets.length; j++) {
					const { span, target } = spanTargets[j];
					if (widths[j] > 0 && target > 0) span.style.transform = `scaleX(${target / widths[j]})`;
				}
			}

			doc.destroy();

			// Adjust scroll so the anchor point stays fixed after re-rasterising.
			const ratio = scale / preRenderScale;
			if (Math.abs(ratio - 1) > 0.001 && scrollEl) {
				scrollEl.scrollLeft = Math.max(0, (preScrollLeft + anchorViewX) * ratio - anchorViewX);
				scrollEl.scrollTop  = Math.max(0, (preScrollTop  + anchorViewY) * ratio - anchorViewY);
			}
			renderScale = scale;
		} catch (e) {
			console.error('PDF render error:', e);
		}
	}

	let resizeObserver: ResizeObserver | null = null;

	onMount(() => {
		mounted = true;
		scrollEl.addEventListener('wheel', onWheel, { passive: false });
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
		document.addEventListener('click', onDocClick);

		resizeObserver = new ResizeObserver(() => {
			if (fitWidth && pageWidthPts) { scale = computeFitScale(); scheduleRender(); }
		});
		resizeObserver.observe(scrollEl);

		if (currentBytes) renderPdf(currentBytes);
	});

	const unsubBytes = pdfBytes.subscribe((bytes) => {
		currentBytes = bytes;
		if (bytes && mounted) renderPdf(bytes);
	});

	onDestroy(() => {
		if (browser) {
			scrollEl?.removeEventListener('wheel', onWheel);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
			document.removeEventListener('click', onDocClick);
		}
		resizeObserver?.disconnect();
		if (renderTimer) clearTimeout(renderTimer);
		unsubBytes();
	});
</script>

<div
	style="display: grid; grid-template-rows: auto 1fr; overflow: hidden;"
	class="w-full bg-gray-50 dark:bg-gray-700"
>
	<!-- Toolbar -->
	<div class="px-3 py-2 border-b border-gray-200 dark:border-gray-600 pl-0">
		<div class="flex items-center space-x-1 flex-wrap">
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
			{:else if pageCount > 0}
				<span class="text-xs text-gray-400 dark:text-gray-500">1 / {pageCount}</span>
			{/if}
			<div class="ps-1.5">
				<span class="block w-px h-7 bg-gray-300 dark:bg-gray-600"></span>
			</div>
			<!-- Zoom controls -->
			<button
				class="flex items-center justify-center rounded-lg bg-gray-100 px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500 dark:hover:text-white select-none"
				on:click|stopPropagation={() => applyScale(scale / 1.25)}
				title="Zoom out"
			>−</button>
			<div class="relative">
				<button
					class="flex items-center justify-center rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-900 focus:outline-none dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500 dark:hover:text-white min-w-[5rem]"
					on:click|stopPropagation={() => (showZoomMenu = !showZoomMenu)}
					title="Zoom level"
				>
					{fitWidth ? 'Fit Width' : `${Math.round(scale * 100)} %`}
					<svg class="-me-0.5 ms-1.5 h-3.5 w-3.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
					</svg>
				</button>
				{#if showZoomMenu}
					<div
						class="absolute right-0 top-full mt-1 z-50 w-36 rounded-md bg-white dark:bg-gray-700 shadow-lg ring-1 ring-black ring-opacity-10 py-1"
						on:click|stopPropagation
						role="menu"
					>
						<button
							class="w-full text-left px-4 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 {fitWidth ? 'font-semibold' : ''}"
							on:click={applyFitWidth}
						>Fit Width</button>
						<div class="my-1 border-t border-gray-100 dark:border-gray-600"></div>
						{#each ZOOM_PRESETS as z}
							<button
								class="w-full text-left px-4 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 {!fitWidth && Math.round(scale * 100) === Math.round(z * 100) ? 'font-semibold' : ''}"
								on:click={() => applyScale(z)}
							>{Math.round(z * 100)} %</button>
						{/each}
					</div>
				{/if}
			</div>
			<button
				class="flex items-center justify-center rounded-lg bg-gray-100 px-2 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500 dark:hover:text-white select-none"
				on:click|stopPropagation={() => applyScale(scale * 1.25)}
				title="Zoom in"
			>+</button>
		</div>
	</div>

	<!-- Scroll area -->
	<div
		class="overflow-auto dark:bg-gray-800"
		role="region"
		aria-label="PDF viewer"
		bind:this={scrollEl}
		on:mousedown={onMiddleDown}
	>
		{#if !currentBytes && !$compiling}
			<div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
				Press Build to compile the document
			</div>
		{/if}
		<!-- min-width:max-content prevents align-items:center from creating a
		     negative left offset that overflow-auto can never scroll back to. -->
		<div
			class={`flex flex-col py-2 ${fitWidth ? 'items-stretch' : 'items-center'} gap-y-2`}
			style="min-width: max-content"
			bind:this={container}
		></div>
	</div>
</div>
