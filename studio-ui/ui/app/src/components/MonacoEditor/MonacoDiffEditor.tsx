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

import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import { withMonaco } from '../../utils/system';
import type Monaco from '../../models/Monaco';
import { MonacoDiffEditorOptions, normalizeMonacoTheme } from './types';

export interface MonacoDiffEditorProps {
	height?: string | number;
	language?: string;
	original?: string;
	modified?: string;
	theme?: string;
	options?: MonacoDiffEditorOptions;
	className?: string;
	sx?: SxProps<Theme>;
}

export function MonacoDiffEditor(props: MonacoDiffEditorProps) {
	const {
		height = '100%',
		language = 'plaintext',
		original = '',
		modified = '',
		theme = 'vs',
		options,
		className,
		sx
	} = props;
	const containerRef = useRef<HTMLDivElement>(undefined);
	const editorRef = useRef<ReturnType<Monaco['editor']['createDiffEditor']>>(null);
	const monacoRef = useRef<Monaco>(null);
	const originalModelRef = useRef<ReturnType<Monaco['editor']['createModel']>>(null);
	const modifiedModelRef = useRef<ReturnType<Monaco['editor']['createModel']>>(null);
	const propsRef = useRef(props);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		propsRef.current = props;
	});

	useEffect(() => {
		let active = true;
		withMonaco((monaco) => {
			if (!active || !containerRef.current || editorRef.current) {
				return;
			}
			const {
				original: currentOriginal = '',
				modified: currentModified = '',
				language: currentLanguage = 'plaintext',
				theme: currentTheme = 'vs',
				options: currentOptions
			} = propsRef.current;
			monacoRef.current = monaco;
			monaco.editor.setTheme(normalizeMonacoTheme(currentTheme));
			const originalModel = monaco.editor.createModel(currentOriginal, currentLanguage);
			const modifiedModel = monaco.editor.createModel(currentModified, currentLanguage);
			originalModelRef.current = originalModel;
			modifiedModelRef.current = modifiedModel;
			editorRef.current = monaco.editor.createDiffEditor(containerRef.current, {
				automaticLayout: true,
				...currentOptions
			});
			editorRef.current.setModel({
				original: originalModel,
				modified: modifiedModel
			});
			setReady(true);
		});
		return () => {
			active = false;
			editorRef.current?.dispose();
			editorRef.current = null;
			originalModelRef.current?.dispose();
			originalModelRef.current = null;
			modifiedModelRef.current?.dispose();
			modifiedModelRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!ready) {
			return;
		}
		const monaco = monacoRef.current;
		const originalModel = originalModelRef.current;
		const modifiedModel = modifiedModelRef.current;
		if (!monaco || !originalModel || !modifiedModel) {
			return;
		}
		if (originalModel.getValue() !== original) {
			originalModel.setValue(original ?? '');
		}
		if (modifiedModel.getValue() !== modified) {
			modifiedModel.setValue(modified ?? '');
		}
		monaco.editor.setModelLanguage(originalModel, language);
		monaco.editor.setModelLanguage(modifiedModel, language);
	}, [ready, original, modified, language]);

	useEffect(() => {
		if (!ready) {
			return;
		}
		editorRef.current?.updateOptions(options ?? {});
	}, [ready, options]);

	useEffect(() => {
		if (!ready) {
			return;
		}
		monacoRef.current?.editor.setTheme(normalizeMonacoTheme(theme));
	}, [ready, theme]);

	return (
		<Box
			ref={containerRef}
			className={className}
			sx={{
				height,
				width: '100%',
				...((sx as object) ?? {})
			}}
		/>
	);
}

export default MonacoDiffEditor;
