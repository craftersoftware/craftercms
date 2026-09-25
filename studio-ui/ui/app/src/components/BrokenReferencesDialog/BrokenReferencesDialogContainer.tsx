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

import React, { useState } from 'react';
import { BrokenReferencesDialogContainerProps } from './types';
import { FormattedMessage } from 'react-intl';
import { EmptyState } from '../EmptyState';
import { useDispatch } from 'react-redux';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useEnv from '../../hooks/useEnv';
import { DialogBody } from '../DialogBody';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import DialogFooter from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import ApiResponseErrorState from '../ApiResponseErrorState';
import { fetchDependant } from '../../services/dependencies';
import { fetchContentItems } from '../../services/content';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

import { pickShowContentFormAction, pushErrorDialog } from '../../utils/system';
import { extractErrorPayload } from '../../utils/ajax';

export function BrokenReferencesDialogContainer(props: BrokenReferencesDialogContainerProps) {
	const { path, references: initialReferences, error, onClose, onContinue } = props;
	const dispatch = useDispatch();
	const site = useActiveSiteId();
	const { authoringBase } = useEnv();
	const [references, setReferences] = useState(initialReferences || []);

	const onContinueClick = (e) => {
		onClose(e, null);
		onContinue();
	};

	const onEditReferenceClick = (referencePath: string) => {
		dispatch(
			pickShowContentFormAction({
				path: referencePath,
				authoringBase,
				site,
				onSaveSuccess: () => {
					fetchDependant(site, path)
						.pipe(
							map((lightItems) => lightItems.map((item) => item.path)),
							// Items of type 'ContentItem' are needed in this component (fetchDependant returns LightItem[])
							// AvailableActionsMap of items is needed to render the edit button of each reference.
							switchMap((paths) => (paths.length ? fetchContentItems(site, paths) : of([])))
						)
						.subscribe({
							next: (contentItems) => {
								setReferences(contentItems);
							},
							error: (error) => {
								dispatch(pushErrorDialog({ props: { error: extractErrorPayload(error) } }));
							}
						});
				}
			})
		);
	};

	return error ? (
		<ApiResponseErrorState error={error} />
	) : (
		<>
			<DialogBody>
				<Grid container spacing={3}>
					{references.length > 0 ? (
						<Grid size={12}>
							<List
								sx={{
									border: (theme) => `1px solid ${theme.palette.divider}`,
									background: (theme) => theme.palette.background.paper
								}}
							>
								{references.map((reference, index) => (
									<ListItem
										key={reference.path}
										divider={references.length - 1 !== index}
										secondaryAction={
											reference.availableActionsMap?.edit ? (
												<Button
													color="primary"
													onClick={() => {
														onEditReferenceClick?.(reference.path);
													}}
													size="small"
													sx={{
														marginLeft: 'auto',
														fontWeight: 'bold',
														verticalAlign: 'baseline'
													}}
												>
													<FormattedMessage defaultMessage="Edit" />
												</Button>
											) : null
										}
									>
										<ListItemText
											primary={reference.label}
											secondary={reference.path}
											slotProps={{
												primary: {
													title: reference.path,
													sx: {
														overflow: 'hidden',
														whiteSpace: 'nowrap',
														textOverflow: 'ellipsis'
													}
												}
											}}
										/>
									</ListItem>
								))}
							</List>
						</Grid>
					) : (
						<EmptyState
							title={<FormattedMessage defaultMessage="No broken references have been detected" />}
							sxs={{ root: { width: '100%', pt: 2 } }}
						/>
					)}
				</Grid>
			</DialogBody>
			<DialogFooter>
				{onClose && (
					<SecondaryButton onClick={(e) => onClose(e, null)}>
						<FormattedMessage defaultMessage="Cancel" />
					</SecondaryButton>
				)}
				{onContinue && (
					<PrimaryButton onClick={onContinueClick} autoFocus>
						<FormattedMessage defaultMessage="Continue" />
					</PrimaryButton>
				)}
			</DialogFooter>
		</>
	);
}

export default BrokenReferencesDialogContainer;
