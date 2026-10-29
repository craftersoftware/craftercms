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

import { ViewPackagesDialogProps } from './ViewPackagesDialog';
import React, { useEffect, useState } from 'react';
import { fetchAffectedPackages } from '../../services/workflow';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useSpreadState } from '../../hooks/useSpreadState';
import { useDispatch } from 'react-redux';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { LoadingState } from '../LoadingState';
import { EmptyState } from '../EmptyState';
import { FormattedMessage } from 'react-intl';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ListItemText from '@mui/material/ListItemText';
import DialogBody from '../DialogBody/DialogBody';
import DialogFooter from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import ListItemButton from '@mui/material/ListItemButton';
import ItemDisplay from '../ItemDisplay';
import { PublishPackage } from '../../models';
import { SubmittedPackageDetail } from '../DashletCard/dashletCommons';
import FormControl from '@mui/material/FormControl';
import TextFieldWithMax from '../TextFieldWithMax';
import Grid from '@mui/material/Grid';
import { showPackageDetails } from './utils';

export interface ViewPackagesDialogContainerProps extends Pick<
	ViewPackagesDialogProps,
	'item' | 'cancelPackagesInitialComment' | 'onContinue' | 'onClose'
> {}

export function ViewPackagesDialogContainer(props: ViewPackagesDialogContainerProps) {
	const { item, cancelPackagesInitialComment, onContinue, onClose } = props;
	const siteId = useActiveSiteId();
	const dispatch = useDispatch();
	const [state, setState] = useSpreadState({
		packages: null,
		fetching: false,
		error: null
	});
	const [cancelPackagesComment, setCancelPackagesComment] = useState(cancelPackagesInitialComment ?? '');
	const disableContinue = onContinue ? cancelPackagesComment.trim() === '' : false;

	const onShowPackageDetails = (pkg: PublishPackage) => {
		onClose?.(null, null);
		showPackageDetails({ pkg, dispatch });
	};

	const onContinueClick = (e: React.MouseEvent) => {
		onContinue?.(cancelPackagesComment);
		onClose?.(e, null);
	};

	useEffect(() => {
		setState({ fetching: true, error: null });
		fetchAffectedPackages(siteId, item.path).subscribe({
			next(packages) {
				setState({ packages, fetching: false });
			},
			error({ response }) {
				setState({ fetching: false, error: response.response });
			}
		});
	}, [siteId, item, setState]);

	return (
		<>
			{state.error ? (
				<ApiResponseErrorState error={state.error} />
			) : state.fetching ? (
				<LoadingState />
			) : state.packages?.length ? (
				<>
					<DialogBody>
						<Box sx={{ display: 'flex', mb: 2 }}>
							<Typography sx={{ mr: 1 }}>
								<FormattedMessage defaultMessage="Packages containing" />:
							</Typography>
							<ItemDisplay
								item={item}
								showPublishingTarget={false}
								showWorkflowState={false}
								showNavigableAsLinks={false}
							/>
						</Box>
						<List
							sx={(theme) => ({
								height: '100%',
								border: `1px solid ${theme.palette.divider}`,
								background: theme.palette.background.paper,
								padding: 0
							})}
						>
							{state.packages?.map((pkg) => (
								<ListItemButton key={pkg.id} onClick={() => onShowPackageDetails?.(pkg)}>
									<ListItemText
										primary={`${pkg.id} - ${pkg.title}`}
										secondary={
											<>
												<Typography variant="body2">
													<SubmittedPackageDetail pkg={pkg} />
												</Typography>
												<Typography
													variant="body2"
													sx={{
														mt: 0.5,
														display: '-webkit-box',
														overflow: 'hidden',
														width: '100%',
														textOverflow: 'ellipsis',
														WebkitLineClamp: 2,
														WebkitBoxOrient: 'vertical'
													}}
												>
													{pkg.submitterComment}
												</Typography>
											</>
										}
										slotProps={{ secondary: { title: pkg.title, component: 'div' } }}
									/>
									<Tooltip title={<FormattedMessage defaultMessage="View package details" />}>
										<IconButton>
											<ChevronRightRoundedIcon />
										</IconButton>
									</Tooltip>
								</ListItemButton>
							))}
						</List>

						{onContinue && (
							<Grid size={12} sx={{ pt: 2 }}>
								<FormControl fullWidth>
									<TextFieldWithMax
										value={cancelPackagesComment}
										label={<FormattedMessage defaultMessage="Cancellation comment" />}
										fullWidth
										multiline
										onChange={(e) => setCancelPackagesComment(e.target.value)}
										required
									/>
								</FormControl>
							</Grid>
						)}
					</DialogBody>
					{onContinue && (
						<DialogFooter>
							{onClose && (
								<SecondaryButton onClick={(e) => onClose(e, null)}>
									<FormattedMessage id="workflowCancellation.cancel" defaultMessage="Cancel" />
								</SecondaryButton>
							)}
							{onContinue && (
								<PrimaryButton onClick={onContinueClick} disabled={disableContinue} autoFocus>
									<FormattedMessage id="workflowCancellation.continue" defaultMessage="Continue" />
								</PrimaryButton>
							)}
						</DialogFooter>
					)}
				</>
			) : (
				<EmptyState title={<FormattedMessage defaultMessage="There are no packages in workflow." />} />
			)}
		</>
	);
}

export default ViewPackagesDialogContainer;
