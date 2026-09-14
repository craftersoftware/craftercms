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
import { MonacoDiffEditor } from '../../MonacoEditor';
import React from 'react';
import useIsDarkModeTheme from '../../../hooks/useIsDarkModeTheme';

export interface XmlDiffDialogProps extends EnhancedDialogProps {
	initialXml: string;
	currentXml: string;
}

export function XmlDiffDialogBody(props: XmlDiffDialogProps) {
	const { initialXml, currentXml } = props;
	const isDark = useIsDarkModeTheme();
	return (
		initialXml &&
		currentXml && (
			<DialogBody>
				<MonacoDiffEditor
					height="90vh"
					language="xml"
					original={initialXml}
					modified={currentXml}
					theme={isDark ? 'vs-dark' : 'vs'}
					options={{ readOnly: true, scrollBeyondLastLine: false }}
				/>
			</DialogBody>
		)
	);
}

export function XmlDiffDialog(props: XmlDiffDialogProps) {
	const { initialXml, currentXml, ...dialogProps } = props;
	return (
		<EnhancedDialog title="XML diff" {...dialogProps} maxWidth="xl">
			<XmlDiffDialogBody initialXml={initialXml} currentXml={currentXml} {...dialogProps} />
		</EnhancedDialog>
	);
}
