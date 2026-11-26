/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { useEffect, useRef, useState } from 'react';
import { withMonaco } from '../../utils/system';
import type Monaco from '../../models/Monaco';
import { normalizeMonacoTheme } from './types';
import { enforceMonacoKeyboardOptions } from '../editorKeyboard/monacoKeyboard';
// The editor itself (`window.monaco`) is loaded at runtime by `withMonaco`, but the codicon font that build ships is
// emitted corrupt (a few bytes of JS instead of the TTF), which breaks the icons of the search widget, the diff editor
// and others. Monaco falls back to this valid @font-face, so only the font CSS is bundled, not the editor. The app declares
// the same monaco-editor version as ui/npm-content (which builds window.monaco) so the font matches the editor's codicon set.
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
type MonacoModel = ReturnType<Monaco['editor']['createModel']>;

interface MonacoModelDefinition {
	value: string;
	language: string;
}

interface MonacoEditorInstance<TOptions> {
	dispose(): void;
	updateOptions(options: TOptions): void;
}

interface UseMonacoLifecycleOptions<TEditor extends MonacoEditorInstance<TOptions>, TOptions> {
	models: MonacoModelDefinition[];
	theme: string;
	options?: TOptions;
	createEditor(monaco: Monaco, container: HTMLDivElement, models: MonacoModel[], options?: TOptions): TEditor;
	/** Called once after the editor is created. */
	onReady?(editor: TEditor, monaco: Monaco): void;
}

export function useMonacoLifecycle<TEditor extends MonacoEditorInstance<TOptions>, TOptions>({
	models,
	theme,
	options,
	createEditor,
	onReady
}: UseMonacoLifecycleOptions<TEditor, TOptions>) {
	const containerRef = useRef<HTMLDivElement>(undefined);
	const editorRef = useRef<TEditor>(null);
	const monacoRef = useRef<Monaco>(null);
	const modelRefs = useRef<MonacoModel[]>([]);
	const lifecycleOptionsRef = useRef({ models, theme, options, createEditor, onReady });
	const [ready, setReady] = useState(false);

	useEffect(() => {
		lifecycleOptionsRef.current = { models, theme, options, createEditor, onReady };
	});

	useEffect(() => {
		let active = true;
		withMonaco((monaco) => {
			if (!active || !containerRef.current || editorRef.current) {
				return;
			}
			const current = lifecycleOptionsRef.current;
			monacoRef.current = monaco;
			monaco.editor.setTheme(normalizeMonacoTheme(current.theme));
			const editorModels = current.models.map(({ value, language }) => monaco.editor.createModel(value, language));
			modelRefs.current = editorModels;
			editorRef.current = current.createEditor(monaco, containerRef.current, editorModels, current.options);
			current.onReady?.(editorRef.current, monaco);
			setReady(true);
		});
		return () => {
			active = false;
			editorRef.current?.dispose();
			editorRef.current = null;
			modelRefs.current.forEach((model) => model.dispose());
			modelRefs.current = [];
		};
	}, []);

	useEffect(() => {
		if (!ready || !monacoRef.current) {
			return;
		}
		modelRefs.current.forEach((model, index) => {
			const definition = models[index];
			if (!definition) {
				return;
			}
			if (model.getValue() !== definition.value) {
				model.setValue(definition.value);
			}
			monacoRef.current.editor.setModelLanguage(model, definition.language);
		});
	}, [ready, models]);

	useEffect(() => {
		if (ready) {
			editorRef.current?.updateOptions(options ?? ({} as TOptions));
			// Diff editor options do not always forward tabIndex to both textareas.
			enforceMonacoKeyboardOptions(editorRef.current);
		}
	}, [ready, options]);

	useEffect(() => {
		if (ready) {
			monacoRef.current?.editor.setTheme(normalizeMonacoTheme(theme));
		}
	}, [ready, theme]);

	return containerRef;
}
