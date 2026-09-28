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

import { TypeListProps } from './TypeList';
import useContentTypeList from '../../../hooks/useContentTypeList';
import Button from '@mui/material/Button';
import AddRounded from '@mui/icons-material/AddRounded';
import { FormattedMessage } from 'react-intl';
import Box, { BoxProps } from '@mui/material/Box';
import GlobalAppToolbar from '../../GlobalAppToolbar';
import SelectTypeView from './SelectTypeView';
import React, { forwardRef } from 'react';
import CreateTypeDialog, { CreateTypeDialogProps } from './CreateTypeDialog';
import { PossibleContentTypeDraft } from '../../../models';
import { initializeTypeForCreate } from '../descriptors/archetypes';
import useEnhancedDialogState from '../../../hooks/useEnhancedDialogState';
import useWithPendingChangesCloseRequest from '../../../hooks/useWithPendingChangesCloseRequest';
import useArchetypes from '../../../hooks/useArchetypes';

interface TypeListingViewProps {
	sx?: BoxProps['sx'];
	style?: BoxProps['style'];
	renderAppBar?: boolean;
	showOpenLauncherButton?: boolean;
	onTypeSelected?: (event: Parameters<TypeListProps['onCardClick']>[0], type: PossibleContentTypeDraft) => void;
}

export const TypeListingView = forwardRef<HTMLDivElement, TypeListingViewProps>(function (props, ref) {
	const { renderAppBar = true, showOpenLauncherButton = true, onTypeSelected, sx, style } = props;
	const openCreateDialogState = useEnhancedDialogState();
	const archetypesMap = useArchetypes();
	const createDialogPendingChangesCloseRequest = useWithPendingChangesCloseRequest(openCreateDialogState.onClose);
	const handleCreateTypeDialogAccept: CreateTypeDialogProps['onAccept'] = (typeData) => {
		const type = initializeTypeForCreate(typeData, typeData.type, archetypesMap);
		onTypeSelected?.(null, { ...type, NEW: true });
	};
	const contentTypesList = useContentTypeList();
	const loading = contentTypesList == null;
	const createNewButton = (
		<Button
			variant={renderAppBar ? 'outlined' : 'text'}
			startIcon={<AddRounded />}
			onClick={() => openCreateDialogState.onOpen()}
		>
			<FormattedMessage defaultMessage="Create Type" />
		</Button>
	);
	return (
		<Box
			ref={ref}
			style={style}
			sx={[
				{
					height: '100%',
					display: 'flex',
					flexDirection: 'column'
				},
				...(Array.isArray(sx) ? sx : [sx])
			]}
		>
			{renderAppBar && (
				<GlobalAppToolbar
					title={<FormattedMessage id="componentsMessages.contentTypes" defaultMessage="Content Types" />}
					showAppsButton={showOpenLauncherButton}
					leftContent={createNewButton}
				/>
			)}
			<SelectTypeView
				contentTypesList={contentTypesList}
				slotProps={{
					box: { sx: { p: 2, overflow: 'auto' } },
					bar: {
						leftChildren: renderAppBar ? undefined : createNewButton
					},
					listing: {
						skeleton: loading,
						skeletonItemCount: 20,
						onCardClick: onTypeSelected
					}
				}}
			/>
			<CreateTypeDialog
				open={openCreateDialogState.open}
				onClose={openCreateDialogState.onClose}
				onClosed={openCreateDialogState.onResetState}
				onAccept={handleCreateTypeDialogAccept}
				hasPendingChanges={openCreateDialogState.hasPendingChanges}
				updateSubmittingOrHasPendingChanges={openCreateDialogState.onSubmittingAndOrPendingChange}
				onWithPendingChangesCloseRequest={createDialogPendingChangesCloseRequest}
			/>
		</Box>
	);
});

export default TypeListingView;
