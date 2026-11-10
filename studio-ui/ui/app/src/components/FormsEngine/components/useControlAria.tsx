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

import Box, { type BoxProps } from '@mui/material/Box';
import { useFormControl } from '@mui/material/FormControl';

/**
 * `required` and `aria-invalid` for a control that does not render through InputBase.
 * InputBase, Select, Switch, Checkbox and Radio already read these from FormControl.
 * Call this from a component rendered inside `FormsEngineField`.
 */
export function useControlAria() {
	const { error, required } = useFormControl();
	return {
		'aria-invalid': error ? true : undefined,
		'aria-required': required ? true : undefined
	};
}

/** Wraps a custom control that is not an InputBase, so required and invalid are on the control itself. */
export function FieldAriaGroup(props: BoxProps) {
	const aria = useControlAria();
	return <Box role="group" {...aria} {...props} />;
}
