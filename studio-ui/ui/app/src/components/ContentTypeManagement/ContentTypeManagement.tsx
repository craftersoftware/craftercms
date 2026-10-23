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

import React, { useState } from 'react';
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import EditTypeView, { EditTypeAppProps } from './components/EditTypeView';
import ContentType from '../../models/ContentType';
import { TypeListProps } from './components/TypeList';
import { TypeListingView } from './components/TypeListingView';
import Fade from '@mui/material/Fade';

export interface ContentTypeManagementProps {
	embedded?: boolean;
	showAppsButton?: boolean;
	onSubmittingAndOrPendingChange?(value: onSubmittingAndOrPendingChangeProps): void;
}

export function ContentTypeManagement(props: ContentTypeManagementProps) {
	const { embedded = false, showAppsButton, onSubmittingAndOrPendingChange } = props;
	const [view, setView] = useState<'list' | 'edit' | 'create'>('list');
	const [selectedType, setSelectedType] = useState<ContentType>(null);

	const handleTypeSelected: TypeListProps['onCardClick'] = (_, item) => {
		setSelectedType(item);
		setView('edit');
	};
	const handleBackToList: EditTypeAppProps['onClose'] = () => {
		setSelectedType(null);
		setView('list');
	};

	return (
		<>
			{view === 'list' && (
				<Fade in>
					<TypeListingView
						sx={{ height: '100%' }}
						renderAppBar={!embedded}
						onTypeSelected={handleTypeSelected}
						showOpenLauncherButton={showAppsButton}
					/>
				</Fade>
			)}
			{view === 'edit' && (
				<Fade in>
					<EditTypeView
						type={selectedType}
						onClose={handleBackToList}
						onSubmittingAndOrPendingChange={onSubmittingAndOrPendingChange}
					/>
				</Fade>
			)}
		</>
	);
}

export default ContentTypeManagement;
