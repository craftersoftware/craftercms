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

import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import type Monaco from '../../models/Monaco';
import { MonacoDiffEditorOptions } from './types';
import { useMonacoLifecycle } from './useMonacoLifecycle';

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

function createDiffEditor(
	monaco: Monaco,
	container: HTMLDivElement,
	models: ReturnType<Monaco['editor']['createModel']>[],
	options?: MonacoDiffEditorOptions
) {
	const editor = monaco.editor.createDiffEditor(container, {
		automaticLayout: true,
		...options
	});
	editor.setModel({
		original: models[0],
		modified: models[1]
	});
	return editor;
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
	const models = useMemo(
		() => [
			{ value: original, language },
			{ value: modified, language }
		],
		[original, modified, language]
	);
	const containerRef = useMonacoLifecycle({ models, theme, options, createEditor: createDiffEditor });

	return (
		<Box
			ref={containerRef}
			className={[className, 'monaco-workbench'].filter(Boolean).join(' ')}
			sx={{
				height,
				width: '100%',
				...((sx as object) ?? {})
			}}
		/>
	);
}

export default MonacoDiffEditor;
