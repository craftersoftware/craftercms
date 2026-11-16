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

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import visuallyHidden from '@mui/utils/visuallyHidden';

export interface FormValidationLiveRegionHandle {
	announce(message: string): void;
}

/**
 * Form-level polite live region. The message state lives here, not in the form orchestrator, so an
 * announcement re-renders only this element and never the form body or its fields.
 */
export const FormValidationLiveRegion = forwardRef<FormValidationLiveRegionHandle>(
	function FormValidationLiveRegion(_props, ref) {
		const [message, setMessage] = useState('');
		const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
		useImperativeHandle(
			ref,
			() => ({
				announce(next: string) {
					setMessage('');
					if (timer.current) clearTimeout(timer.current);
					// Clear first so a repeated message still changes the live region's text.
					timer.current = setTimeout(() => setMessage(next), 40);
				}
			}),
			[]
		);
		useEffect(
			() => () => {
				if (timer.current) clearTimeout(timer.current);
			},
			[]
		);
		return (
			<Box role="status" aria-live="polite" aria-atomic="true" sx={visuallyHidden}>
				{message}
			</Box>
		);
	}
);

export default FormValidationLiveRegion;
