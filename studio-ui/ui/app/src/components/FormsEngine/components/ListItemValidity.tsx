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

import React, { type ReactNode } from 'react';
import ListItemText, { type ListItemTextProps } from '@mui/material/ListItemText';
import { useAtomValue } from 'jotai';
import { useStableFormContext } from '../lib/formsEngineContext';
import { listItemValidityAtom } from '../lib/formUtils';

export type ListItemValidityProps = {
	fieldId: string;
	itemKey: string;
	primary: ReactNode;
	secondary?: ReactNode;
	slotProps?: ListItemTextProps['slotProps'];
};

/**
 * Per-row validity chrome for node-selector and repeat lists. Subscribes only to this item's derived validity atom,
 * so other rows and the control body do not re-render when another item's status flips. Invalid rows use the error
 * colour on the text. Shows the normal colour while loading or when the item is valid.
 */
export function ListItemValidity({ fieldId, itemKey, primary, secondary, slotProps }: ListItemValidityProps) {
	const validationAtom = useStableFormContext().atoms.validationByFieldId[fieldId];
	const invalid = useAtomValue(listItemValidityAtom(validationAtom, itemKey));
	return (
		<ListItemText
			primary={primary}
			secondary={secondary}
			slotProps={slotProps}
			sx={invalid ? { color: 'error.main', '& .MuiListItemText-secondary': { color: 'inherit' } } : undefined}
		/>
	);
}

export default ListItemValidity;
