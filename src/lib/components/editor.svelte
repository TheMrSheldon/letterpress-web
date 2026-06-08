<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';
	import { pendingLoad, registerContentProvider } from '$lib/filesystem';
	import { compileCurrentDocument } from '$lib/compiler';
	import { activeFileName, projectFiles, updateFileContent } from '$lib/project';
	import { get } from 'svelte/store';

	let editor: Monaco.editor.IStandaloneCodeEditor;
	let monaco: typeof Monaco;
	let editorContainer: HTMLElement;
	let unsubLoad: (() => void) | undefined;
	let compileTimer: ReturnType<typeof setTimeout> | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		monaco = (await import('../monaco')).default;

		editor = monaco.editor.create(editorContainer, {
			theme: 'letterpress',
			automaticLayout: true,
			language: 'letterpress'
		});

		// Load the active project file's content as the initial document.
		const initialName = get(activeFileName);
		const initialContent =
			get(projectFiles).find((f) => f.name === initialName)?.content ?? '';
		editor.getModel()?.setValue(initialContent);

		registerContentProvider(() => editor.getValue());

		unsubLoad = pendingLoad.subscribe((content) => {
			if (content !== null && editor) {
				editor.getModel()?.setValue(content);
				pendingLoad.set(null);
			}
		});

		// Ctrl+B / Cmd+B to build.
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => compileCurrentDocument());

		// Auto-recompile 50 ms after the last keystroke; auto-save to project store after 500 ms.
		editor.onDidChangeModelContent(() => {
			if (compileTimer) clearTimeout(compileTimer);
			compileTimer = setTimeout(() => compileCurrentDocument(), 50);

			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				const name = get(activeFileName);
				if (name) updateFileContent(name, editor.getValue());
			}, 500);
		});

		// Build once on initial load so the viewer shows the default document.
		compileCurrentDocument();
	});

	onDestroy(() => {
		if (compileTimer) clearTimeout(compileTimer);
		if (saveTimer) clearTimeout(saveTimer);
		unsubLoad?.();
		monaco?.editor.getModels().forEach((model) => model.dispose());
		editor?.dispose();
	});

	// Wraps the current selection in before/after, or inserts before + placeholder + after at cursor.
	function wrapSelection(before: string, after: string, placeholder = '...') {
		if (!editor) return;
		const sel = editor.getSelection();
		if (!sel) return;
		const selected = editor.getModel()?.getValueInRange(sel) ?? '';
		editor.executeEdits('toolbar', [{ range: sel, text: before + (selected || placeholder) + after }]);
		editor.focus();
	}

	// Inserts text at the cursor, replacing any selection.
	function insertAt(text: string) {
		if (!editor) return;
		const sel = editor.getSelection();
		if (!sel) return;
		editor.executeEdits('toolbar', [{ range: sel, text }]);
		editor.focus();
	}
</script>

<div
	style="display: grid; grid-template-rows: auto 1fr; overflow: hidden;"
	class="w-full h-full bg-gray-50 dark:bg-gray-700"
>
	<div class="px-3 py-2">
		<div class="flex items-center space-x-1 rtl:space-x-reverse flex-wrap">

			<!-- ── Text formatting ─────────────────────────────────────────────────
			     \bf, \it, \st, \ul: pending engine implementation; buttons insert
			     correct markup now so documents stay valid once support lands.      -->

			<!-- Bold (\bf{...}) -->
			<button
				type="button"
				title="\bf&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('\\bf{', '}')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5h4.5a3.5 3.5 0 1 1 0 7H8m0-7v7m0-7H6m2 7h6.5a3.5 3.5 0 1 1 0 7H8m0-7v7m0 0H6"/>
				</svg>
				<span class="sr-only">Bold</span>
			</button>

			<!-- Italic (\it{...}) -->
			<button
				type="button"
				title="\it&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('\\it{', '}')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8.874 19 6.143-14M6 19h6.33m-.66-14H18"/>
				</svg>
				<span class="sr-only">Italic</span>
			</button>

			<!-- Underline (\ul{...}) -->
			<button
				type="button"
				title="\ul&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('\\ul{', '}')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 19h12M8 5v9a4 4 0 0 0 8 0V5M6 5h4m4 0h4"/>
				</svg>
				<span class="sr-only">Underline</span>
			</button>

			<!-- Strikethrough (\st{...}) -->
			<button
				type="button"
				title="\st&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('\\st{', '}')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 6.2V5h12v1.2M7 19h6m.2-14-1.677 6.523M9.6 19l1.029-4M5 5l6.523 6.523M19 19l-7.477-7.477"/>
				</svg>
				<span class="sr-only">Strikethrough</span>
			</button>

			<div class="px-1"><span class="block w-px h-4 bg-gray-300 dark:bg-gray-600"></span></div>

			<!-- ── Math & scripts ──────────────────────────────────────────────── -->

			<!-- Inline math ($...$) -->
			<button
				type="button"
				title="Inline math  $...$"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('$', '$')}
			>
				<span class="w-5 h-5 flex items-center justify-center font-mono text-xs leading-none" aria-hidden="true">$x$</span>
				<span class="sr-only">Inline math</span>
			</button>

			<!-- Display math ($$...$$) -->
			<button
				type="button"
				title="Display math  $$...$$"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('$$\n', '\n$$')}
			>
				<span class="w-5 h-5 flex items-center justify-center font-mono text-xs leading-none" aria-hidden="true">$$</span>
				<span class="sr-only">Display math</span>
			</button>

			<!-- Superscript (^{...}) -->
			<button
				type="button"
				title="Superscript  ^&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('^{', '}')}
			>
				<span class="w-5 h-5 flex items-center justify-center font-mono text-xs leading-none" aria-hidden="true">x&#178;</span>
				<span class="sr-only">Superscript</span>
			</button>

			<!-- Subscript (_{...}) -->
			<button
				type="button"
				title="Subscript  _&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('_{', '}')}
			>
				<span class="w-5 h-5 flex items-center justify-center font-mono text-xs leading-none" aria-hidden="true">x&#8322;</span>
				<span class="sr-only">Subscript</span>
			</button>

			<div class="px-1"><span class="block w-px h-4 bg-gray-300 dark:bg-gray-600"></span></div>

			<!-- ── Headings ─────────────────────────────────────────────────────── -->

			<!-- Chapter (\chapter{...}) — Book doctype only -->
			<button
				type="button"
				title="\chapter&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('\\chapter{', '}')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<!-- Plain H — top-level heading with no number -->
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 4v16M5 12h14M19 4v16"/>
				</svg>
				<span class="sr-only">Chapter</span>
			</button>

			<!-- Section (\section{...}) -->
			<button
				type="button"
				title="\section&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('\\section{', '}')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<!-- H1 -->
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 4v16M5 12h7M12 4v16M18 7l-2 1.5V17"/>
				</svg>
				<span class="sr-only">Section</span>
			</button>

			<!-- Subsection (\subsection{...}) -->
			<button
				type="button"
				title="\subsection&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('\\subsection{', '}')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<!-- H2 -->
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 4v16M5 12h7M12 4v16M17 9a2 2 0 0 1 4 0c0 2-4 3-4 5h4"/>
				</svg>
				<span class="sr-only">Subsection</span>
			</button>

			<!-- Paragraph (\paragraph{...}) -->
			<button
				type="button"
				title="\paragraph&#123;...&#125;"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('\\paragraph{', '}')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<!-- Pilcrow ¶ -->
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5v14M10 5h8a4 4 0 0 1 0 8h-4M18 5v8"/>
				</svg>
				<span class="sr-only">Paragraph</span>
			</button>

			<div class="px-1"><span class="block w-px h-4 bg-gray-300 dark:bg-gray-600"></span></div>

			<!-- ── Alignment ───────────────────────────────────────────────────── -->

			<!-- Justify ([justify>]...[<justify]) -->
			<button
				type="button"
				title="Justified  [justify>]...[&lt;justify]"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('[justify>]\n    ', '\n[<justify]')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6h12M6 10h12M6 14h12M6 18h8"/>
				</svg>
				<span class="sr-only">Justified</span>
			</button>

			<!-- Centered ([center>]...[<center]) -->
			<button
				type="button"
				title="Centered  [center>]...[&lt;center]"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('[center>]\n    ', '\n[<center]')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 6h8M6 10h12M8 14h8M6 18h12"/>
				</svg>
				<span class="sr-only">Centered</span>
			</button>

			<!-- Ragged right / left-aligned ([raggedright>]...[<raggedright]) -->
			<button
				type="button"
				title="Ragged right  [raggedright>]...[&lt;raggedright]"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('[raggedright>]\n    ', '\n[<raggedright]')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6h8m-8 4h12M6 14h8m-8 4h12"/>
				</svg>
				<span class="sr-only">Ragged right</span>
			</button>

			<!-- Ragged left / right-aligned ([raggedleft>]...[<raggedleft]) -->
			<button
				type="button"
				title="Ragged left  [raggedleft>]...[&lt;raggedleft]"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('[raggedleft>]\n    ', '\n[<raggedleft]')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6h-8m8 4H6m12 4h-8m8 4H6"/>
				</svg>
				<span class="sr-only">Ragged left</span>
			</button>

			<div class="px-1"><span class="block w-px h-4 bg-gray-300 dark:bg-gray-600"></span></div>

			<!-- ── Lists — unlinked: no list environments in current build ────── -->

			<!-- Unordered list -->
			<button
				type="button"
				title="Unordered list (not yet available)"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 8h10M9 12h10M9 16h10M4.99 8H5m-.02 4h.01m0 4H5"/>
				</svg>
				<span class="sr-only">Unordered list</span>
			</button>

			<!-- Ordered list -->
			<button
				type="button"
				title="Ordered list (not yet available)"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6h8m-8 6h8m-8 6h8M4 16a2 2 0 1 1 3.321 1.5L4 20h5M4 5l2-1v6m-2 0h4"/>
				</svg>
				<span class="sr-only">Ordered list</span>
			</button>

			<div class="px-1"><span class="block w-px h-4 bg-gray-300 dark:bg-gray-600"></span></div>

			<!-- ── Environments ──────────────────────────────────────────────────── -->

			<!-- Generic environment block ([env>]...[<env]) -->
			<button
				type="button"
				title="Environment block  [name>]...[&lt;name]"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('[env>]\n    ', '\n[<env]')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 8-4 4 4 4m8 0 4-4-4-4"/>
				</svg>
				<span class="sr-only">Environment block</span>
			</button>

			<!-- Picture environment ([picture>]...[<picture]) -->
			<button
				type="button"
				title="Picture environment  [picture>]...[&lt;picture]"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('[picture>]\n    ', '\n[<picture]')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
					<path fill-rule="evenodd" d="M13 10a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H14a1 1 0 0 1-1-1Z" clip-rule="evenodd"/>
					<path fill-rule="evenodd" d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12c0 .556-.227 1.06-.593 1.422A.999.999 0 0 1 20.5 20H4a2.002 2.002 0 0 1-2-2V6Zm6.892 12 3.833-5.356-3.99-4.322a1 1 0 0 0-1.549.097L4 12.879V6h16v9.95l-3.257-3.619a1 1 0 0 0-1.557.088L11.2 18H8.892Z" clip-rule="evenodd"/>
				</svg>
				<span class="sr-only">Picture environment</span>
			</button>

			<!-- Table environment ([table>]...[<table]) -->
			<button
				type="button"
				title="Table environment  [table>]...[&lt;table]"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => wrapSelection('[table>]\n    ', '\n[<table]')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6h18v12H3V6zm0 4h18M3 14h18M10 6v12"/>
				</svg>
				<span class="sr-only">Table environment</span>
			</button>

			<div class="px-1"><span class="block w-px h-4 bg-gray-300 dark:bg-gray-600"></span></div>

			<!-- ── Typography & insertions ─────────────────────────────────────── -->

			<!-- En dash (--) -->
			<button
				type="button"
				title="En dash  --"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => insertAt('--')}
			>
				<span class="w-5 h-5 flex items-center justify-center text-base leading-none select-none" aria-hidden="true">&#8211;</span>
				<span class="sr-only">En dash</span>
			</button>

			<!-- Em dash (---) -->
			<button
				type="button"
				title="Em dash  ---"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => insertAt('---')}
			>
				<span class="w-5 h-5 flex items-center justify-center text-base leading-none select-none" aria-hidden="true">&#8212;</span>
				<span class="sr-only">Em dash</span>
			</button>

			<!-- \maketitle -->
			<button
				type="button"
				title="\maketitle"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => insertAt('\\maketitle')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<!-- Document with centred title lines -->
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 5h10M7 11h10M8 15h8"/>
				</svg>
				<span class="sr-only">maketitle</span>
			</button>

			<!-- \hfill -->
			<button
				type="button"
				title="\hfill"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
				on:click={() => insertAt('\\hfill')}
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<!-- Horizontal expand arrows -->
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12h16M4 12l3-3m-3 3 3 3M20 12l-3-3m3 3-3 3"/>
				</svg>
				<span class="sr-only">hfill</span>
			</button>

			<!-- \today — unlinked: only meaningful in preamble context -->
			<button
				type="button"
				title="\today (preamble only)"
				class="p-1.5 text-gray-500 rounded-sm cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600"
			>
				<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
					<!-- Calendar with a day marker -->
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5h16v14H4V5zm0 4h16M9 3v2m6-2v2M9 13h2v2H9v-2z"/>
				</svg>
				<span class="sr-only">today</span>
			</button>

		</div>
	</div>

	<!-- Monaco editor fills the remaining space -->
	<div bind:this={editorContainer}></div>
</div>
