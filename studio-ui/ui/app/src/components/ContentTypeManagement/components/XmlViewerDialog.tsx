/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { EnhancedDialog, EnhancedDialogProps } from '../../EnhancedDialog';
import { DialogBody } from '../../DialogBody';
import { MonacoEditor } from '../../MonacoEditor';
import React from 'react';
import useIsDarkModeTheme from '../../../hooks/useIsDarkModeTheme';

export interface XmlViewerDialogProps extends EnhancedDialogProps {
	xml: string;
}

export function XmlViewerDialogBody(props: XmlViewerDialogProps) {
	const { xml } = props;
	const isDark = useIsDarkModeTheme();
	return (
		xml && (
			<DialogBody>
				<MonacoEditor
					height="90vh"
					defaultLanguage="xml"
					value={xml}
					theme={isDark ? 'vs-dark' : 'vs'}
					options={{ readOnly: true, scrollBeyondLastLine: false }}
				/>
			</DialogBody>
		)
	);
}

export function XmlViewerDialog(props: XmlViewerDialogProps) {
	const { xml, ...dialogProps } = props;
	return (
		<EnhancedDialog title="View XML" {...dialogProps} maxWidth="xl">
			<XmlViewerDialogBody xml={xml} {...dialogProps} />
		</EnhancedDialog>
	);
}
