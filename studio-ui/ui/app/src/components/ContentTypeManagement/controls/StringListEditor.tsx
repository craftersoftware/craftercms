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

import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import Tooltip from '@mui/material/Tooltip';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import { type MessageDescriptor, useIntl } from 'react-intl';

export interface StringListEditorProps {
	values: string[];
	onChange: (values: string[]) => void;
	/** Row label. `{index}` is the 1-based row number. */
	itemLabel: MessageDescriptor;
	addLabel: MessageDescriptor;
	/** `{index}` is the 1-based row number. */
	removeLabel: MessageDescriptor;
	maxLength?: number;
}

let rowIdSequence = 0;
function nextRowId(): string {
	rowIdSequence += 1;
	return `string-list-row-${rowIdSequence}`;
}

/** Keep ids already assigned. Each parent-appended row gets the first free `${instanceKey}:${n}`. */
function idsForLength(rowIds: string[], length: number, instanceKey: string): string[] {
	const kept = rowIds.slice(0, length);
	if (kept.length === length) return kept;
	const used = new Set(kept);
	const added: string[] = [];
	for (let index = kept.length; index < length; index++) {
		let n = index;
		let candidate = `${instanceKey}:${n}`;
		while (used.has(candidate)) {
			n += 1;
			candidate = `${instanceKey}:${n}`;
		}
		used.add(candidate);
		added.push(candidate);
	}
	return kept.concat(added);
}

/**
 * Free-text list with add and remove. Callers supply the labels.
 * Row ids stay with the value so removing a middle row does not reuse the next row's DOM.
 */
export function StringListEditor(props: StringListEditorProps) {
	const { values, onChange, itemLabel, addLabel, removeLabel, maxLength } = props;
	const { formatMessage } = useIntl();
	const list = values ?? [];
	// First ids only. Later length changes are derived below, or assigned in the add/remove handlers.
	const [instanceKey] = useState(nextRowId);
	const [rowIds, setRowIds] = useState(() => list.map(() => nextRowId()));
	const inputRefs = useRef(new Map<string, HTMLInputElement>());
	const addButtonRef = useRef<HTMLButtonElement>(null);
	const pendingFocus = useRef<string | 'add' | null>(null);
	// A parent can replace the list without going through add/remove. Adjust before returning so this
	// render's keys already match the list; React retries with that state instead of committing a mismatch.
	let ids = rowIds;
	if (ids.length !== list.length) {
		ids = idsForLength(ids, list.length, instanceKey);
		setRowIds(ids);
	}

	useEffect(() => {
		const pending = pendingFocus.current;
		if (pending == null) return;
		pendingFocus.current = null;
		if (pending === 'add') {
			addButtonRef.current?.focus();
			return;
		}
		inputRefs.current.get(pending)?.focus();
	});

	const handleChange = (index: number, next: string) => {
		const nextArr = list.concat();
		nextArr[index] = next;
		onChange(nextArr);
	};

	const addValue = () => {
		const id = nextRowId();
		setRowIds([...ids, id]);
		// The new input renders before this button. Leave focus here and Tab skips it.
		pendingFocus.current = id;
		onChange([...list, '']);
	};

	const removeValue = (index: number) => {
		const nextIds = ids.filter((_, i) => i !== index);
		setRowIds(nextIds);
		const focusIndex = index < nextIds.length ? index : nextIds.length - 1;
		pendingFocus.current = focusIndex >= 0 ? nextIds[focusIndex] : 'add';
		onChange(list.filter((_, i) => i !== index));
	};

	const addText = formatMessage(addLabel);

	return (
		<>
			{list.map((entry, index) => {
				const id = ids[index];
				const rowNumber = index + 1;
				const rowLabel = formatMessage(itemLabel, { index: rowNumber });
				const removeText = formatMessage(removeLabel, { index: rowNumber });
				return (
					<Box key={id} sx={{ display: 'flex', gap: 2 }}>
						<TextField
							fullWidth
							label={rowLabel}
							value={entry}
							variant="outlined"
							slotProps={{
								htmlInput: { maxLength, 'aria-label': rowLabel }
							}}
							inputRef={(node: HTMLInputElement | null) => {
								if (node) inputRefs.current.set(id, node);
								else inputRefs.current.delete(id);
							}}
							onChange={(e) => handleChange(index, e.currentTarget.value)}
						/>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center'
							}}
						>
							<Tooltip title={removeText}>
								<IconButton aria-label={removeText} onClick={() => removeValue(index)}>
									<RemoveCircleOutlineRoundedIcon />
								</IconButton>
							</Tooltip>
						</Box>
					</Box>
				);
			})}
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center'
				}}
			>
				<Tooltip title={addText}>
					<IconButton ref={addButtonRef} aria-label={addText} onClick={addValue}>
						<AddCircleOutlineRoundedIcon />
					</IconButton>
				</Tooltip>
			</Box>
		</>
	);
}

export default StringListEditor;
