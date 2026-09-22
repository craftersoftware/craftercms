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
import { useIntl } from 'react-intl';
import translations from './translations';
import { CodeEditorDialogContainer } from './CodeEditorDialogContainer';
import { CodeEditorDialogProps } from './utils';
import EnhancedDialog from '../EnhancedDialog';

export function CodeEditorDialog(props: CodeEditorDialogProps) {
	const { formatMessage } = useIntl();
	const {
		mode = 'text',
		path,
		readonly,
		contentType,
		isNew,
		associateTemplateOnSave,
		onSuccess,
		onClose,
		onMinimize,
		onFullScreen,
		...rest
	} = props;
	const title = formatMessage(translations.title);
	return (
		<EnhancedDialog
			title={title}
			omitHeader
			maxWidth={false}
			slotProps={{
				paper: {
					sx: [
						!props.isFullScreen && {
							width: '90%',
							height: '90vh'
						}
					]
				}
			}}
			onMinimize={onMinimize}
			onClose={onClose}
			{...rest}
		>
			<CodeEditorDialogContainer
				path={path}
				mode={mode}
				title={title}
				onMinimize={onMinimize}
				readonly={readonly}
				contentType={contentType}
				isNew={isNew}
				associateTemplateOnSave={associateTemplateOnSave}
				onClose={onClose}
				onFullScreen={props.isFullScreen ? props.onCancelFullScreen : props.onFullScreen}
				onSuccess={onSuccess}
			/>
		</EnhancedDialog>
	);
}

export default CodeEditorDialog;
