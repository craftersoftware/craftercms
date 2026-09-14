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

import { useTheme } from '@mui/material/styles';
import React, { ElementType } from 'react';
import Box, { BoxProps } from '@mui/material/Box';
import ButtonBase, { ButtonBaseProps } from '@mui/material/ButtonBase';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import { alpha } from '@mui/system/colorManipulator';
import Typography from '@mui/material/Typography';
import { capitalize } from '../../../utils/string';
import { FormattedMessage, useIntl } from 'react-intl';
import { ContentTypeField, NewContentTypeField } from '../../../models';
import useIsDarkModeTheme from '../../../hooks/useIsDarkModeTheme';
import LookupTable from '../../../models/LookupTable';
import Asterisk from '../../../icons/Asterisk';
import controlDescriptors from '../descriptors/controls';
import dataSourceDescriptors from '../descriptors/dataSources';
import { applyTranslations } from '../utils';
import Button from '@mui/material/Button';
import AdditionalFieldChip from './AdditionalFieldChip';

function composeFieldPath(fieldPath: string, fieldId: string): string {
	return fieldPath ? `${fieldPath}.${fieldId}` : fieldId;
}

export interface FieldChipProps {
	field: ContentTypeField | NewContentTypeField;
	fieldPath?: string;
	fieldPathsWithErrors: LookupTable<boolean>;
	selectedFieldIdPath?: string;
	onFieldSelected(
		fieldPath: string,
		field: ContentTypeField,
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>
	): void;
	onInsertField?(fieldPath: string): void;
}

const descriptors = { ...controlDescriptors, ...dataSourceDescriptors };

export function FieldChip(props: FieldChipProps) {
	const { field, fieldPathsWithErrors, fieldPath, selectedFieldIdPath, onFieldSelected, onInsertField } = props;
	const theme = useTheme();
	const isDark = useIsDarkModeTheme();
	const isRepeat = field.type === 'repeat';
	const currentFieldPath = composeFieldPath(fieldPath, field.id);
	const isSelected = currentFieldPath === selectedFieldIdPath;
	const error = Boolean(fieldPathsWithErrors[currentFieldPath]); // TODO: make this into an atom
	const Root: ElementType<BoxProps> = (isRepeat ? Box : ButtonBase) as ElementType<BoxProps>;
	const Title: ElementType<BoxProps> = (isRepeat ? ButtonBase : 'div') as ElementType<BoxProps>;
	const onClick: ButtonBaseProps['onClick'] = (e) => onFieldSelected?.(currentFieldPath, field, e);
	const selectorButtonStyles: SxProps<Theme> = {
		'&:active': { boxShadow: theme.shadows[1] },
		'&:hover': {
			bgcolor: alpha(
				theme.palette.action.selected,
				theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity
			)
		}
	};
	const selectorButtonSelectedStyles: SxProps<Theme> = {
		bgcolor: 'action.selected',
		'&:hover': { bgcolor: 'action.selected' }
	};
	const { formatMessage } = useIntl();
	const descriptor = descriptors[field.type];
	const additionalFields = descriptor?.metadata?.additionalFields;
	return (
		<>
			<Root
				disabled={isSelected}
				sx={[
					{
						mb: 1,
						width: '100%',
						alignItems: 'start',
						flexDirection: 'column',
						bgcolor: isDark ? 'grey.800' : 'grey.200',
						borderRadius: 10,
						overflow: 'hidden',
						borderWidth: '1px',
						borderStyle: 'solid',
						borderColor: 'transparent'
					},
					isRepeat ? { borderRadius: 2 } : selectorButtonStyles,
					isSelected && selectorButtonSelectedStyles,
					error && { borderWidth: '1px', borderStyle: 'solid', borderColor: 'error.main' }
				]}
				// @ts-expect-error: Handled. Only when it is a button will it receive the onClick.
				onClick={isRepeat ? undefined : onClick}
			>
				<Box
					component={Title}
					// @ts-expect-error: Handled. Only when it is a button will it receive the onClick.
					onClick={isRepeat ? onClick : undefined}
					disabled={isSelected}
					sx={[
						{
							px: 1.5,
							py: 0.5,
							width: '100%',
							display: 'flex',
							flexWrap: 'wrap',
							alignItems: 'center',
							justifyContent: 'space-between'
						},
						isRepeat && selectorButtonStyles,
						error && { color: 'error.main' }
					]}
				>
					<Box display="flex" alignItems="center">
						{(field as NewContentTypeField).NEW ? (
							<Typography component="strong" sx={{ mr: 0.5, fontWeight: 600 }}>
								<FormattedMessage defaultMessage={`Draft ({type})`} values={{ type: field.type }} />
							</Typography>
						) : (
							<>
								<Typography component="strong" sx={{ mr: 0.5, fontWeight: 600 }}>
									{field.name}
								</Typography>
								<Typography component="span" variant="body2">
									({field.id})
								</Typography>
							</>
						)}
						{error && <Asterisk fontSize="small" />}
					</Box>
					<Typography variant="body2">
						{descriptors[field.type]
							? applyTranslations(descriptors[field.type], formatMessage).name
							: capitalize(field.type).replaceAll('-', ' ')}
					</Typography>
				</Box>
				{isRepeat && (
					<Box p={1} pt={0}>
						{Object.entries(field.fields).map(([fieldId, subField]) => (
							<FieldChip
								key={fieldId}
								field={subField}
								fieldPathsWithErrors={fieldPathsWithErrors}
								selectedFieldIdPath={selectedFieldIdPath}
								fieldPath={currentFieldPath}
								onFieldSelected={onFieldSelected}
								onInsertField={onInsertField}
							/>
						))}
						<Button onClick={() => onInsertField(currentFieldPath)}>
							<FormattedMessage defaultMessage="Add Field" />
						</Button>
					</Box>
				)}
			</Root>
			{additionalFields?.map((additionalFieldId) => (
				<AdditionalFieldChip key={additionalFieldId} fieldId={additionalFieldId} parentFieldId={field.id} />
			))}
		</>
	);
}

export default FieldChip;
