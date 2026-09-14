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

import { PossibleContentTypeDraft } from '../../../models/ContentType';
import { useDispatch } from 'react-redux';
import Button, { ButtonProps } from '@mui/material/Button';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import { DeleteContentTypeDialogProps } from '../../DeleteContentTypeDialog';
import Box from '@mui/material/Box';
import TypeCardMedia from './TypeCardMedia';
import Typography from '@mui/material/Typography';
import { ItemTypeIcon } from '../../ItemTypeIcon';
import { FormattedMessage } from 'react-intl';
import React from 'react';
import { nanoid } from 'nanoid';
import { createComponentId } from '../../../utils/system';

export type TypeDetailsHeaderActionTarget = 'properties' | 'template' | 'jsController' | 'groovyController' | 'deleted';

export interface TypeDetailsViewHeaderProps {
	type: PossibleContentTypeDraft;
	onActionClick(event: Parameters<ButtonProps['onClick']>[0], target: TypeDetailsHeaderActionTarget): void;
}

export function TypeDetailsViewHeader({ type, onActionClick }: TypeDetailsViewHeaderProps) {
	const dispatch = useDispatch();
	const handleDeleteType: ButtonProps['onClick'] = (e) => {
		const id = nanoid();
		dispatch(
			pushDialog({
				id,
				component: createComponentId('DeleteContentTypeDialog'),
				props: {
					contentType: type,
					onComplete() {
						dispatch(popDialog({ id }));
						onActionClick?.(e, 'deleted');
					}
				} as Partial<DeleteContentTypeDialogProps>
			})
		);
	};
	const handleActionClick = (e) => {
		onActionClick?.(e, e.currentTarget.getAttribute('data-action-target') as TypeDetailsHeaderActionTarget);
	};
	return (
		<Box display="flex" gap={1}>
			<TypeCardMedia typeId={type.id} thumbnailFileName={type.thumbnailFileName} sx={{ width: 200, height: 200 }} />
			<Box>
				<Typography variant="body2" color="textSecondary">
					{type.id}
				</Typography>
				<Typography variant="h6" component="h2" display="flex" alignItems="center">
					<ItemTypeIcon item={{ mimeType: '', systemType: type.type }} sx={{ color: 'info.main', mr: 0.5 }} />{' '}
					{type.name}
				</Typography>
				<Typography variant="body2" color="textSecondary" mb={0.5}>
					{type.description || <FormattedMessage defaultMessage="(no description)" />}
				</Typography>
				{/* TODO: Add last updated information - There's a pending conversation to include this in the form-definition */}
				{/* <Typography variant="body2" color="textSecondary" mb={0.5}>
					<FormattedMessage
						defaultMessage="Last updated on <b>{date}</b> by <b>{user}</b>"
						values={{
							// TODO: Where does this come from? Add to XML?
							date: 'today',
							user: 'John',
							b: (text) => <strong key={text[0] as string}>{text[0]}</strong>
						}}
					/>
				</Typography> */}
				<Button onClick={handleActionClick} data-action-target="properties">
					<FormattedMessage defaultMessage="Properties" />
				</Button>
				<Button onClick={handleActionClick} data-action-target="template">
					<FormattedMessage defaultMessage="Template" />
				</Button>
				<Button onClick={handleActionClick} data-action-target="jsController">
					<FormattedMessage defaultMessage="Form Controller" />
				</Button>
				<Button onClick={handleActionClick} data-action-target="groovyController">
					<FormattedMessage defaultMessage="Groovy Controller" />
				</Button>
				{!type.NEW && (
					<Button color="error" onClick={handleDeleteType}>
						<FormattedMessage defaultMessage="Delete" />
					</Button>
				)}
			</Box>
		</Box>
	);
}

export default TypeDetailsViewHeader;
