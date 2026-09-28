/// <reference types="vite/client" />
// `ace` and `node` only contribute global types (AceAjax, NodeJS, process), so nothing imports them.
// TypeScript 7 doesn't auto-include `@types` packages hoisted to the workspace root, so reference them explicitly.
/// <reference types="ace" />
/// <reference types="node" />

interface ImportMetaEnv {
	VITE_SHOW_TOOLS_PANEL: string;
	VITE_PREVIEW_LANDING: string;
	VITE_AUTHORING_BASE: string;
	VITE_GUEST_BASE: string;
	/**
	 * Can be used to specify a different entry file other than `main.prod.tsx`
	 * to use for the dev server's `index.html`.
	 */
	VITE_MAIN: string;
}
