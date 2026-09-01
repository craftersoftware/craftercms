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
import './useWorker';
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
}

export function useMonacoLifecycle<TEditor extends MonacoEditorInstance<TOptions>, TOptions>({
	models,
	theme,
	options,
	createEditor
}: UseMonacoLifecycleOptions<TEditor, TOptions>) {
	const containerRef = useRef<HTMLDivElement>(undefined);
	const editorRef = useRef<TEditor>(null);
	const monacoRef = useRef<Monaco>(null);
	const modelRefs = useRef<MonacoModel[]>([]);
	const lifecycleOptionsRef = useRef({ models, theme, options, createEditor });
	const [ready, setReady] = useState(false);

	useEffect(() => {
		lifecycleOptionsRef.current = { models, theme, options, createEditor };
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
		}
	}, [ready, options]);

	useEffect(() => {
		if (ready) {
			monacoRef.current?.editor.setTheme(normalizeMonacoTheme(theme));
		}
	}, [ready, theme]);

	return containerRef;
}
