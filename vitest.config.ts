import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Per-file environment overrides via @vitest-environment comments are honoured.
		// Default environment for most tests (e.g. index.test.ts) remains jsdom-like
		// via the SvelteKit vite plugin; the WASM integration test sets its own env.
		globals: false
	}
});
