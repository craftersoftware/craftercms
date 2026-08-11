/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import { useSpreadState } from '../../hooks/useSpreadState';
import React, { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { PublishingTarget, PublishParams } from '../../models/Publishing';
import LookupTable from '../../models/LookupTable';
import { InternalDialogState, itemsArrayChanged, PublishDialogContainerProps, usePublishState } from './utils';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useDispatch, useSelector } from 'react-redux';
import { calculatePackage, publish } from '../../services/publishing';
import { FormattedMessage, useIntl } from 'react-intl';
import { isBlank } from '../../utils/string';
import { ContentItem, GlobalState, LightItem } from '../../models';
import { createAtLeastHalfHourInFutureDate } from '../../utils/datetime';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import DialogBody from '../DialogBody';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { LoadingState } from '../LoadingState';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import { Fade, Typography } from '@mui/material';
import { DateTimeTimezonePickerProps } from '../DateTimeTimezonePicker';
import { EmptyState } from '../EmptyState';
import DialogFooter from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { createLookupTable, nnou } from '../../utils/object';
import PublishPackageItemsView from './PublishPackageItemsView';
import PublishReferencesLegend from './PublishReferencesLegend';
import { PublishDialogForm } from './PublishDialogForm';
import useActiveUser from '../../hooks/useActiveUser';
import { pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';
import { ConfirmDropdown } from '../ConfirmDropdown';
import { useItemsByPath } from '../../hooks/useItemsByPath';

export type DependencyType = 'soft' | 'hard';
export type DependencyMap = Record<string, DependencyType>;
export type DependencyDataState = {
	paths: string[];
	typeByPath: DependencyMap;
	itemsByPath: LookupTable<LightItem>;
	items: LightItem[];
};

export function DependencyChip({ type }: { type: DependencyType }) {
	if (!type) return null;
	const isSoft = type === 'soft';
	return (
		<Chip
			size="small"
			variant="outlined"
			color={isSoft ? 'info' : 'warning'}
			label={isSoft ? <FormattedMessage defaultMessage="Optional" /> : <FormattedMessage defaultMessage="Required" />}
		/>
	);
}

export function PublishDialogContainer(props: PublishDialogContainerProps) {
	const { items: initialItems, scheduling = 'now', onSuccess, onClose, isSubmitting } = props;
	const siteId = useActiveSiteId();
	const { permissionsBySite } = useActiveUser();
	const dispatch = useDispatch();
	const [contentItems, setContentItems] = useState<ContentItem[]>();
	const [isFetchingItems, setIsFetchingItems] = useState(false);
	const [packageDependenciesFetchFailed, setPackageDependenciesFetchFailed] = useState(false);
	const [state, setState] = useSpreadState<InternalDialogState>({
		packageTitle: '',
		requestApproval: false,
		publishingTarget: null,
		submissionComment: '',
		scheduling,
		scheduledDateTime: createAtLeastHalfHourInFutureDate(),
		error: null,
		fetchingItems: false
	});
	const [mainItems, setMainItems] = useState<LightItem[]>(initialItems);
	const [previousItems, setPreviousItems] = useState<LightItem[] | null>(null);
	const [childrenItems, setChildrenItems] = useState<LightItem[]>([]);
	const [published, setPublished] = useState<boolean>(null);
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
	} = usePublishState({ mainItems, childrenItems });
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const hasPublishPermission = permissionsBySite[siteId].includes('publish_approve');
	const publishingTarget = useMemo(() => {
		let target: InternalDialogState['publishingTarget'] = '';
		if (mainItems) {
			if (mainItems.length === 0) {
				return target;
			}
			// If there aren't any available target (or they haven't loaded), dialog should not have a selected target.
			if (publishingTargets?.length && target === '') {
				// If we haven't found a target by this point, we wish to default the dialog to
				// staging (as long as that target is enabled in the system and it's not the first publish), which is checked next.
				target = published
					? (publishingTargets.find((target) => target.name === 'staging')?.name ?? publishingTargets[0].name)
					: (publishingTargets.find((target) => target.name !== 'staging')?.name ?? '');
			}
		}

		return target;
	}, [publishingTargets, mainItems, published]);
	const commentMaxLength = useSelector<GlobalState, number>(
		(state) => state.uiConfig.publishing.submissionCommentMaxLength
	);
	const { formatMessage } = useIntl();
	const itemsByPath = useItemsByPath();

	const areSomeItemsDraft = useMemo(() => {
		return itemsDataSummary.itemPaths.some((path) => itemsByPath[path]?.savedAsDraft);
	}, [itemsDataSummary.itemPaths, itemsByPath]);

	const hardDependenciesWithoutPublishPermission = useMemo(() => {
		if (packageDependenciesFetchFailed || !dependencyData) {
			return false;
		}
		return dependencyData.items.some(
			(item) => !item.canRequestPublish && dependencyData.typeByPath[item.path] === 'hard'
		);
	}, [dependencyData, packageDependenciesFetchFailed]);
	const dependencyValidationIncomplete =
		packageDependenciesFetchFailed || (!dependencyData && Boolean(state.publishingTarget));

	// Auto-generate submission comment based on mainItems labels if comment is blank
	useEffect(() => {
		if (state && mainItems && Array.isArray(mainItems) && isBlank(state.submissionComment)) {
			const labels = mainItems.map((item) => item.label).filter(Boolean);
			const base = `${formatMessage({ defaultMessage: 'Publishing' })}: `;

			let submissionComment = `${base}${labels.join(', ')}`;
			if (submissionComment.length > commentMaxLength) {
				// Calculate how many items fit within {commentMaxLength} chars
				let totalLength = base.length;
				let count = 0;
				const resultLabels: string[] = [];
				let strippedCount = 0;
				for (let i = 0; i < labels.length; i++) {
					const next = (count === 0 ? '' : ', ') + labels[i];
					// Predict the length if we add " and X more items"
					const remaining = labels.length - (count + 1);
					const suffix =
						remaining > 0 ? ` ${formatMessage({ defaultMessage: 'and {count} more' }, { count: remaining })}` : '';
					if (totalLength + next.length + suffix.length > commentMaxLength) break;
					resultLabels.push(labels[i]);
					totalLength += next.length;
					count++;
				}
				strippedCount = labels.length - count;
				let comment = `${base}${resultLabels.join(', ')}`;
				if (strippedCount > 0) {
					comment += ` ${formatMessage({ defaultMessage: 'and {count} more' }, { count: strippedCount })}`;
				}
				submissionComment = comment;
			}

			if (labels.length > 0) {
				setState({ submissionComment });
			}
		}
		// Only run when mainItems or submissionComment changes
	}, [mainItems, state, setState, formatMessage, commentMaxLength]);

	const isRequestPublish = !hasPublishPermission || state.requestApproval;
	const showRequestApproval = hasPublishPermission;
	const submitLabel =
		state.scheduling === 'custom' ? (
			<FormattedMessage id="words.schedule" defaultMessage="Schedule" />
		) : !hasPublishPermission || state.requestApproval ? (
			<FormattedMessage id="publishDialog.requestPublish" defaultMessage="Request Publish" />
		) : (
			<FormattedMessage id="words.publish" defaultMessage="Publish" />
		);
	const disabled = isSubmitting;
	const [includeChildren, setIncludeChildren] = useState(
		// Initial state is true if all mainItems are folders, since publishing only folders is not allowed.
		mainItems.length > 0 && mainItems.every((item) => item.systemType === 'folder')
	);
	const effectRefs = useUpdateRefs({ initialItems, state, mainItems, childrenItems, includeChildren });
	const arePublishingItemsFolders = useMemo(() => {
		const allItems = [...mainItems, ...childrenItems];
		return allItems.length > 0 && allItems.every((item) => item.systemType === 'folder');
	}, [mainItems, childrenItems]);

	// Submit button should be disabled when:
	const submitDisabled =
		// Detailed items haven't loaded
		isFetchingItems ||
		// While fetching dependencies
		state.fetchingItems ||
		!contentItems ||
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
		state.scheduledDateTime < new Date() ||
		// All items to publish are empty folders.
		arePublishingItemsFolders ||
		// When dependency validation did not complete successfully
		dependencyValidationIncomplete ||
		// When there are hard dependencies without publish permission
		hardDependenciesWithoutPublishPermission;

	useEffect(() => {
		setState({ fetchingItems: true });
		if (state.publishingTarget) {
			const sub = calculatePackage(siteId, {
				publishingTarget: state.publishingTarget,
				paths: itemsDataSummary.itemPaths.map((path) => ({
					path,
					includeChildren,
					includeSoftDeps: false
				}))
			}).subscribe({
				next(dependenciesByType) {
					const itemsList = [...dependenciesByType.hardDependencies, ...dependenciesByType.softDependencies];
					const depMap: DependencyMap = {};
					const depLookup: LookupTable<LightItem> = createLookupTable(itemsList, 'path');
					dependenciesByType.hardDependencies.forEach(({ path }) => {
						depMap[path] = 'hard';
					});
					dependenciesByType.softDependencies.forEach(({ path }) => {
						depMap[path] = 'soft';
					});
					setState({ fetchingItems: false });
					setPackageDependenciesFetchFailed(false);
					if (includeChildren && dependenciesByType.items) {
						if (itemsArrayChanged(effectRefs.current.childrenItems, dependenciesByType.items)) {
							setChildrenItems(dependenciesByType.items);
						}
					} else {
						if (effectRefs.current.childrenItems.length !== 0) {
							setChildrenItems([]);
						}
					}
					setDependencyData({
						typeByPath: depMap,
						paths: Object.keys(depMap),
						itemsByPath: depLookup,
						items: itemsList
					});
				},
				error() {
					setState({ fetchingItems: false });
					setIsFetchingItems(false);
					setDependencyData(null);
					setPackageDependenciesFetchFailed(true);
				}
			});
			return () => sub.unsubscribe();
		}
	}, [
		itemsDataSummary.itemPaths,
		setState,
		siteId,
		setSelectedDependenciesMap,
		state.publishingTarget,
		setDependencyData,
		includeChildren,
		effectRefs
	]);

	useEffect(() => {
		scheduling !== effectRefs.current.state.scheduling && setState({ scheduling });
	}, [effectRefs, scheduling, setState]);

	useEffect(() => {
		const partialState: Partial<InternalDialogState> = {
			publishingTarget: publishingTarget || effectRefs.current.state.publishingTarget,
			scheduling: scheduling !== 'now' ? 'custom' : 'now'
		};
		setState(partialState);
	}, [setState, scheduling, effectRefs, publishingTarget]);

	useEffect(() => {
		setContentItems(effectRefs.current.initialItems);
	}, [effectRefs, itemsDataSummary, siteId, setState, dispatch]);

	const handleSubmit = (e?: SyntheticEvent) => {
		e?.preventDefault();
		if (submitDisabled) return;

		const { publishingTarget, scheduling: schedule } = state;
		const { itemPaths, itemMap } = itemsDataSummary;
		const { packageTitle, submissionComment, scheduling, scheduledDateTime } = state;
		const data: PublishParams = {
			publishingTarget: state.publishingTarget,
			paths: itemPaths.map((path: string) => ({
				path,
				includeChildren: false,
				includeSoftDeps: false
			})),
			schedule: scheduling === 'custom' ? scheduledDateTime.toISOString() : null,
			requestApproval: isRequestPublish,
			title: packageTitle,
			comment: submissionComment
		};

		updateSubmittingOrHasPendingChanges({ isSubmitting: true });

		publish(siteId, data).subscribe({
			next() {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false, hasPendingChanges: false });
				onSuccess?.({
					schedule: schedule,
					publishingTarget,
					// @ts-expect-error: TODO: Not quite sure if users of this dialog are making use of the `environment` prop name. Should remove (keep publishingTarget only).
					environment: publishingTarget,
					type: !hasPublishPermission || state.requestApproval ? 'submit' : 'publish',
					items: itemPaths.map((path) => itemMap[path])
				});
			},
			error({ response }) {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				dispatch(pushErrorDialog({ props: { error: response.response } }));
			}
		});
	};

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

	const onCloseButtonClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => onClose(e, null);

	const onDependencyCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, checked: boolean, path: string) => {
		setSelectedDependenciesMap({ ...selectedDependenciesMap, [path]: checked });
	};

	const onApplyDependenciesChanges = () => {
		setPreviousItems(mainItems);
		// Update the list of mainItems for the dependencies to be re-calculated. Also clear the current set of selected
		// dependencies.
		setMainItems([...mainItems, ...selectedDependenciesPaths.map((path) => dependencyData.itemsByPath[path])]);
		setSelectedDependenciesMap({});
	};

	/**
	 * This function restores the `mainItems` state to the previously saved state (`previousItems`),
	 * clears the `selectedDependenciesMap` to remove any selected dependencies (they get recalculated), and resets the
	 * `previousItems` state to an empty array.
	 */
	const onRevertDependenciesChanges = () => {
		if (!previousItems) return;
		setChildrenItems([]);
		setMainItems(previousItems);
		setSelectedDependenciesMap({});
		setPreviousItems(null);
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

	return (
		<>
			<DialogBody sx={{ px: 4, minHeight: 'calc(100vh * 0.5)' }}>
				{state.error ? (
					<ApiResponseErrorState error={state.error} />
				) : isFetchingItems ? (
					<LoadingState sx={{ flexGrow: 1 }} />
				) : contentItems ? (
					contentItems.length ? (
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
									onFetchedPublishedTargets={({ targets, published }) => {
										setPublished(published);
										setPublishingTargets(targets);
									}}
								/>
								<Divider />
								<PublishReferencesLegend />
							</Grid>
							<Grid size={{ xs: 12, sm: 7 }}>
								{published ? (
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
											includeChildren={includeChildren}
											setIncludeChildren={setIncludeChildren}
										/>
										{arePublishingItemsFolders && (
											<Fade in={arePublishingItemsFolders}>
												<Alert severity="warning" sx={{ borderTopRightRadius: 0, borderTopLeftRadius: 0 }}>
													<FormattedMessage defaultMessage="Publishing only folders is not allowed" />
												</Alert>
											</Fade>
										)}
										{areSomeItemsDraft && (
											<Fade in={areSomeItemsDraft}>
												<Alert severity="error" sx={{ borderTopRightRadius: 0, borderTopLeftRadius: 0 }}>
													<FormattedMessage defaultMessage="Draft items in package. Publishing draft items may result in errors if required fields are not filled in." />
												</Alert>
											</Fade>
										)}
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
										{nnou(previousItems) && !selectedDependenciesPaths.length && (
											<Fade in={nnou(previousItems)}>
												<Alert
													severity="info"
													action={
														<ConfirmDropdown
															cancelText={<FormattedMessage id="words.no" defaultMessage="No" />}
															confirmText={<FormattedMessage id="words.yes" defaultMessage="Yes" />}
															text={<FormattedMessage defaultMessage="Revert" />}
															confirmHelperText={<FormattedMessage defaultMessage="Revert changes?" />}
															iconTooltip={<FormattedMessage defaultMessage="Revert changes?" />}
															onConfirm={() => onRevertDependenciesChanges()}
															buttonProps={{
																variant: 'text',
																size: 'small',
																color: 'inherit'
															}}
														/>
													}
													sx={{ borderTopRightRadius: 0, borderTopLeftRadius: 0 }}
												>
													<FormattedMessage defaultMessage="Last applied changes can be reverted" />
												</Alert>
											</Fade>
										)}
										{packageDependenciesFetchFailed && (
											<Fade in={packageDependenciesFetchFailed}>
												<Alert severity="error" sx={{ borderTopRightRadius: 0, borderTopLeftRadius: 0 }}>
													<FormattedMessage defaultMessage="Dependency validation could not complete. Please try again before submitting." />
												</Alert>
											</Fade>
										)}
										{hardDependenciesWithoutPublishPermission && (
											<Fade in={hardDependenciesWithoutPublishPermission}>
												<Alert severity="error" sx={{ borderTopRightRadius: 0, borderTopLeftRadius: 0 }}>
													<FormattedMessage defaultMessage="Package cannot be submitted because there are required references without publish permission" />
												</Alert>
											</Fade>
										)}
									</Paper>
								) : (
									<Alert severity="warning">
										<FormattedMessage
											id="publishDialog.firstPublish"
											defaultMessage="The entire project will be published since this is the first publish request"
										/>
									</Alert>
								)}
							</Grid>
						</Grid>
					) : (
						<EmptyState
							title={
								<FormattedMessage id="publishDialog.noItemsSelected" defaultMessage="No items have been selected" />
							}
						/>
					)
				) : (
					<Typography>
						<FormattedMessage defaultMessage="Nothing to display." />
					</Typography>
				)}
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onCloseButtonClick} disabled={isSubmitting}>
					<FormattedMessage id="requestPublishDialog.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton onClick={handleSubmit} disabled={submitDisabled} loading={isSubmitting}>
					{submitLabel}
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export default PublishDialogContainer;
