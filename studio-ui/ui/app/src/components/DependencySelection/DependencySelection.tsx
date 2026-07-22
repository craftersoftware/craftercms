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

import React from 'react';
import { ContentItem } from '../../models/Item';
import { FormattedMessage } from 'react-intl';
import LookupTable from '../../models/LookupTable';
import { SelectionList, SelectionListProps } from './SelectionList';
import { nnou } from '../../utils/object';
import { FetchDependenciesResponse } from '../../services/dependencies';
import Box from '@mui/material/Box';

export interface DependencySelectionProps extends Pick<SelectionListProps, 'onItemClicked' | 'onSelectAllClicked'> {
	items?: ContentItem[];
	selectedItems: LookupTable<boolean>;
	dependencies: FetchDependenciesResponse;
	disabled?: boolean;
	onSelectAllSoftClicked: SelectionListProps['onSelectAllClicked'];
}

export function DependencySelection(props: DependencySelectionProps) {
	const {
		items,
		selectedItems,
		dependencies,
		onItemClicked,
		onSelectAllClicked,
		onSelectAllSoftClicked,
		disabled = false
	} = props;
	return (
		<>
			<Box
				sx={(theme) => ({
					background: theme.palette.background.paper,
					border: `1px solid ${theme.palette.divider}`,
					minHeight: '374px',
					opacity: disabled ? 0.7 : 1
				})}
			>
				<SelectionList
					title={<FormattedMessage id="publishDialog.itemsToPublish" defaultMessage="Items To Publish" />}
					items={items}
					onItemClicked={onItemClicked}
					onSelectAllClicked={onSelectAllClicked}
					displayItemTitle={true}
					selectedItems={selectedItems}
					disabled={disabled}
				/>
				{nnou(dependencies) && (
					<>
						<SelectionList
							title={<FormattedMessage defaultMessage="References of mandatory submission" />}
							subtitle={
								<FormattedMessage id="publishDialog.submissionMandatory" defaultMessage="Submission Mandatory" />
							}
							emptyMessage={<FormattedMessage defaultMessage="No references of mandatory submission" />}
							paths={dependencies.hardDependencies ?? []}
							displayItemTitle={false}
							disabled={disabled}
						/>
						<SelectionList
							title={<FormattedMessage defaultMessage="References of optional submission" />}
							subtitle={<FormattedMessage id="publishDialog.submissionOptional" defaultMessage="Submission Optional" />}
							emptyMessage={<FormattedMessage defaultMessage="No references of optional submission" />}
							paths={dependencies.softDependencies ?? []}
							onItemClicked={onItemClicked}
							onSelectAllClicked={onSelectAllSoftClicked}
							displayItemTitle={false}
							selectedItems={selectedItems}
							disabled={disabled}
						/>
					</>
				)}
			</Box>
		</>
	);
}

export default DependencySelection;
