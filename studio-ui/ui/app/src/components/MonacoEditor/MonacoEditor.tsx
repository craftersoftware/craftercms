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
import { MonacoEditorOptions, normalizeMonacoTheme } from './types';

export interface MonacoEditorProps {
	height?: string | number;
	language?: string;
	defaultLanguage?: string;
	value?: string;
	theme?: string;
	options?: MonacoEditorOptions;
	className?: string;
	sx?: SxProps<Theme>;
}

export function MonacoEditor(props: MonacoEditorProps) {
	const { height = '100%', language, defaultLanguage, value = '', theme = 'vs', options, className, sx } = props;
	const resolvedLanguage = language || defaultLanguage || 'plaintext';
	const containerRef = useRef<HTMLDivElement>(undefined);
	const editorRef = useRef<ReturnType<Monaco['editor']['create']>>(null);
	const monacoRef = useRef<Monaco>(null);
	const modelRef = useRef<ReturnType<Monaco['editor']['createModel']>>(null);
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
				value: currentValue = '',
				language: currentLanguage,
				defaultLanguage: currentDefaultLanguage,
				theme: currentTheme = 'vs',
				options: currentOptions
			} = propsRef.current;
			const lang = currentLanguage || currentDefaultLanguage || 'plaintext';
			monacoRef.current = monaco;
			monaco.editor.setTheme(normalizeMonacoTheme(currentTheme));
			const model = monaco.editor.createModel(currentValue, lang);
			modelRef.current = model;
			editorRef.current = monaco.editor.create(containerRef.current, {
				model,
				automaticLayout: true,
				...currentOptions
			});
			setReady(true);
		});
		return () => {
			active = false;
			editorRef.current?.dispose();
			editorRef.current = null;
			modelRef.current?.dispose();
			modelRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!ready) {
			return;
		}
		const model = modelRef.current;
		const monaco = monacoRef.current;
		if (!model || !monaco) {
			return;
		}
		if (model.getValue() !== value) {
			model.setValue(value ?? '');
		}
		monaco.editor.setModelLanguage(model, resolvedLanguage);
	}, [ready, value, resolvedLanguage]);

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

export default MonacoEditor;
