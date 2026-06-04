import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), purgeCss()],
	build: {
		// mupdf uses top-level await, which requires ES2022+.
		target: 'esnext'
	},
	optimizeDeps: {
		exclude: ['mupdf']
	}
});