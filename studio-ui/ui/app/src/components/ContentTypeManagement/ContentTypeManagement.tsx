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
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import EditTypeView, { EditTypeAppProps } from './components/EditTypeView';
import ContentType from '../../models/ContentType';
import { TypeListProps } from './components/TypeList';
import { TypeListingView } from './components/TypeListingView';
import { useDispatch } from 'react-redux';
import { filter, fromEvent } from 'rxjs';
import Fade from '@mui/material/Fade';
import { fetchContentTypes } from '../../state/actions/preview';

export interface ContentTypeManagementProps {
	embedded?: boolean;
	showAppsButton?: boolean;
	mountMode?: 'dialog' | 'page';
	onClose?: () => void;
	onMinimize?: () => void;
	onSubmittingAndOrPendingChange?(value: onSubmittingAndOrPendingChangeProps): void;
}

export function ContentTypeManagement(props: ContentTypeManagementProps) {
	const { embedded = false, showAppsButton } = props;
	const dispatch = useDispatch();
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

	useEffect(() => {
		const messagesSubscription = fromEvent<MessageEvent>(window, 'message')
			.pipe(filter((e) => ['CONTENT_TYPES_ON_DELETED'].includes(e.data?.type)))
			.subscribe((e) => {
				switch (e.data?.type) {
					case 'CONTENT_TYPES_ON_DELETED': {
						dispatch(fetchContentTypes());
						break;
					}
				}
			});

		return () => {
			messagesSubscription.unsubscribe();
		};
	}, [dispatch]);

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
					<EditTypeView type={selectedType} onClose={handleBackToList} />
				</Fade>
			)}
		</>
	);
}

export default ContentTypeManagement;
