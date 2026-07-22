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

import { NewContentDialogContainerProps } from './utils';
import { FormattedMessage } from 'react-intl';
import React from 'react';
import { ContentType } from '../../models/ContentType';
import { withoutIndex } from '../../utils/path';
import DialogBody from '../DialogBody/DialogBody';
import { TypeListProps } from '../ContentTypeManagement/components/TypeList';
import { getNormalizedFolderPathForApi1GetTypes } from '../../utils/contentType';
import SelectTypeView from '../ContentTypeManagement/components/SelectTypeView';
import Typography from '@mui/material/Typography';
import ItemDisplay from '../ItemDisplay';
import Box from '@mui/material/Box';
import useFetchAllowedTypesForPath from '../../hooks/useFetchAllowedTypesForPath';
import useSelection from '../../hooks/useSelection';

export function NewContentDialogContainer(props: NewContentDialogContainerProps) {
	const { item, onContentTypeSelected, initialCompact = false } = props;
	const stateCreateContentCompactView = useSelection((state) => state.preview.createContentCompactView);
	const createContentCompactView = stateCreateContentCompactView || initialCompact;
	const handleContentTypeSelected = (contentType: ContentType) => {
		onContentTypeSelected?.({ path: withoutIndex(item.path), contentType });
	};

	const handleCardClick: TypeListProps['onCardClick'] = (_, type) => handleContentTypeSelected(type);

	const { contentTypes, isFetching } = useFetchAllowedTypesForPath(getNormalizedFolderPathForApi1GetTypes(item));

	return (
		<DialogBody sx={{ minHeight: 670 }}>
			<SelectTypeView
				initialCompact={createContentCompactView}
				contentTypesList={contentTypes}
				slotProps={{
					listing: {
						skeleton: isFetching,
						skeletonItemCount: 4,
						onCardClick: handleCardClick
					},
					bar: {
						leftChildren: (
							<Box sx={{ pl: 2, mr: 2, maxWidth: 300 }}>
								<Typography variant="body2" color="textSecondary">
									<FormattedMessage defaultMessage="Target Item" />
								</Typography>
								<ItemDisplay item={item} showNavigableAsLinks={false} />
							</Box>
						)
					}
				}}
			/>
		</DialogBody>
	);
}
