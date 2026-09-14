/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import React from 'react';
import { FileDiff } from '../../models/Repository';
import useMediaQuery from '@mui/material/useMediaQuery';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import { MonacoDiffEditor } from '../MonacoEditor';

export interface SplitViewProps {
	diff: FileDiff;
	className?: string;
	sx?: SxProps<Theme>;
}

export function ConflictedPathDiffDialogSplitView(props: SplitViewProps) {
	const { diff, className, sx } = props;
	const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

	return (
		<MonacoDiffEditor
			className={className}
			sx={sx}
			height="100%"
			language="plaintext"
			original={diff?.studioVersion ?? ''}
			modified={diff?.remoteVersion ?? ''}
			theme={prefersDarkMode ? 'vs-dark' : 'vs'}
			options={{
				readOnly: true,
				automaticLayout: true,
				scrollbar: { alwaysConsumeMouseWheel: false },
				// Monaco editor has a breakpoint for split view; decrease it for the current dialog
				renderSideBySideInlineBreakpoint: 300
			}}
		/>
	);
}

export default ConflictedPathDiffDialogSplitView;
