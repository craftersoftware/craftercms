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

import React, { useEffect, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import AddIcon from '@mui/icons-material/Add';
import SkeletonSitesGrid from '../SitesGrid/SitesGridSkeleton';
import CreateSiteDialog from '../CreateSiteDialog/CreateSiteDialog';
import ListViewIcon from '@mui/icons-material/ViewStreamRounded';
import GridViewIcon from '@mui/icons-material/GridOnRounded';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { useDispatch } from 'react-redux';
import LookupTable from '../../models/LookupTable';
import { PublishingStatus } from '../../models/Publishing';
import { Site } from '../../models/Site';
import { setSiteCookie } from '../../utils/auth';
import { trash } from '../../services/sites';
import { batchActions } from '../../state/actions/misc';
import { showSystemNotification } from '../../state/actions/system';
import { fetchSites, popSite } from '../../state/actions/sites';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import SitesGrid from '../SitesGrid/SitesGrid';
import PublishingStatusDialog from '../PublishingStatusDialog';
import GlobalAppToolbar from '../GlobalAppToolbar';
import Button from '@mui/material/Button';
import { getStoredGlobalMenuSiteViewPreference, setStoredGlobalMenuSiteViewPreference } from '../../utils/state';
import { hasGlobalPermissions } from '../../services/users';
import { immutableEmptyObject } from '../../utils/object';
import { useEnv } from '../../hooks/useEnv';
import { useActiveUser } from '../../hooks/useActiveUser';
import { useSpreadState } from '../../hooks/useSpreadState';
import { useSitesBranch } from '../../hooks/useSitesBranch';
import Paper from '@mui/material/Paper';
import { createComponentId, getSystemLink, pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { DuplicateSiteDialog } from '../DuplicateSiteDialog';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';
import { Typography } from '@mui/material';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { ConfirmDialog } from '../ConfirmDialog';
import { previewSwitch } from '../../services/security';
import { EmptyState } from '../EmptyState';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { ErrorState } from '../ErrorState';

const translations = defineMessages({
	siteDeleted: {
		id: 'sitesGrid.siteDeleted',
		defaultMessage: 'Project deleted successfully'
	}
});

const confirmDeleteInitialState = {
	site: null,
	open: false,
	checked: false
};

export function SiteManagement() {
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const { authoringBase, useBaseDomain } = useEnv();
	const [openCreateSiteDialog, setOpenCreateSiteDialog] = useState(false);
	const user = useActiveUser();
	const [currentView, setCurrentView] = useState<'grid' | 'list'>(
		getStoredGlobalMenuSiteViewPreference(user.username) ?? 'grid'
	);
	const { byId: sitesById, isFetching, active, error } = useSitesBranch();
	const sitesList = sitesById ? Object.values(sitesById) : null;
	const [selectedSiteStatus, setSelectedSiteStatus] = useState<PublishingStatus>(null);
	const [permissionsLookup, setPermissionsLookup] = useState<LookupTable<boolean>>(immutableEmptyObject);
	const duplicateSiteDialogState = useEnhancedDialogState();
	const [duplicateSiteId, setDuplicateSiteId] = useState(null);
	const [isDuplicateDialogFromCreateDialog, setIsDuplicateDialogFromCreateDialog] = useState(false);
	const [disabledSitesLookup, setDisabledSitesLookup] = useSpreadState({});
	const [confirmDeleteState, setConfirmDeleteState] = useSpreadState(confirmDeleteInitialState);

	useEffect(() => {
		const subscription = hasGlobalPermissions('create_site', 'edit_site', 'delete_site', 'duplicate_site').subscribe(
			setPermissionsLookup
		);
		return () => subscription.unsubscribe();
	}, []);

	const onSiteClick = (site: Site) => {
		setSiteCookie(site.id, useBaseDomain);
		previewSwitch().subscribe(() => {
			window.location.href = getSystemLink({
				systemLinkId: 'preview',
				authoringBase,
				site: site.id
			});
		});
	};

	const onDeleteSiteClick = (site: Site) => {
		setConfirmDeleteState({ site, open: true });
	};

	const onConfirmDeleteSite = (site: Site) => {
		setDisabledSitesLookup({ [site.id]: true });
		trash(site.id).subscribe({
			next() {
				dispatch(
					batchActions([
						popSite({ siteId: site.id, isActive: site.id === active }),
						showSystemNotification({
							message: formatMessage(translations.siteDeleted)
						}),
						fetchSites()
					])
				);
				setDisabledSitesLookup({ [site.id]: false });
			},
			error({ response: { response } }) {
				setDisabledSitesLookup({ [site.id]: false });
				dispatch(pushErrorDialog({ props: { error: response } }));
			}
		});
	};

	const onEditSiteClick = (site: Site) => {
		const dialogId = nanoid();
		dispatch(
			pushDialog({
				id: dialogId,
				component: createComponentId('EditSiteDialog'),
				props: {
					site,
					onSaveSuccess: () => dispatch(popDialog({ id: dialogId }))
				}
			})
		);
	};

	const onPublishButtonClick = (
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
		site: Site,
		status: PublishingStatus
	) => {
		event.preventDefault();
		event.stopPropagation();
		setSelectedSiteStatus(status);
		publishingStatusDialogState.onOpen();
	};

	const onDuplicateSiteClick = (siteId: string) => {
		setDuplicateSiteId(siteId);
		setIsDuplicateDialogFromCreateDialog(false);
		duplicateSiteDialogState.onOpen();
	};

	const handleChangeView = () => {
		if (currentView === 'grid') {
			setCurrentView('list');
			setStoredGlobalMenuSiteViewPreference('list', user.username);
		} else {
			setCurrentView('grid');
			setStoredGlobalMenuSiteViewPreference('grid', user.username);
		}
	};

	const createSiteDialogGoBackFromDuplicate = () => {
		duplicateSiteDialogState.onClose();
		setOpenCreateSiteDialog(true);
	};

	const publishingStatusDialogState = useEnhancedDialogState();

	const handleCreateSiteClick = () => setOpenCreateSiteDialog(true);

	const hasCreateSitePermission = permissionsLookup['create_site'];

	const cardHeaderBlock = (
		<CardHeader
			title={<FormattedMessage defaultMessage="Get Started" />}
			titleTypographyProps={{ variant: 'h6' }}
			subheader={
				hasCreateSitePermission ? (
					<FormattedMessage defaultMessage="Create your first project." />
				) : (
					<FormattedMessage defaultMessage="Contact your administrator to gain access to existing projects." />
				)
			}
		/>
	);

	return (
		<Paper elevation={0}>
			<GlobalAppToolbar
				title={<FormattedMessage id="GlobalMenu.Sites" defaultMessage="Projects" />}
				leftContent={
					hasCreateSitePermission && (
						<Button startIcon={<AddIcon />} variant="outlined" color="primary" onClick={handleCreateSiteClick}>
							<FormattedMessage id="sites.createSite" defaultMessage="Create Project" />
						</Button>
					)
				}
				rightContent={
					<Tooltip title={<FormattedMessage id="sites.ChangeView" defaultMessage="Change view" />}>
						<IconButton
							onClick={handleChangeView}
							size="large"
							aria-label={formatMessage({ id: 'sites.ChangeView', defaultMessage: 'Change view' })}
						>
							{currentView === 'grid' ? <ListViewIcon /> : <GridViewIcon />}
						</IconButton>
					</Tooltip>
				}
			/>
			<ErrorBoundary>
				{error ? (
					<ErrorState
						title={
							<FormattedMessage defaultMessage="An error occurred while loading projects. Please contact your administrator." />
						}
						sxs={{ root: { mt: 4 } }}
					/>
				) : isFetching ? (
					<SkeletonSitesGrid numOfItems={3} currentView={currentView} />
				) : sitesList ? (
					sitesList.length > 0 ? (
						<SitesGrid
							sites={sitesList}
							onSiteClick={onSiteClick}
							onDeleteSiteClick={permissionsLookup['delete_site'] && onDeleteSiteClick}
							onEditSiteClick={permissionsLookup['edit_site'] && onEditSiteClick}
							currentView={currentView}
							onPublishButtonClick={onPublishButtonClick}
							onDuplicateSiteClick={permissionsLookup['duplicate_site'] && onDuplicateSiteClick}
							disabledSitesLookup={disabledSitesLookup}
						/>
					) : (
						<EmptyState
							title={<FormattedMessage id="sitesGrid.emptyStateMessage" defaultMessage="No Projects Found" />}
							sxs={{
								root: {
									margin: undefined,
									p: 5,
									bgcolor: 'background.default',
									borderRadius: 1,
									maxWidth: '550px',
									marginTop: '50px',
									marginLeft: 'auto',
									marginRight: 'auto'
								}
							}}
						>
							<Card
								elevation={hasCreateSitePermission ? 2 : 0}
								sx={{
									mt: 1,
									textAlign: 'center',
									...(!hasCreateSitePermission && {
										border: '1px solid',
										borderColor: 'divider'
									})
								}}
							>
								{hasCreateSitePermission ? (
									<CardActionArea onClick={handleCreateSiteClick}>{cardHeaderBlock}</CardActionArea>
								) : (
									cardHeaderBlock
								)}
							</Card>
						</EmptyState>
					)
				) : (
					<></>
				)}
			</ErrorBoundary>
			<PublishingStatusDialog
				open={publishingStatusDialogState.open}
				onClose={publishingStatusDialogState.onClose}
				isMinimized={publishingStatusDialogState.isMinimized}
				hasPendingChanges={publishingStatusDialogState.isMinimized}
				isSubmitting={publishingStatusDialogState.isSubmitting}
				onClosed={() => {
					setSelectedSiteStatus(null);
				}}
				isFetching={false}
				{...selectedSiteStatus}
			/>
			<CreateSiteDialog
				open={openCreateSiteDialog}
				onClose={() => setOpenCreateSiteDialog(false)}
				onShowDuplicate={() => {
					setIsDuplicateDialogFromCreateDialog(true);
					duplicateSiteDialogState.onOpen();
				}}
			/>
			<DuplicateSiteDialog
				siteId={duplicateSiteId}
				open={duplicateSiteDialogState.open}
				onClose={() => {
					setDuplicateSiteId(null);
					duplicateSiteDialogState.onClose();
				}}
				onGoBack={isDuplicateDialogFromCreateDialog ? createSiteDialogGoBackFromDuplicate : null}
				hasPendingChanges={duplicateSiteDialogState.hasPendingChanges}
				isSubmitting={duplicateSiteDialogState.isSubmitting}
				updateSubmittingOrHasPendingChanges={duplicateSiteDialogState.onSubmittingAndOrPendingChange}
			/>
			<ConfirmDialog
				open={confirmDeleteState.open}
				body={
					<>
						<Typography>
							<FormattedMessage
								defaultMessage="Confirm the permanent deletion of the “{siteId}” project."
								values={{
									siteId: confirmDeleteState.site?.id
								}}
							/>
						</Typography>
						<Alert severity="warning" icon={false} sx={{ mt: 2 }}>
							<FormControlLabel
								sx={{ textAlign: 'left' }}
								control={
									<Checkbox
										color="primary"
										checked={confirmDeleteState.checked}
										onChange={() => setConfirmDeleteState({ checked: !confirmDeleteState.checked })}
									/>
								}
								label={
									<FormattedMessage defaultMessage="I understand deleting a project is immediate and irreversible." />
								}
							/>
						</Alert>
					</>
				}
				okButtonText={<FormattedMessage defaultMessage="Delete" />}
				disableOkButton={!confirmDeleteState.checked}
				onOk={() => {
					onConfirmDeleteSite(confirmDeleteState.site);
					setConfirmDeleteState(confirmDeleteInitialState);
				}}
				onCancel={() => setConfirmDeleteState(confirmDeleteInitialState)}
			/>
		</Paper>
	);
}

export default SiteManagement;
