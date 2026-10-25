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

import React, { useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import type Monaco from '../../models/Monaco';
import { MonacoEditorOptions } from './types';
import { useMonacoLifecycle } from './useMonacoLifecycle';
import { CodeEditorFrame } from '../editorKeyboard/CodeEditorFrame';
import {
	enforceMonacoKeyboardOptions,
	focusMonacoEditor,
	takePendingCodeEditorEnter,
	withEditorKeyboardOptions
} from '../editorKeyboard/monacoKeyboard';

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

function createEditor(
	monaco: Monaco,
	container: HTMLDivElement,
	models: ReturnType<Monaco['editor']['createModel']>[],
	options?: MonacoEditorOptions
) {
	return monaco.editor.create(container, {
		model: models[0],
		automaticLayout: true,
		...options
	});
}

export function MonacoEditor(props: MonacoEditorProps) {
	const { height = '100%', language, defaultLanguage, value = '', theme = 'vs', options, className, sx } = props;
	const resolvedLanguage = language || defaultLanguage || 'plaintext';
	const models = useMemo(() => [{ value, language: resolvedLanguage }], [value, resolvedLanguage]);
	const keyboardOptions = useMemo(() => withEditorKeyboardOptions(options), [options]);
	const frameRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<object>(null);
	const containerRef = useMonacoLifecycle({
		models,
		theme,
		options: keyboardOptions,
		createEditor,
		onReady(editor, monaco) {
			editorRef.current = editor;
			enforceMonacoKeyboardOptions(editor, monaco, () => frameRef.current);
			if (takePendingCodeEditorEnter(frameRef.current)) {
				focusMonacoEditor(editor);
			}
		}
	});

	return (
		<CodeEditorFrame
			frameRef={frameRef}
			height={height}
			className={className}
			sx={sx}
			readOnly={Boolean(options?.readOnly)}
			onActivate={() => {
				if (!editorRef.current) {
					return false;
				}
				focusMonacoEditor(editorRef.current);
				return true;
			}}
		>
			<Box ref={containerRef} sx={{ height: '100%', width: '100%' }} />
		</CodeEditorFrame>
	);
}

export default MonacoEditor;
