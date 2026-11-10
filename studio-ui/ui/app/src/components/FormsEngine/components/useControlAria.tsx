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

import React, { createContext, useContext, useId, type ReactNode } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import { useFormControl } from '@mui/material/FormControl';
import { visuallyHidden } from '@mui/utils';
import { FormattedMessage } from 'react-intl';

/** The field label id, plus description ids the group must keep (help text, error). */
export type FieldDescribedBy = {
	labelId?: string;
	describedByIds?: string[];
};

const FieldDescribedByContext = createContext<FieldDescribedBy>({});

export function FieldDescribedByProvider({ value, children }: { value: FieldDescribedBy; children: ReactNode }) {
	return <FieldDescribedByContext.Provider value={value}>{children}</FieldDescribedByContext.Provider>;
}

function mergeDescribedBy(ids: Array<string | undefined>): string | undefined {
	const parts = ids.flatMap((id) => (id ? id.split(/\s+/).filter(Boolean) : []));
	const unique = [...new Set(parts)];
	return unique.length ? unique.join(' ') : undefined;
}

/**
 * Accessible name and state for a custom control that does not render through InputBase.
 * InputBase, Select, Switch, Checkbox and Radio already read these from FormControl.
 * Call this from a component rendered inside `FormsEngineField`.
 */
export function useControlAria(describedBy?: string) {
	// aria-required isn't allowed on role=group, so required reaches AT via the group's description.
	const { error, required } = useFormControl() ?? {};
	const { labelId, describedByIds } = useContext(FieldDescribedByContext);
	const requiredId = useId();
	return {
		'aria-invalid': error ? true : undefined,
		'aria-labelledby': labelId || undefined,
		'aria-describedby': mergeDescribedBy([describedBy, describedByIds?.join(' '), required ? requiredId : undefined]),
		requiredId: required ? requiredId : undefined
	};
}

function RequiredCue({ id }: { id: string }) {
	return (
		<Box component="span" id={id} aria-hidden sx={visuallyHidden}>
			<FormattedMessage defaultMessage="Required" />
		</Box>
	);
}

function Group({ describedBy, children, ...props }: BoxProps & { describedBy?: string }) {
	const aria = useControlAria(typeof describedBy === 'string' ? describedBy : undefined);
	return (
		<Box
			{...props}
			role="group"
			aria-invalid={aria['aria-invalid']}
			aria-labelledby={aria['aria-labelledby']}
			aria-describedby={aria['aria-describedby']}
		>
			{aria.requiredId && <RequiredCue id={aria.requiredId} />}
			{children}
		</Box>
	);
}

/** Wraps a custom control that is not an InputBase. The group is named by the field label. */
export function FieldAriaGroup({ 'aria-describedby': describedBy, ...props }: BoxProps) {
	return <Group describedBy={describedBy} {...props} />;
}
