/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import EnhancedDialog, { EnhancedDialogProps } from '../EnhancedDialog';
import React, { useEffect, useId, useRef, useState } from 'react';
import FormsEngine, { FormsEngineProps } from './FormsEngine';
import { dialogClasses } from '@mui/material/Dialog';
import { FormsEngineDialogContext } from './lib/formsEngineContext';

export interface FormsEngineDialogProps extends EnhancedDialogProps {
	formProps: FormsEngineProps;
}

export function FormsEngineDialog(props: FormsEngineDialogProps) {
	const { formProps, ...rest } = props;
	const titleId = useId();

	const [disableEnforceFocus, setDisableEnforceFocus] = useState(false);
	const stableFormsEngineDialogContextRef = useRef(undefined);
	if (!stableFormsEngineDialogContextRef.current) {
		stableFormsEngineDialogContextRef.current = {
			disableEnforceFocus,
			setDisableEnforceFocus
		};
	}
	// Keep context value in sync with state
	useEffect(() => {
		stableFormsEngineDialogContextRef.current.disableEnforceFocus = disableEnforceFocus;
	}, [disableEnforceFocus]);

	return (
		<EnhancedDialog
			sx={{
				[`& > .${dialogClasses.container} > .${dialogClasses.paper}`]: {
					height: '100vh'
				}
			}}
			aria-labelledby={titleId}
			{...rest}
			omitHeader
			maxWidth="xl"
			title="Content Form"
			data-area-id="forms-engine-dialog-root"
			disableEnforceFocus={disableEnforceFocus} // This allows TinyMCE popups to gain focus (e.g. code editor, needs focus to be able to type in it)
		>
			<FormsEngineDialogContext.Provider value={stableFormsEngineDialogContextRef.current}>
				<FormsEngine
					onMinimize={props.onMinimize}
					onFullScreen={props.onFullScreen}
					onCancelFullScreen={props.onCancelFullScreen}
					{...formProps}
					titleId={titleId}
					isDialog
				/>
			</FormsEngineDialogContext.Provider>
		</EnhancedDialog>
	);
}

export default FormsEngineDialog;
