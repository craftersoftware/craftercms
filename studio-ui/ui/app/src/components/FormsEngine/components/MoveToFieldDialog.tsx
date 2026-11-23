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

import Dialog from '@mui/material/Dialog';
import { DialogHeader } from '../../DialogHeader';
import { DialogBody } from '../../DialogBody';
import { DialogFooter } from '../../DialogFooter';
import SecondaryButton from '../../SecondaryButton';
import PrimaryButton from '../../PrimaryButton';
import { FormattedMessage, useIntl } from 'react-intl';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { EmptyState } from '../../EmptyState';
import { useEffect, useId, useMemo, useState } from 'react';
import InsertPositionPicker from '../../ContentTypeManagement/components/InsertPositionPicker';
import type { NodeSelectorMoveTarget, NodeSelectorMoveTargetReason } from '../lib/nodeSelectorMoveTargets';
import type { NodeSelectorItem } from '../controls/NodeSelector';

export interface MoveToFieldDialogProps {
	open: boolean;
	itemLabel: string;
	targets: NodeSelectorMoveTarget[];
	onClose(): void;
	/** Called when the user accepts a destination and insert position. */
	onAccept?(target: NodeSelectorMoveTarget, targetIndex: number): void;
}

function targetKey(target: NodeSelectorMoveTarget): string {
	return `${target.modelId}::${target.fieldId}`;
}

function reasonMessage(reason: NodeSelectorMoveTargetReason) {
	switch (reason) {
		case 'maxCount':
			return <FormattedMessage defaultMessage="Field is full" />;
		case 'duplicate':
			return <FormattedMessage defaultMessage="Item is already in this field" />;
		case 'readonly':
			return <FormattedMessage defaultMessage="Field is read-only" />;
	}
}

function itemPickerLabel(item: NodeSelectorItem): string {
	return item.value || item.include || String(item.key);
}

export function MoveToFieldDialogBody(props: MoveToFieldDialogProps) {
	const { itemLabel, targets, onClose, onAccept } = props;
	const { formatMessage } = useIntl();
	const destinationLabelId = useId();
	const enabledTargets = useMemo(() => targets.filter((target) => !target.disabled), [targets]);
	const [selectedKey, setSelectedKey] = useState(() => (enabledTargets[0] ? targetKey(enabledTargets[0]) : ''));
	const selectedTarget = targets.find((target) => targetKey(target) === selectedKey && !target.disabled) ?? null;
	const [position, setPosition] = useState(0);

	useEffect(() => {
		if (!selectedTarget) {
			setPosition(0);
			return;
		}
		// Default to Insert last when the destination changes.
		setPosition(selectedTarget.items.length);
	}, [selectedTarget?.modelId, selectedTarget?.fieldId, selectedTarget?.items.length]);

	const positionItems = useMemo(
		() =>
			(selectedTarget?.items ?? []).map((item) => ({
				id: String(item.key),
				label: itemPickerLabel(item)
			})),
		[selectedTarget]
	);

	const handleAccept = () => {
		if (!selectedTarget) return;
		onAccept?.(selectedTarget, position);
		onClose();
	};

	return (
		<>
			<DialogBody>
				{targets.length === 0 ? (
					<EmptyState
						title={<FormattedMessage defaultMessage="No compatible fields" />}
						subtitle={<FormattedMessage defaultMessage="There are no other fields that can accept this item." />}
					/>
				) : (
					<Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', minHeight: '40vh', minWidth: 0 }}>
						<Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
							<FormControl sx={{ width: '100%' }}>
								<FormLabel id={destinationLabelId}>
									<FormattedMessage defaultMessage="Destination field" />
								</FormLabel>
								<List
									disablePadding
									aria-labelledby={destinationLabelId}
									sx={{ mt: 0.5, maxHeight: 280, overflow: 'auto' }}
								>
									{targets.map((target) => {
										const key = targetKey(target);
										return (
											<ListItemButton
												key={key}
												disabled={target.disabled}
												selected={selectedKey === key}
												onClick={() => {
													setSelectedKey(key);
												}}
												sx={{ '&.Mui-selected': { backgroundImage: 'none' } }}
											>
												<ListItemText
													primary={target.labelPath}
													secondary={target.reason ? reasonMessage(target.reason) : undefined}
												/>
											</ListItemButton>
										);
									})}
								</List>
							</FormControl>
						</Box>
						<Box
							sx={{
								width: 300,
								flexShrink: 0,
								minWidth: 0,
								overflow: 'hidden',
								borderLeft: 1,
								borderColor: 'divider',
								pl: 2,
								display: 'flex',
								flexDirection: 'column',
								gap: 1
							}}
						>
							{!selectedTarget && (
								<Typography variant="body2" color="text.secondary">
									<FormattedMessage defaultMessage="Select an item to choose its insert position." />
								</Typography>
							)}
							<InsertPositionPicker
								items={positionItems}
								value={position}
								onChange={setPosition}
								disabled={!selectedTarget}
								emptyMode="firstOnly"
								afterSelectLabel={formatMessage({ defaultMessage: 'Item to insert after' })}
							/>
						</Box>
					</Box>
				)}
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onClose}>
					<FormattedMessage defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton onClick={handleAccept} disabled={!selectedTarget}>
					<FormattedMessage defaultMessage="Move" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export function MoveToFieldDialog(props: MoveToFieldDialogProps) {
	const { open, onClose, itemLabel, ...bodyProps } = props;
	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
			<DialogHeader
				title={<FormattedMessage defaultMessage="Move {item} to field" values={{ item: itemLabel }} />}
				onCloseButtonClick={onClose}
			/>
			{open && <MoveToFieldDialogBody {...bodyProps} open={open} itemLabel={itemLabel} onClose={onClose} />}
		</Dialog>
	);
}

export default MoveToFieldDialog;
