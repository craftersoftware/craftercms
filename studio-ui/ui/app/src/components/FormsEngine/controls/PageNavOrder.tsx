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

import type { ControlProps } from '../types';
import FormsEngineField from '../components/FormsEngineField';
import React, { type ChangeEvent, useEffect, useId, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import ChangeCircleOutlinedIcon from '@mui/icons-material/ChangeCircleOutlined';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { EnhancedDialog } from '../../EnhancedDialog';
import useEnhancedDialogState from '../../../hooks/useEnhancedDialogState';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import {
	getNavItemsOrder,
	type PageNavItem,
	reorderNavItems,
	type ReorderNavItemsRequest
} from '../../../services/content';
import { DialogBody } from '../../DialogBody';
import Typography from '@mui/material/Typography';
import useSpreadState from '../../../hooks/useSpreadState';
import { ApiResponse } from '../../../models';
import { SortableList, type TItem } from '../components/SortableList';
import { useItemContext, useStableFormContext } from '../lib/formsEngineContext';
import { DialogFooter } from '../../DialogFooter';
import SecondaryButton from '../../SecondaryButton';
import PrimaryButton from '../../PrimaryButton';
import { pushErrorDialog } from '../../../utils/system';
import { useDispatch } from 'react-redux';
import Paper from '@mui/material/Paper';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import { showSystemNotification } from '../../../state/actions/system';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Alert from '@mui/material/Alert';
import { isFieldReadOnly } from '../lib/formUtils';
import { getParentPath } from '../../../utils/path';
import { nou } from '../../../utils/object';
import { PrimitiveAtom, useStore } from 'jotai';

export interface PageNavOrderProps extends ControlProps {
	value: boolean;
}

const ORDER_DEFAULT_FIELD_ID = 'orderDefault_f';

export function PageNavOrder(props: PageNavOrderProps) {
	const { value, setValue, field, autoFocus, readonly: formReadonly } = props;
	const [initialValue] = useState<boolean>(value);
	const htmlId = useId();
	const orderDialogState = useEnhancedDialogState();
	const { formatMessage } = useIntl();
	const [pagesOrderState, setPagesOrderState] = useSpreadState<{
		fetching: boolean;
		error: ApiResponse | null;
		order: TItem<PageNavItem>[] | null;
		changedOrder: boolean;
	}>({
		fetching: false,
		error: null,
		order: null,
		changedOrder: false
	});
	const contextItem = useItemContext();
	const currentPath = contextItem?.path;
	const siteId = useActiveSiteId();
	const dispatch = useDispatch();
	const formContext = useStableFormContext();
	const jotaiStore = useStore();
	const orderDefaultAtom = formContext.atoms.valueByFieldId[ORDER_DEFAULT_FIELD_ID] as
		| PrimitiveAtom<number | string | null | undefined>
		| undefined;
	if (!orderDefaultAtom) {
		throw new Error(`Missing "${ORDER_DEFAULT_FIELD_ID}" atom; computed nav order was not applied to the form.`);
	}
	const effectRefs = useUpdateRefs({
		initialValue,
		contextItem,
		orderDefaultAtom,
		jotaiStore
	});
	const readonly: boolean = isFieldReadOnly(field, formReadonly);

	useEffect(() => {
		if (currentPath) {
			setPagesOrderState({ fetching: true, error: null });
			const parentPath = getParentPath(currentPath);
			const subscription = getNavItemsOrder(siteId, parentPath).subscribe({
				next: (order) => {
					const newOrder = createSortableItemList(order);
					// If the initialValue is false, then it means that we'll be adding this page to the navigation (since it won't
					// be in the order response).
					if (!effectRefs.current.initialValue) {
						newOrder.push({
							key: currentPath,
							value: effectRefs.current.contextItem?.label || currentPath
						});
					}
					setPagesOrderState({ fetching: false, order: newOrder });
				},
				error: ({ response }) => setPagesOrderState({ fetching: false, error: response.response })
			});
			return () => subscription.unsubscribe();
		}
	}, [siteId, setPagesOrderState, currentPath, effectRefs]);

	const handleChange = (_event: ChangeEvent<HTMLInputElement>, selected: string) => {
		if (readonly) return;
		setValue(selected === 'true');
	};
	const handleUpdateOrder = () => {
		orderDialogState.onClose();
		if (!pagesOrderState.changedOrder) return;

		// If no current path, or no nav items order, then nothing to reorder.
		if (!currentPath || !pagesOrderState.order || !pagesOrderState.order.length) return;
		const currentItemIndex = pagesOrderState.order.findIndex((item) => item.key === currentPath);
		// If the current item is not found in the order, then nothing to reorder.
		if (currentItemIndex === -1) return;
		const previousItemPath = currentItemIndex > 0 ? pagesOrderState.order[currentItemIndex - 1]?.key : undefined;
		const nextItemPath =
			currentItemIndex < pagesOrderState.order.length - 1
				? pagesOrderState.order[currentItemIndex + 1]?.key
				: undefined;

		let request: ReorderNavItemsRequest;
		if (!nou(previousItemPath) && !nou(nextItemPath)) {
			request = { type: 'insertBetween', previousPath: previousItemPath, nextPath: nextItemPath };
		} else if (nou(previousItemPath) && !nou(nextItemPath)) {
			request = { type: 'addBefore', referencePath: nextItemPath };
		} else if (!nou(previousItemPath) && nou(nextItemPath)) {
			request = { type: 'addAfter', referencePath: previousItemPath };
		} else {
			// Only item in the list — nothing to reorder against.
			return;
		}

		reorderNavItems(siteId, request).subscribe({
			next: ({ order }) => {
				setPagesOrderState({ changedOrder: false });
				const { orderDefaultAtom: atom, jotaiStore: store } = effectRefs.current;
				if (atom) {
					store.set(atom, order);
				} else {
					console.error(
						`Missing "${ORDER_DEFAULT_FIELD_ID}" atom; computed nav order ${order} was not applied to the form.`
					);
				}
				dispatch(showSystemNotification({ message: formatMessage({ defaultMessage: 'Navigation items reordered.' }) }));
			},
			error: ({ response }) => {
				dispatch(pushErrorDialog({ props: { error: response.response } }));
			}
		});
	};

	return (
		<FormsEngineField htmlFor={htmlId} field={field}>
			<Box display="flex" flexDirection="row" gap={2}>
				<RadioGroup
					row
					value={String(value)}
					onChange={handleChange}
					sx={{ display: 'inline-flex' }}
					autoFocus={autoFocus}
				>
					<FormControlLabel
						value="false"
						control={<Radio />}
						label={<FormattedMessage defaultMessage="No" />}
						disabled={readonly}
					/>
					<FormControlLabel
						value="true"
						control={<Radio />}
						label={<FormattedMessage defaultMessage="Yes" />}
						disabled={readonly}
					/>
				</RadioGroup>

				{value && (
					<Button
						variant="text"
						startIcon={<ChangeCircleOutlinedIcon />}
						onClick={() => orderDialogState.onOpen()}
						disabled={readonly}
						sx={{ flex: 'none' }}
					>
						<FormattedMessage defaultMessage="Edit Order" />
					</Button>
				)}
			</Box>
			<EnhancedDialog
				open={orderDialogState.open}
				onClose={orderDialogState.onClose}
				maxWidth="sm"
				title={<FormattedMessage defaultMessage="Edit Navigation Order" />}
			>
				<DialogBody>
					<Typography variant="body2">
						<FormattedMessage
							defaultMessage={'Drag and Drop "{page}" to the desired location in the navigation structure.'}
							values={{
								page: contextItem?.label ?? ''
							}}
						/>
					</Typography>
					<Paper elevation={0} sx={{ mt: 2 }}>
						<SortableList
							items={pagesOrderState.order ?? []}
							selectedItemId={currentPath}
							onlySelectedSortable={true}
							onChange={(fields: TItem<PageNavItem>[]) =>
								setPagesOrderState({
									order: fields,
									changedOrder: true
								})
							}
						/>
					</Paper>
				</DialogBody>
				<DialogFooter>
					<SecondaryButton onClick={() => orderDialogState.onClose()}>
						<FormattedMessage defaultMessage="Cancel" />
					</SecondaryButton>
					<PrimaryButton autoFocus onClick={handleUpdateOrder}>
						{pagesOrderState.changedOrder ? (
							<FormattedMessage defaultMessage="Save" />
						) : (
							<FormattedMessage defaultMessage="Close" />
						)}
					</PrimaryButton>
				</DialogFooter>
			</EnhancedDialog>
		</FormsEngineField>
	);
}

/**
 * Converts an array of `PageNavItem` objects into an array of sortable items (`TItem<PageNavItem>`).
 * This function is used to transform navigation items into a format compatible with the `SortableList` component.
 *
 * @param order {PageNavItem[]} - The array of navigation items to be converted.
 * @returns {TItem<PageNavItem>[]} - The transformed array of sortable items.
 */
function createSortableItemList(order: PageNavItem[]): TItem<PageNavItem>[] {
	return order.map((item) => ({
		key: item.path,
		value: item.label,
		data: item
	}));
}

export default PageNavOrder;
