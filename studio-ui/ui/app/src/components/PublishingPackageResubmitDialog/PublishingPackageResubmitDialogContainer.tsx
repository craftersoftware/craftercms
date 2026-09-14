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

import React, { useEffect, useState } from 'react';
import { PublishingPackageResubmitDialogContainerProps } from './types';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { useDispatch } from 'react-redux';
import useSpreadState from '../../hooks/useSpreadState';
import { DependencyMap, InternalDialogState, usePublishState } from '../PublishDialog';
import { createAtLeastHalfHourInFutureDate } from '../../utils/datetime';
import { DialogBody } from '../DialogBody';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import Grid from '@mui/material/Grid';
import { FormattedMessage } from 'react-intl';
import { DateTimeTimezonePickerProps } from '../DateTimeTimezonePicker';
import Divider from '@mui/material/Divider';
import PublishReferencesLegend from '../PublishDialog/PublishReferencesLegend';
import { LightItem, PublishingTarget, PublishParams } from '../../models';
import { PublishDialogForm } from '../PublishDialog/PublishDialogForm';
import { publish, recalculatePackage } from '../../services/publishing';
import PublishPackageItemsView from '../PublishDialog/PublishPackageItemsView';
import Paper from '@mui/material/Paper';
import LookupTable from '../../models/LookupTable';
import { DialogFooter } from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import { createLookupTable } from '../../utils/object';
import { Fade } from '@mui/material';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { isBlank } from '../../utils/string';
import { LoadingState } from '../LoadingState';
import useActiveUser from '../../hooks/useActiveUser';
import { pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';

export function PublishingPackageResubmitDialogContainer(props: PublishingPackageResubmitDialogContainerProps) {
	const { pkg, type, isSubmitting, onSuccess, onClose } = props;
	const siteId = useActiveSiteId();
	const { permissionsBySite } = useActiveUser();
	const dispatch = useDispatch();
	const [state, setState] = useSpreadState<InternalDialogState>({
		packageTitle: pkg.title,
		requestApproval: false,
		publishingTarget: type === 'promote' ? 'live' : pkg.target,
		submissionComment: pkg.submitterComment,
		scheduling: 'now',
		scheduledDateTime: createAtLeastHalfHourInFutureDate(),
		error: null,
		fetchingItems: false
	});
	const [mainItems, setMainItems] = useState<LightItem[]>([]);
	const [publishingTargets, setPublishingTargets] = useState<PublishingTarget[]>(null);
	const {
		itemsDataSummary,
		dependencyData,
		setDependencyData,
		selectedDependenciesMap,
		setSelectedDependenciesMap,
		selectedDependenciesPaths,
		trees,
		parentTreeNodePaths,
		itemsAndDependenciesPaths,
		itemsAndDependenciesMap
	} = usePublishState({ mainItems });
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const disabled = isSubmitting;
	const hasPublishPermission = permissionsBySite[siteId].includes('publish_review');
	const showRequestApproval = hasPublishPermission;
	const isRequestPublish = !hasPublishPermission || state.requestApproval;
	// Submit button should be disabled when
	const submitDisabled =
		// Items from recalculatePackage are not fetched yet
		state.fetchingItems ||
		// If there are no items to publish
		!mainItems.length ||
		// While submitting
		isSubmitting ||
		// If package title is blank
		isBlank(state.packageTitle) ||
		// If package comment is blank
		isBlank(state.submissionComment) ||
		// When there are no available/loaded publishing targets
		!publishingTargets?.length ||
		// When there are selected dependencies not applied.
		Boolean(selectedDependenciesPaths?.length) ||
		// When no publishing target is selected
		!state.publishingTarget ||
		// When there's an error
		Boolean(state.error) ||
		// The scheduled date is in the past
		state.scheduledDateTime < new Date();

	const submitLabel =
		type === 'resubmit' ? (
			<FormattedMessage defaultMessage="Resubmit" />
		) : (
			<FormattedMessage defaultMessage="Promote" />
		);

	const onPublishingArgumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let value: unknown;
		updateSubmittingOrHasPendingChanges({ hasPendingChanges: true });
		switch (e.target.type) {
			case 'checkbox':
				value = e.target.checked;
				break;
			case 'text':
			case 'textarea':
			case 'radio':
			case 'dateTimePicker':
				value = e.target.value;
				break;
			default:
				console.error('Publishing argument change event ignored.');
				return;
		}
		setState({ [e.target.name]: value });
	};

	const handleDateTimePickerChange: DateTimeTimezonePickerProps['onChange'] = (date) => {
		onPublishingArgumentChange({
			target: {
				name: 'scheduledDateTime',
				type: 'dateTimePicker',
				// @ts-expect-error: We're formating this as a change event so ignoring "Type 'Date' is not assignable to type 'string'".
				value: date
			}
		});
	};

	const onDependencyCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, checked: boolean, path: string) => {
		setSelectedDependenciesMap({ ...selectedDependenciesMap, [path]: checked });
	};

	const onCloseButtonClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => onClose(e, null);

	const onApplyDependenciesChanges = () => {
		// Update the list of mainItems for the dependencies to be re-calculated. Also clear the current set of selected
		// dependencies.
		setMainItems([...mainItems, ...selectedDependenciesPaths.map((path) => dependencyData.itemsByPath[path])]);
		setSelectedDependenciesMap({});
	};

	const handleSubmit = () => {
		const { publishingTarget } = state;
		const { itemPaths } = itemsDataSummary;
		const { requestApproval, packageTitle, submissionComment, scheduling, scheduledDateTime } = state;
		const data: PublishParams = {
			publishingTarget: publishingTarget,
			paths: itemPaths.map((path: string) => ({
				path,
				includeChildren: false,
				includeSoftDeps: false
			})),
			schedule: scheduling === 'custom' ? scheduledDateTime.toISOString() : null,
			requestApproval,
			title: packageTitle,
			comment: submissionComment
		};

		updateSubmittingOrHasPendingChanges({ isSubmitting: true });

		publish(siteId, data).subscribe({
			next() {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false, hasPendingChanges: false });
				onSuccess?.();
			},
			error({ response }) {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				dispatch(pushErrorDialog({ props: { error: response.response } }));
			}
		});
	};

	useEffect(() => {
		if (pkg.id) {
			if (!mainItems.length) {
				setState({ fetchingItems: true });
			}
			recalculatePackage(siteId, pkg.id, state.publishingTarget).subscribe({
				next(calculatedPackage) {
					const itemsList = [
						...calculatedPackage.items,
						...calculatedPackage.hardDependencies,
						...calculatedPackage.softDependencies
					];
					const depMap: DependencyMap = {};
					const depLookup: LookupTable<LightItem> = createLookupTable(itemsList, 'path');
					calculatedPackage.hardDependencies.forEach(({ path }) => {
						depMap[path] = 'hard';
					});
					calculatedPackage.softDependencies.forEach(({ path }) => {
						depMap[path] = 'soft';
					});
					setState({ fetchingItems: false });
					setDependencyData({
						typeByPath: depMap,
						paths: Object.keys(depMap),
						itemsByPath: depLookup,
						items: itemsList
					});
					setMainItems(calculatedPackage.items.map(({ path }) => depLookup[path]));
				},
				error() {
					setState({ fetchingItems: false });
					setDependencyData(null);
				}
			});
		}
	}, [pkg.id, setState, siteId, state.publishingTarget, setDependencyData, mainItems?.length]);

	return (
		<>
			<DialogBody sx={{ px: 4, minHeight: 'calc(100vh * 0.5)' }}>
				{state.error ? (
					<ApiResponseErrorState error={state.error} />
				) : state.fetchingItems ? (
					<LoadingState sx={{ flexGrow: 1 }} />
				) : (
					<Grid container spacing={2} sx={{ flex: 1 }}>
						<Grid size={{ xs: 12, sm: 5 }}>
							<PublishDialogForm
								formState={state}
								onSubmit={handleSubmit}
								onInputChange={onPublishingArgumentChange}
								onDateTimePickerChange={handleDateTimePickerChange}
								showRequestApproval={showRequestApproval}
								isRequestPublish={isRequestPublish}
								disabled={disabled}
								onFetchedPublishedTargets={({ targets }) => {
									setPublishingTargets(targets);
								}}
								isPromote={type === 'promote'}
							/>
							<Divider />
							<PublishReferencesLegend />
						</Grid>
						<Grid size={{ xs: 12, sm: 7 }}>
							<Paper
								elevation={1}
								sx={{
									bgcolor: (theme) =>
										theme.palette.mode === 'dark' ? theme.palette.background.default : 'background.paper',
									display: 'flex',
									flexDirection: 'column',
									height: '100%'
								}}
							>
								<PublishPackageItemsView
									itemMap={itemsAndDependenciesMap}
									defaultExpandedPaths={parentTreeNodePaths}
									itemsAndDependenciesPaths={itemsAndDependenciesPaths}
									dependencyTypeMap={dependencyData?.typeByPath}
									selectedDependenciesPaths={selectedDependenciesPaths}
									selectedDependenciesMap={selectedDependenciesMap}
									trees={trees}
									onCheckboxChange={onDependencyCheckboxChange}
								/>
								{Boolean(selectedDependenciesPaths.length) && (
									<Fade in={Boolean(selectedDependenciesPaths?.length)}>
										<Alert
											severity="info"
											action={
												<Button color="inherit" size="small" onClick={onApplyDependenciesChanges}>
													<FormattedMessage defaultMessage="Apply" />
												</Button>
											}
											sx={{ borderTopRightRadius: 0, borderTopLeftRadius: 0 }}
										>
											<FormattedMessage defaultMessage="Changes in the item selection must be applied" />
										</Alert>
									</Fade>
								)}
							</Paper>
						</Grid>
					</Grid>
				)}
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onCloseButtonClick} disabled={isSubmitting}>
					<FormattedMessage defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton disabled={submitDisabled} onClick={handleSubmit}>
					{submitLabel}
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export default PublishingPackageResubmitDialogContainer;
